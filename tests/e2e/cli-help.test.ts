import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  EXIT_SUCCESS,
  EXIT_USAGE,
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
  assert.equal(capture.stderr.length, 0);
});

test('prints the package version successfully', async () => {
  const capture = captureIO();
  const exitCode = await run(['--version'], capture.io);

  assert.equal(exitCode, EXIT_SUCCESS);
  assert.deepEqual(capture.stdout, ['0.1.0']);
  assert.equal(capture.stderr.length, 0);
});

test('rejects an unknown command as a usage error', async () => {
  const capture = captureIO();
  const exitCode = await run(['unknown'], capture.io);

  assert.equal(exitCode, EXIT_USAGE);
  assert.match(capture.stderr.join('\n'), /Unknown command: unknown/);
});

test('compiled CLI entrypoint returns success for --help', async () => {
  const cliPath = fileURLToPath(new URL('../../src/cli.js', import.meta.url));
  const result = await runCommand(process.execPath, [cliPath, '--help'], process.cwd());

  assert.equal(result.exitCode, EXIT_SUCCESS);
  assert.match(result.stdout, /GraphKeeper/);
  assert.equal(result.stderr, '');
});
