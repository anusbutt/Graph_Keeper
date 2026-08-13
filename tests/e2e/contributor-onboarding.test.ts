import assert from 'node:assert/strict';
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { query } from '../../src/commands/query.js';
import { runProcess } from '../../src/lib/process.js';
import { createRepositoryFixture } from '../helpers/repository.js';
import { createValidatorFixture } from '../helpers/validator.js';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const cliPath = fileURLToPath(new URL('../../src/cli.js', import.meta.url));
const exampleRoot = fileURLToPath(
  new URL('../../../examples/worked-example/', import.meta.url),
);

function npmInvocation(args: readonly string[]): {
  readonly command: string;
  readonly args: readonly string[];
} {
  if (process.platform !== 'win32') return { command: 'npm', args };
  return {
    command: process.execPath,
    args: [join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), ...args],
  };
}

function shellExecutable(): string {
  if (process.env.GRAPHKEEPER_TEST_SH !== undefined) return process.env.GRAPHKEEPER_TEST_SH;
  return process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\sh.exe' : '/bin/sh';
}

async function copySourceSnapshot(root: string): Promise<void> {
  for (const name of [
    '.gitignore',
    'CONTRIBUTING.md',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
  ]) {
    await copyFile(join(projectRoot, name), join(root, name));
  }
  for (const name of ['.github', 'examples', 'scripts', 'src', 'templates', 'tests']) {
    await cp(join(projectRoot, name), join(root, name), { recursive: true });
  }
}

test('a clean source snapshot completes onboarding gates and a query recipe within fifteen minutes', async (t) => {
  if (process.env.GRAPHKEEPER_ONBOARDING_NESTED === '1') return;
  const fixture = await createRepositoryFixture(true, 'graphkeeper-contributor-clone-');
  t.after(fixture.cleanup);
  await copySourceSnapshot(fixture.root);
  const staged = await fixture.git(['add', '--all']);
  assert.equal(staged.exitCode, 0, staged.stderr);
  const committed = await fixture.git(['commit', '-m', 'clean source snapshot']);
  assert.equal(committed.exitCode, 0, committed.stderr);
  assert.equal((await fixture.git(['status', '--porcelain'])).stdout, '');

  const started = performance.now();
  const nestedEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    GRAPHKEEPER_ONBOARDING_NESTED: '1',
  };
  delete nestedEnvironment.NODE_TEST_CONTEXT;
  for (const name of Object.keys(nestedEnvironment)) {
    if (name.toLowerCase() === 'npm_config_dry_run') delete nestedEnvironment[name];
  }
  nestedEnvironment.npm_config_dry_run = 'false';
  const install = npmInvocation(['ci']);
  const installed = await runProcess(install.command, install.args, {
    cwd: fixture.root,
    env: nestedEnvironment,
    timeoutMs: 120_000,
  });
  assert.equal(installed.exitCode, 0, installed.stderr || installed.stdout);
  const packageMetadata = JSON.parse(
    await readFile(join(projectRoot, 'package.json'), 'utf8'),
  ) as { readonly version: string };
  const version = packageMetadata.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [args, timeoutMs, expected] of [
    [['run', 'test:unit'], 120_000, /tests [0-9]+/],
    [['run', 'typecheck'], 60_000, new RegExp('> graphkeeper@' + version + ' typecheck')],
    [['run', 'package:smoke'], 120_000, new RegExp('graphkeeper-' + version + '\\.tgz')],
    [['ls', '--all'], 60_000, new RegExp('graphkeeper@' + version)],
  ] as const) {
    const invocation = npmInvocation(args);
    const result = await runProcess(invocation.command, invocation.args, {
      cwd: fixture.root,
      env: nestedEnvironment,
      timeoutMs,
    });
    assert.equal(result.exitCode, 0, result.stderr || result.stdout);
    assert.match(result.stdout + result.stderr, expected);
  }
  for (const script of ['scripts/validate.sh', 'templates/pre-commit']) {
    const syntax = await runProcess(shellExecutable(), ['-n', script], {
      cwd: fixture.root,
      env: nestedEnvironment,
      timeoutMs: 10_000,
    });
    assert.equal(syntax.exitCode, 0, syntax.stderr);
  }

  await cp(join(exampleRoot, 'graph'), join(fixture.root, 'graph'), { recursive: true });
  await cp(join(exampleRoot, 'evidence'), join(fixture.root, 'evidence'), { recursive: true });
  const builtCli = join(fixture.root, 'dist', 'src', 'cli.js');
  for (const command of [['check'], ['doctor']] as const) {
    const result = await runProcess(process.execPath, [builtCli, ...command], {
      cwd: fixture.root,
      env: nestedEnvironment,
      timeoutMs: 40_000,
    });
    assert.equal(result.exitCode, 0, result.stderr);
  }

  const recipeDirectory = join(fixture.root, 'examples', 'query-recipes');
  await mkdir(recipeDirectory, { recursive: true });
  const recipePath = join(recipeDirectory, 'active-tool-output.jq');
  await writeFile(recipePath, [
    '[.[] | select(has("supersedes")) | .supersedes] as $superseded',
    '| [.[]',
    '   | select(.subject == $subject)',
    '   | select(.source.kind == "tool_output")',
    '   | select((.id as $id | ($superseded | index($id))) == null)',
    '  ]',
    '| sort_by(.created, .id)',
  ].join('\n') + '\n', 'utf8');
  const recipe = await runProcess('jq', [
    '-c',
    '--arg',
    'subject',
    'test_payments_flaky',
    '-f',
    recipePath,
    join(fixture.root, 'graph', 'claims.json'),
  ], {
    cwd: fixture.root,
    env: nestedEnvironment,
    timeoutMs: 10_000,
  });
  assert.equal(recipe.exitCode, 0, recipe.stderr);
  const selected = JSON.parse(recipe.stdout) as Array<{ readonly id: string }>;
  assert.deepEqual(selected.map((claim) => claim.id), ['claim_22222222']);

  const diff = await fixture.git(['diff', '--check']);
  assert.equal(diff.exitCode, 0, diff.stderr);
  assert.ok(performance.now() - started < 15 * 60 * 1000);
});

test('command-capable and file-editing harness styles read one unchanged graph identically', async (t) => {
  if (process.env.GRAPHKEEPER_ONBOARDING_NESTED === '1') return;
  const fixture = await createValidatorFixture('graphkeeper-two-harness-');
  t.after(fixture.cleanup);
  await cp(join(exampleRoot, 'graph'), join(fixture.root, 'graph'), { recursive: true });
  await cp(join(exampleRoot, 'evidence'), join(fixture.root, 'evidence'), { recursive: true });
  const graphPaths = ['entities.json', 'claims.json', 'runs.json']
    .map((name) => join(fixture.root, 'graph', name));
  const before = await Promise.all(graphPaths.map((path) => readFile(path, 'utf8')));

  const commandHarness = await runProcess(process.execPath, [
    cliPath,
    'query',
    'test_payments_flaky',
  ], {
    cwd: fixture.root,
    env: process.env,
    timeoutMs: 20_000,
  });
  const fileEditingHarness = await query({
    cwd: fixture.root,
    subject: 'test_payments_flaky',
  });

  assert.equal(commandHarness.exitCode, 0, commandHarness.stderr);
  assert.equal(fileEditingHarness.exitCode, 0, fileEditingHarness.stderr);
  assert.equal(commandHarness.stdout, fileEditingHarness.stdout);
  assert.match(commandHarness.stdout, /claim_22222222/);
  assert.match(commandHarness.stdout, /claim_33333333/);
  assert.doesNotMatch(commandHarness.stdout, /claim_11111111/);
  const after = await Promise.all(graphPaths.map((path) => readFile(path, 'utf8')));
  assert.deepEqual(after, before);

  const guide = await readFile(join(projectRoot, 'CONTRIBUTING.md'), 'utf8');
  assert.match(guide, /command-capable harness/is);
  assert.match(guide, /file-editing harness/is);
  assert.match(guide, /same\s+records without vendor-specific\s+fields/is);
});
