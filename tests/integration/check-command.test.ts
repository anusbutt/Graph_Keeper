import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { check, type CheckRunner } from '../../src/commands/check.js';
import type { ProcessResult } from '../../src/lib/process.js';
import { createRepositoryFixture } from '../helpers/repository.js';

const processResult = (exitCode: number): ProcessResult => ({
  exitCode,
  stdout: 'validator stdout\n',
  stderr: 'validator stderr\n',
});

test('check discovers the repository validator and invokes worktree mode', async (t) => {
  const repository = await createRepositoryFixture();
  t.after(repository.cleanup);
  const validator = join(repository.root, 'scripts', 'validate.sh');
  const nested = join(repository.root, 'packages', 'nested');
  await mkdir(nested, { recursive: true });
  await mkdir(join(repository.root, 'scripts'), { recursive: true });
  await writeFile(validator, '#!/bin/sh\n', 'utf8');

  const calls: Array<{ command: string; args: readonly string[]; cwd: string | undefined }> = [];
  const runner: CheckRunner = async (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    return processResult(0);
  };

  const result = await check({ cwd: nested, runner });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(calls, [{
    command: 'sh',
    args: [validator, '--worktree'],
    cwd: repository.root,
  }]);
});

test('check forwards validator output and maps public validator exit codes', async (t) => {
  const repository = await createRepositoryFixture();
  t.after(repository.cleanup);
  await mkdir(join(repository.root, 'scripts'), { recursive: true });
  await writeFile(join(repository.root, 'scripts', 'validate.sh'), '#!/bin/sh\n', 'utf8');

  const mappings = [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [9, 5],
  ] as const;

  for (const [validatorExit, expectedExit] of mappings) {
    const result = await check({
      cwd: repository.root,
      runner: async () => processResult(validatorExit),
    });
    assert.equal(result.exitCode, expectedExit);
    assert.equal(result.stdout, 'validator stdout\n');
    if (validatorExit === 9) {
      assert.match(result.stderr, /^validator stderr\nGK005 /);
    } else {
      assert.equal(result.stderr, 'validator stderr\n');
    }
  }
});

test('check reports a stable operational diagnostic when validation times out', async (t) => {
  const repository = await createRepositoryFixture();
  t.after(repository.cleanup);
  await mkdir(join(repository.root, 'scripts'), { recursive: true });
  await writeFile(join(repository.root, 'scripts', 'validate.sh'), '#!/bin/sh\n', 'utf8');

  const result = await check({
    cwd: repository.root,
    timeoutMs: 123,
    runner: async () => ({ exitCode: null, stdout: '', stderr: '', problem: 'timeout' }),
  });

  assert.equal(result.exitCode, 4);
  assert.match(result.stderr, /^GK004 .*123 ms/);
});

test('check reports missing sh as a prerequisite failure', async (t) => {
  const repository = await createRepositoryFixture();
  t.after(repository.cleanup);
  await mkdir(join(repository.root, 'scripts'), { recursive: true });
  await writeFile(join(repository.root, 'scripts', 'validate.sh'), '#!/bin/sh\n', 'utf8');

  const result = await check({
    cwd: repository.root,
    runner: async () => ({ exitCode: null, stdout: '', stderr: '', problem: 'missing' }),
  });

  assert.equal(result.exitCode, 3);
  assert.match(result.stderr, /^GK003 .*Git Bash or WSL/);
});

test('check fails safely when the repository validator is missing', async (t) => {
  const repository = await createRepositoryFixture();
  t.after(repository.cleanup);
  let invoked = false;

  const result = await check({
    cwd: repository.root,
    runner: async () => {
      invoked = true;
      return processResult(0);
    },
  });

  assert.equal(result.exitCode, 4);
  assert.match(result.stderr, /^GK004 .*scripts[\\/]validate\.sh/);
  assert.equal(invoked, false);
});
