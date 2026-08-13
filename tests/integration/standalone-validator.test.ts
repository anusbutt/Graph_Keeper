import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runProcess } from '../../src/lib/process.js';
import { createValidatorFixture } from '../helpers/validator.js';

const validator = fileURLToPath(new URL('../../../scripts/validate.mjs', import.meta.url));
const generator = fileURLToPath(new URL('../../../scripts/build-validator.mjs', import.meta.url));

test('committed standalone validator matches its canonical TypeScript source', async () => {
  const result = await runProcess(process.execPath, [generator, '--check'], {
    cwd: process.cwd(),
    timeoutMs: 30_000,
  });
  assert.equal(result.exitCode, 0, result.stderr || result.stdout);
});

test('standalone validator preserves usage diagnostics and exits', async () => {
  const missing = await runProcess(process.execPath, [validator], {
    cwd: process.cwd(),
    timeoutMs: 10_000,
  });
  assert.equal(missing.exitCode, 2);
  assert.equal(missing.stdout, '');
  assert.equal(missing.stderr, 'GK002 expected --staged or --worktree\n');

  const invalid = await runProcess(process.execPath, [validator, '--other'], {
    cwd: process.cwd(),
    timeoutMs: 10_000,
  });
  assert.equal(invalid.exitCode, 2);
  assert.equal(invalid.stdout, '');
  assert.equal(invalid.stderr, 'GK002 invalid validator mode\n');
});

test('standalone Node validator checks a real repository without invoking sh or jq', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-standalone-');
  t.after(fixture.cleanup);
  await fixture.writeGraph();

  const valid = await runProcess(process.execPath, [validator, '--worktree'], {
    cwd: fixture.root,
    timeoutMs: 30_000,
  });
  assert.equal(valid.exitCode, 0, valid.stderr);
  assert.equal(valid.stdout, 'GraphKeeper: validation passed\n');

  await fixture.writeGraph({}, {}, {});
  const invalid = await runProcess(process.execPath, [validator, '--worktree'], {
    cwd: fixture.root,
    timeoutMs: 30_000,
  });
  assert.equal(invalid.exitCode, 1);
  assert.match(invalid.stderr, /^GK110 .*\nGK120 .*\nGK130 .*\nGraphKeeper: 3 violation\(s\)\n$/);
});
