import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  EXIT_SUCCESS,
  EXIT_USAGE,
  parseInitArguments,
  type CliIO,
  run,
} from '../../src/cli.js';
import { runCommand } from '../helpers/repository.js';

function captureIO(): {
  readonly io: CliIO;
  readonly stdout: string[];
  readonly stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    },
  };
}

test('prints help successfully when no command is provided', async () => {
  const capture = captureIO();
  const exitCode = await run([], capture.io);

  assert.equal(exitCode, EXIT_SUCCESS);
  assert.match(capture.stdout.join('\n'), /graphkeeper init/);
  assert.match(capture.stdout.join('\n'), /graphkeeper update/);
  assert.equal(capture.stderr.length, 0);
  assert.match(capture.stdout.join('\n'), /init \[--force\] \[--integrate codex\]/);
});

test('parses only the documented init option grammar', () => {
  assert.deepEqual(parseInitArguments([]), { force: false, integrateCodex: false });
  assert.deepEqual(parseInitArguments(['--force']), { force: true, integrateCodex: false });
  assert.deepEqual(
    parseInitArguments(['--integrate', 'codex']),
    { force: false, integrateCodex: true },
  );
  assert.deepEqual(
    parseInitArguments(['--force', '--integrate', 'codex']),
    { force: true, integrateCodex: true },
  );
  assert.deepEqual(
    parseInitArguments(['--integrate', 'codex', '--force']),
    { force: true, integrateCodex: true },
  );

  for (const invalid of [
    ['--integrate'],
    ['--integrate', 'claude'],
    ['--force', '--force'],
    ['--integrate', 'codex', '--integrate', 'codex'],
    ['--unknown'],
    ['codex'],
  ]) {
    assert.equal(parseInitArguments(invalid), null, invalid.join(' '));
  }
});

test('prints the package version successfully', async () => {
  const capture = captureIO();
  const exitCode = await run(['--version'], capture.io);

  assert.equal(exitCode, EXIT_SUCCESS);
  assert.deepEqual(capture.stdout, ['0.1.2']);
  assert.equal(capture.stderr.length, 0);
});

test('rejects an unknown command as a usage error', async () => {
  const capture = captureIO();
  const exitCode = await run(['unknown'], capture.io);

  assert.equal(exitCode, EXIT_USAGE);
  assert.match(capture.stderr.join('\n'), /Unknown command: unknown/);
});

test('update rejects every argument with GK002 before external work', async () => {
  for (const args of [['--check'], ['latest'], ['--force', '--check']]) {
    const capture = captureIO();
    const exitCode = await run(['update', ...args], capture.io);
    assert.equal(exitCode, EXIT_USAGE);
    assert.match(capture.stderr.join('\n'), /GK002/);
    assert.equal(capture.stdout.length, 0);
  }
});

test('compiled CLI entrypoint returns success for --help', async () => {
  const cliPath = fileURLToPath(new URL('../../src/cli.js', import.meta.url));
  const result = await runCommand(process.execPath, [cliPath, '--help'], process.cwd());

  assert.equal(result.exitCode, EXIT_SUCCESS);
  assert.match(result.stdout, /GraphKeeper/);
  assert.equal(result.stderr, '');
});

test('compiled CLI entrypoint runs through an npm-style symlink', {
  skip: process.platform === 'win32',
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'graphkeeper-cli-link-'));
  try {
    const cliPath = fileURLToPath(new URL('../../src/cli.js', import.meta.url));
    const linkPath = join(directory, 'graphkeeper');
    await symlink(cliPath, linkPath);

    const result = await runCommand(process.execPath, [linkPath, '--version'], directory);

    assert.equal(result.exitCode, EXIT_SUCCESS);
    assert.equal(result.stdout, '0.1.2\n');
    assert.equal(result.stderr, '');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
