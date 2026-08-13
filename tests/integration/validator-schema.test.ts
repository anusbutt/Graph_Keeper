import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createValidatorFixture,
  runValidator,
  timestamp,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

test('accepts a conforming graph in worktree mode', async () => {
  const fixture = await createValidatorFixture();
  try {
    await fixture.writeGraph();
    const result = await runValidator(fixture, '--worktree');
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /validation passed/);
  } finally {
    await fixture.cleanup();
  }
});

test('rejects non-array roots and malformed entity records with GK110', async () => {
  const fixture = await createValidatorFixture();
  try {
    const cases = [
      {},
      [{ ...validEntity, id: 'Bad Entity' }],
      [{ ...validEntity, first_seen: '2026-07-21' }],
      [{ ...validEntity, aliases: ['same', 'same'] }],
      [{ ...validEntity, unexpected: true }],
      [validEntity, validEntity],
    ];
    for (const entities of cases) {
      await fixture.writeGraph(entities);
      const result = await runValidator(fixture, '--worktree');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /GK110/);
    }
  } finally {
    await fixture.cleanup();
  }
});

test('rejects malformed claim fields and source variants with GK120', async () => {
  const fixture = await createValidatorFixture();
  try {
    const cases = [
      {},
      [{ ...validClaim, id: 'claim_bad' }],
      [{ ...validClaim, created: '2026-02-30T09:14:22Z' }],
      [{ ...validClaim, confidence: -0.1 }],
      [{ ...validClaim, confidence: 1, source: { kind: 'inference', basis: 'Reasoning only.' } }],
      [{ ...validClaim, unexpected: true }],
      [{ ...validClaim, source: { kind: 'inference' } }],
      [{ ...validClaim, source: { kind: 'inference', basis: '', ref: 'evidence/triage.log#L1-L2' } }],
      [{ ...validClaim, source: { kind: 'tool_output', command: 'npm test', exit_code: 256, ref: 'evidence/triage.log#L1-L2', captured: timestamp } }],
      [validClaim, validClaim],
    ];
    for (const claims of cases) {
      await fixture.writeGraph(undefined, claims);
      const result = await runValidator(fixture, '--worktree');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /GK120/);
    }
  } finally {
    await fixture.cleanup();
  }
});

test('rejects malformed run fields and lifecycle with GK130', async () => {
  const fixture = await createValidatorFixture();
  try {
    const cases = [
      {},
      [{ ...validRun, id: 'run_bad' }],
      [{ ...validRun, started: '2026-07-21' }],
      [{ ...validRun, evidence: ['../triage.log'] }],
      [{ ...validRun, ended: timestamp, verdict: 'maybe' }],
      [{ ...validRun, ended: undefined }],
      [{ ...validRun, unexpected: true }],
      [validRun, validRun],
    ];
    for (const runs of cases) {
      await fixture.writeGraph(undefined, undefined, runs);
      const result = await runValidator(fixture, '--worktree');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /GK130/);
    }
  } finally {
    await fixture.cleanup();
  }
});
