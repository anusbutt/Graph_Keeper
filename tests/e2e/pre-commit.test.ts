import assert from 'node:assert/strict';
import { chmod, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runProcess } from '../../src/lib/process.js';
import { createValidatorFixture } from '../helpers/validator.js';

const hookSource = fileURLToPath(new URL('../../../templates/pre-commit', import.meta.url));

async function installHook(root: string): Promise<void> {
  const target = join(root, '.git', 'hooks', 'pre-commit');
  await copyFile(hookSource, target);
  await chmod(target, 0o755);
}

function normalizedPathEntry(entry: string): string {
  return entry.trim().replace(/^\u0022|\u0022$/g, '').replace(/[\\/]+$/, '').toLowerCase();
}

async function nativeHookEnvironment(): Promise<NodeJS.ProcessEnv> {
  const environment = { ...process.env };
  if (process.platform !== 'win32') return environment;
  const excludedDirectories = new Set<string>();
  for (const command of ['sh', 'jq']) {
    const located = await runProcess('where.exe', [command], { env: environment });
    if (located.exitCode !== 0) continue;
    for (const executable of located.stdout.split(/\r?\n/).filter(Boolean)) {
      excludedDirectories.add(normalizedPathEntry(dirname(executable)));
    }
  }
  const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === 'path') ?? 'Path';
  environment[pathKey] = (environment[pathKey] ?? '')
    .split(';')
    .filter((entry) => !excludedDirectories.has(normalizedPathEntry(entry)))
    .join(';');
  delete environment.MSYSTEM;
  return environment;
}

test('pre-commit accepts a valid first commit in a CommonJS package scope', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph();
  await writeFile(join(fixture.root, 'package.json'), '{\u0022type\u0022:\u0022commonjs\u0022}\n', 'utf8');
  await fixture.stageAll();

  const committed = await fixture.git(['commit', '-m', 'valid first graph']);

  assert.equal(committed.exitCode, 0, committed.stderr);
  assert.match(committed.stdout + committed.stderr, /GraphKeeper: validation passed/);
});

test('Node hook fails closed when the repository validator is missing', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-missing-hook-validator-');
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph();
  await rm(join(fixture.root, 'scripts', 'validate.mjs'));
  await fixture.stageAll();

  const committed = await fixture.git(['commit', '-m', 'must fail closed']);

  assert.notEqual(committed.exitCode, 0);
  assert.match(committed.stderr, /GK004 .*validate\.mjs.*missing/);
});

test('native Windows Git invokes the Node hook without sh or jq on PATH', async (t) => {
  if (process.platform !== 'win32') return;
  const fixture = await createValidatorFixture('graphkeeper-native-hook-');
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph();
  await fixture.stageAll();
  const environment = await nativeHookEnvironment();
  const sh = await runProcess('sh', ['--version'], { cwd: fixture.root, env: environment });
  const jq = await runProcess('jq', ['--version'], { cwd: fixture.root, env: environment });
  assert.equal(sh.problem, 'missing');
  assert.equal(jq.problem, 'missing');

  const committed = await runProcess('git', ['commit', '-m', 'native Node hook'], {
    cwd: fixture.root,
    env: environment,
    timeoutMs: 30_000,
  });

  assert.equal(committed.exitCode, 0, committed.stderr);
  assert.match(committed.stdout + committed.stderr, /GraphKeeper: validation passed/);

  await fixture.writeGraph({}, {}, {});
  await fixture.stageAll();
  const rejected = await runProcess('git', ['commit', '-m', 'native invalid graph'], {
    cwd: fixture.root,
    env: environment,
    timeoutMs: 30_000,
  });
  assert.notEqual(rejected.exitCode, 0);
  assert.match(rejected.stderr, /GK110 .*\nGK120 .*\nGK130 /);
});

test('Git invokes the Node hook through a custom hooksPath', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-custom-hook-');
  t.after(fixture.cleanup);
  const hooks = join(fixture.root, '.team-hooks');
  await fixture.git(['config', 'core.hooksPath', '.team-hooks']);
  await mkdir(hooks, { recursive: true });
  await copyFile(hookSource, join(hooks, 'pre-commit'));
  await chmod(join(hooks, 'pre-commit'), 0o755);
  await fixture.writeGraph();
  await fixture.stageAll();

  const committed = await fixture.git(['commit', '-m', 'custom Node hook']);

  assert.equal(committed.exitCode, 0, committed.stderr);
  assert.match(committed.stdout + committed.stderr, /GraphKeeper: validation passed/);
});

test('pre-commit accepts later commits when the graph remains valid', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph();
  await fixture.commitAll();
  await writeFile(join(fixture.root, 'README.md'), 'safe change\n', 'utf8');
  await fixture.git(['add', 'README.md']);

  const committed = await fixture.git(['commit', '-m', 'safe non-graph change']);

  assert.equal(committed.exitCode, 0, committed.stderr);
});

test('pre-commit blocks malformed staged graph JSON and leaves HEAD unchanged', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph();
  await fixture.commitAll();
  const before = await fixture.git(['rev-parse', 'HEAD']);
  await writeFile(join(fixture.root, 'graph', 'claims.json'), '{bad json\n', 'utf8');
  await fixture.git(['add', 'graph/claims.json']);

  const committed = await fixture.git(['commit', '-m', 'must fail']);
  const after = await fixture.git(['rev-parse', 'HEAD']);

  assert.notEqual(committed.exitCode, 0);
  assert.match(committed.stderr, /GK102.*graph\/claims\.json/);
  assert.equal(after.stdout, before.stdout);
});

test('pre-commit blocks mutation of an already committed claim', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph();
  await fixture.commitAll();
  const claims = JSON.parse(await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8')) as Array<Record<string, unknown>>;
  claims[0] = { ...claims[0], object: 'passing' };
  await fixture.writeJson('graph/claims.json', claims);
  await fixture.git(['add', 'graph/claims.json']);

  const committed = await fixture.git(['commit', '-m', 'must fail']);

  assert.notEqual(committed.exitCode, 0);
  assert.match(committed.stderr, /GK151.*claim_a1b2c3d4/);
});
