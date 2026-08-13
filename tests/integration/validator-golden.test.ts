import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createValidatorFixture,
  runValidator,
} from '../helpers/validator.js';

test('freezes shell validator success output and exit code', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-validator-golden-');
  t.after(fixture.cleanup);
  await fixture.writeGraph();

  const result = await runValidator(fixture, '--worktree');

  assert.deepEqual(result, {
    exitCode: 0,
    stdout: 'GraphKeeper: validation passed\n',
    stderr: '',
  });
});

test('freezes ordered shell schema diagnostics, contexts, summary, and exit code', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-validator-golden-');
  t.after(fixture.cleanup);
  await fixture.writeGraph({}, {}, {});

  const result = await runValidator(fixture, '--worktree');

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, [
    'GK110 [graph/entities.json:root] entity schema or ID uniqueness violation (records=root); fix: correct the named records and keep IDs unique',
    'GK120 [graph/claims.json:root] claim schema or ID uniqueness violation (records=root); fix: correct the named records and source shape',
    'GK130 [graph/runs.json:root] run schema, lifecycle, or ID uniqueness violation (records=root); fix: correct the named records and lifecycle fields',
    'GraphKeeper: 3 violation(s)',
    '',
  ].join('\n'));
});
