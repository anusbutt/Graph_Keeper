import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runProcess } from '../../src/lib/process.js';
import { parsePackManifest } from '../helpers/npm-pack.js';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

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

test('release tarball contains every runtime asset and excludes development-only files', {
  timeout: 120_000,
}, async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), 'graphkeeper-pack-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const invocation = npmInvocation([
    'pack',
    '--dry-run=false',
    '--json',
    '--pack-destination',
    temporary,
  ]);
  const packed = await runProcess(invocation.command, invocation.args, {
    cwd: projectRoot,
    timeoutMs: 90_000,
  });
  assert.equal(packed.exitCode, 0, packed.stderr || packed.stdout);
  const manifest = parsePackManifest(packed.stdout);
  assert.ok(manifest.files, 'npm pack manifest must list packaged files');
  const paths = new Set(manifest.files.map((file) => file.path));

  for (const required of [
    'dist/src/cli.js',
    'dist/src/commands/update.js',
    'dist/src/commands/integrate.js',
    'dist/src/lib/agent-adapters.js',
    'scripts/validate.sh',
    'scripts/validate.mjs',
    'templates/pre-commit',
    'templates/SKILL.md',
    'templates/graph/SCHEMA.md',
    'examples/reviewer.md',
    'examples/worked-example/graph/claims.json',
    'examples/worked-example/evidence/initial-failure.log',
    'CHANGELOG.md',
    'LICENSE',
    'README.md',
  ]) {
    assert.ok(paths.has(required), 'expected tarball asset: ' + required);
  }

  for (const excludedPrefix of [
    'src/',
    'tests/',
    'specs/',
    'history/',
    '.github/',
    'node_modules/',
  ]) {
    assert.equal(
      [...paths].some((path) => path.startsWith(excludedPrefix)),
      false,
      'development files must be excluded: ' + excludedPrefix,
    );
  }
  for (const excludedFile of ['CLAUDE.md', 'PROGRESS.md', 'tsconfig.json']) {
    assert.equal(paths.has(excludedFile), false, 'development file must be excluded: ' + excludedFile);
  }
  assert.equal(paths.has('scripts/run-tests.mjs'), false, 'test runner must not ship');

  const extracted = join(temporary, 'extracted');
  await mkdir(extracted);
  const unpacked = await runProcess('tar', ['-xf', manifest.filename, '-C', extracted], {
    cwd: temporary,
    timeoutMs: 20_000,
  });
  assert.equal(unpacked.exitCode, 0, unpacked.stderr);
  const packageRoot = join(extracted, 'package');
  const help = await runProcess(process.execPath, [join(packageRoot, 'dist', 'src', 'cli.js'), '--help'], {
    cwd: packageRoot,
    timeoutMs: 10_000,
  });
  assert.equal(help.exitCode, 0, help.stderr);
  assert.match(help.stdout, /GraphKeeper - grounded, auditable memory/);
  assert.match(help.stdout, /graphkeeper doctor/);
  assert.match(help.stdout, /graphkeeper update/);
  assert.match(help.stdout, /integrate remove <codex\|claude>/);
  assert.match(await readFile(join(packageRoot, 'scripts', 'validate.sh'), 'utf8'), /GraphKeeper: validation passed/);
  assert.match(await readFile(join(packageRoot, 'scripts', 'validate.mjs'), 'utf8'), /GraphKeeper: validation passed/);
  assert.match(
    await readFile(join(packageRoot, 'templates', 'SKILL.md'), 'utf8'),
    /^---\nname: graphkeeper\ndescription: .+\n---\n/,
  );
  await access(join(packageRoot, 'templates', 'pre-commit'));
});
