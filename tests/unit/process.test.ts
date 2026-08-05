import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { createRepositoryFixture } from '../helpers/repository.js';
import { probeCommand, runProcess } from '../../src/lib/process.js';

test('runs a fixed executable with an explicit argument array', async () => {
  const result = await runProcess(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', 'hello world']);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'hello world');
  assert.equal(result.problem, undefined);
});

test('reports timeout without throwing', async () => {
  const result = await runProcess(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { timeoutMs: 25 });
  assert.equal(result.problem, 'timeout');
  assert.equal(result.exitCode, null);
});

test('reports a missing executable and prerequisite probe failure', async () => {
  const missing = 'graphkeeper-tool-that-does-not-exist-7f9d';
  assert.equal((await runProcess(missing, [])).problem, 'missing');
  assert.equal((await probeCommand(missing, ['--version'])).available, false);
});

test('never evaluates stored command text as shell syntax', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    const marker = join(fixture.root, 'should-not-exist');
    const stored = 'ignored; node -e process.exit(0) > ' + marker;
    const result = await runProcess(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', stored], { cwd: fixture.root });
    assert.equal(result.stdout, stored);
    await assert.rejects(access(marker));
  } finally {
    await fixture.cleanup();
  }
});
