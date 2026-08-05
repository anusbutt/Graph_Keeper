import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createValidatorFixture,
  runValidator,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

test('rejects dangling entity, run, claim, and provenance relationships', async () => {
  const fixture = await createValidatorFixture();
  try {
    const cases: readonly [unknown, unknown, unknown][] = [
      [[], [validClaim], [validRun]],
      [[validEntity], [{ ...validClaim, produced_by: 'run_2026-07-21-missing' }], [validRun]],
      [[validEntity], [{ ...validClaim, supersedes: 'claim_11111111' }], [validRun]],
      [[validEntity], [validClaim], [{ ...validRun, claims_written: ['claim_11111111'] }]],
      [[validEntity], [validClaim], [{ ...validRun, claims_written: [] }]],
      [[validEntity], [validClaim], [{ ...validRun, evidence: [] }]],
    ];
    for (const [entities, claims, runs] of cases) {
      await fixture.writeGraph(entities, claims, runs);
      const result = await runValidator(fixture, '--worktree');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /GK140/);
    }
  } finally {
    await fixture.cleanup();
  }
});

test('rejects supersession forks', async () => {
  const fixture = await createValidatorFixture();
  try {
    const old = { ...validClaim, id: 'claim_11111111' };
    const first = { ...validClaim, id: 'claim_22222222', supersedes: old.id };
    const second = { ...validClaim, id: 'claim_33333333', supersedes: old.id };
    const run = { ...validRun, claims_written: [old.id, first.id, second.id] };
    await fixture.writeGraph(undefined, [old, first, second], [run]);
    const result = await runValidator(fixture, '--worktree');
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /GK140/);
  } finally {
    await fixture.cleanup();
  }
});

test('rejects supersession cycles', async () => {
  const fixture = await createValidatorFixture();
  try {
    const first = { ...validClaim, id: 'claim_11111111', supersedes: 'claim_22222222' };
    const second = { ...validClaim, id: 'claim_22222222', supersedes: first.id };
    const run = { ...validRun, claims_written: [first.id, second.id] };
    await fixture.writeGraph(undefined, [first, second], [run]);
    const result = await runValidator(fixture, '--worktree');
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /GK140/);
  } finally {
    await fixture.cleanup();
  }
});
