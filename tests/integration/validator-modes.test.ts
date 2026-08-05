import assert from 'node:assert/strict';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import test from 'node:test';

import {
  createValidatorFixture,
  runValidator,
  validClaim,
} from '../helpers/validator.js';

test('staged and worktree modes make the same decision for equivalent selected data', async () => {
  const fixture = await createValidatorFixture();
  try {
    await fixture.writeGraph();
    const worktree = await runValidator(fixture, '--worktree');
    await fixture.stageAll();
    const staged = await runValidator(fixture, '--staged');
    assert.equal(worktree.exitCode, 0, worktree.stderr);
    assert.equal(staged.exitCode, worktree.exitCode, staged.stderr);

    await fixture.writeGraph(undefined, [{ ...validClaim, id: 'bad' }]);
    const invalidWorktree = await runValidator(fixture, '--worktree');
    await fixture.stageAll();
    const invalidStaged = await runValidator(fixture, '--staged');
    assert.equal(invalidWorktree.exitCode, 1);
    assert.equal(invalidStaged.exitCode, invalidWorktree.exitCode);
    assert.match(invalidWorktree.stderr, /GK120/);
    assert.match(invalidStaged.stderr, /GK120/);
  } finally {
    await fixture.cleanup();
  }
});

test('accumulates independent failures with stable codes and a final count', async () => {
  const fixture = await createValidatorFixture();
  try {
    await fixture.writeGraph({}, {}, {});
    const result = await runValidator(fixture, '--worktree');
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /GK110/);
    assert.match(result.stderr, /GK120/);
    assert.match(result.stderr, /GK130/);
    assert.match(result.stderr, /GraphKeeper: 3 violation\(s\)/);
  } finally {
    await fixture.cleanup();
  }
});

test('rejects unsupported modes as usage errors', async () => {
  const fixture = await createValidatorFixture();
  try {
    const shell = process.env.GRAPHKEEPER_TEST_SH ?? (process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\sh.exe' : 'sh');
    const { runProcess } = await import('../../src/lib/process.js');
    const result = await runProcess(shell, [fixture.validator.replaceAll('\\', '/'), '--other'], { cwd: fixture.root });
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /GK002/);
  } finally {
    await fixture.cleanup();
  }
});

test('reports malformed JSON without attempting relationship checks', async () => {
  const fixture = await createValidatorFixture();
  try {
    await fixture.writeGraph();
    await writeFile(join(fixture.root, 'graph', 'claims.json'), '[{', 'utf8');
    const result = await runValidator(fixture, '--worktree');
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /GK102/);
    assert.doesNotMatch(result.stderr, /GK140/);
  } finally {
    await fixture.cleanup();
  }
});

test('reports a missing jq prerequisite before reading repository data', async () => {
  const fixture = await createValidatorFixture();
  try {
    const result = await runValidator(fixture, '--worktree', { ...process.env, PATH: '' });
    assert.equal(result.exitCode, 3);
    assert.match(result.stderr, /GK003 jq 1\.6 or newer is required/);
  } finally {
    await fixture.cleanup();
  }
});

test('rejects jq older than 1.6 as a prerequisite failure', async () => {
  const fixture = await createValidatorFixture();
  try {
    const fakeBin = join(fixture.root, 'fake-bin');
    const fakeJq = join(fakeBin, 'jq');
    await mkdir(fakeBin, { recursive: true });
    await writeFile(fakeJq, '#!/bin/sh\nprintf \"%s\\n\" jq-1.5\n', 'utf8');
    await chmod(fakeJq, 0o755);
    const env = {
      ...process.env,
      PATH: fakeBin + delimiter + (process.env.PATH ?? ''),
    };
    const result = await runValidator(fixture, '--worktree', env);
    assert.equal(result.exitCode, 3);
    assert.match(result.stderr, /GK003 jq 1\.6 or newer is required/);
  } finally {
    await fixture.cleanup();
  }
});
