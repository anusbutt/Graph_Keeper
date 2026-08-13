import assert from 'node:assert/strict';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runProcess } from '../../src/lib/process.js';
import { createValidatorFixture } from '../helpers/validator.js';

const cli = fileURLToPath(new URL('../../src/cli.js', import.meta.url));
const validator = fileURLToPath(new URL('../../../scripts/validate.mjs', import.meta.url));

test('public check uses the repository Node validator for acceptance and rejection', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-node-check-');
  t.after(fixture.cleanup);
  await fixture.writeGraph();
  await copyFile(validator, join(fixture.root, 'scripts', 'validate.mjs'));

  const valid = await runProcess(process.execPath, [cli, 'check'], {
    cwd: fixture.root,
    env: process.env,
    timeoutMs: 30_000,
  });
  assert.equal(valid.exitCode, 0, valid.stderr);
  assert.equal(valid.stdout, 'GraphKeeper: validation passed\n');

  await fixture.writeGraph({}, {}, {});
  const invalid = await runProcess(process.execPath, [cli, 'check'], {
    cwd: fixture.root,
    env: process.env,
    timeoutMs: 30_000,
  });
  assert.equal(invalid.exitCode, 1);
  assert.match(invalid.stderr, /^GK110 .*\nGK120 .*\nGK130 .*\nGraphKeeper: 3 violation\(s\)\n$/);
});
