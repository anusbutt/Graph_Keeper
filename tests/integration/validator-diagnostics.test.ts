import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  createValidatorFixture,
  runValidator,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

test('validator diagnostics identify missing and malformed graph paths with corrective guidance', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph();
  await rm(join(fixture.root, 'graph', 'claims.json'));

  const missing = await runValidator(fixture, '--worktree');
  assert.match(missing.stderr, /GK101 \[graph\/claims\.json\].*fix:/);

  await writeFile(join(fixture.root, 'graph', 'claims.json'), '{bad json\n', 'utf8');
  const malformed = await runValidator(fixture, '--worktree');
  assert.match(malformed.stderr, /GK102 \[graph\/claims\.json\].*fix:/);
  assert.doesNotMatch(malformed.stderr, /tmp[\\/].*claims\.json/);
});

test('schema diagnostics identify the graph path and affected record ID', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph([validEntity], [{ ...validClaim, predicate: 'Not Snake' }], [validRun]);

  const result = await runValidator(fixture, '--worktree');

  assert.match(result.stderr, /GK120 \[graph\/claims\.json:claim_a1b2c3d4\].*fix:/);
});

test('relation diagnostics identify the conflicting record and target IDs', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  const old = { ...validClaim, id: 'claim_11111111' };
  const first = { ...validClaim, id: 'claim_22222222', supersedes: old.id };
  const second = { ...validClaim, id: 'claim_33333333', supersedes: old.id };
  await fixture.writeGraph(
    [validEntity],
    [old, first, second],
    [{ ...validRun, claims_written: [old.id, first.id, second.id] }],
  );

  const result = await runValidator(fixture, '--worktree');

  assert.match(result.stderr, /GK140 \[claim_11111111\].*claim_22222222.*claim_33333333.*fix:/);
});

test('history diagnostics identify changed claim and evidence paths', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph();
  await fixture.commitAll();
  await fixture.writeGraph([validEntity], [{ ...validClaim, object: 'passing' }], [validRun]);
  await writeFile(join(fixture.root, 'evidence', 'triage.log'), 'mutated\n', 'utf8');

  const result = await runValidator(fixture, '--worktree');

  assert.match(result.stderr, /GK151 \[claim_a1b2c3d4\].*fix:/);
  assert.match(result.stderr, /GK154 \[evidence\/triage\.log\].*fix:/);
});
