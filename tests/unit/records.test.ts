import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RecordValidationError,
  parseClaims,
  parseEntities,
  parseRuns,
  validateClaimRecords,
  validateEntityRecords,
  validateRunRecords,
} from '../../src/lib/records.js';

const captured = '2026-07-21T09:14:22Z';

const validEntity = {
  id: 'test_payments_flaky',
  type: 'test',
  aliases: ['payments test'],
  source_docs: ['evidence/triage.log#L1-L2'],
  first_seen: captured,
};

const validRun = {
  id: 'run_2026-07-21-triage_a1',
  started: captured,
  tool: 'codex',
  task: 'triage payments',
  evidence: ['evidence/triage.log'],
  claims_written: ['claim_a1b2c3d4'],
  ended: '2026-07-21T09:15:22Z',
  verdict: 'passed',
};

const validClaim = {
  id: 'claim_a1b2c3d4',
  subject: 'test_payments_flaky',
  predicate: 'has_status',
  object: 'flaky',
  confidence: 0.9,
  source: {
    kind: 'tool_output',
    command: 'npm test',
    exit_code: 1,
    ref: 'evidence/triage.log#L1-L2',
    captured,
  },
  produced_by: 'run_2026-07-21-triage_a1',
  created: captured,
};

test('accepts conforming claim, entity, and closed run records', () => {
  assert.deepEqual(parseEntities([validEntity]), [validEntity]);
  assert.deepEqual(parseRuns([validRun]), [validRun]);
  assert.deepEqual(parseClaims([validClaim]), [validClaim]);
});

test('accepts inference sources and open runs', () => {
  const inference = {
    ...validClaim,
    source: { kind: 'inference', basis: 'Repeated failures imply flakiness.' },
  };
  const openRun = {
    id: validRun.id,
    started: validRun.started,
    tool: validRun.tool,
    evidence: [],
    claims_written: [],
  };

  assert.equal(parseClaims([inference])[0]?.source.kind, 'inference');
  assert.equal(parseRuns([openRun])[0]?.verdict, undefined);
});

test('rejects invalid claim IDs, timestamps, confidence, and unknown fields', () => {
  const invalidClaims = [
    { ...validClaim, id: 'claim_1' },
    { ...validClaim, created: '2026-07-21' },
    { ...validClaim, created: '2026-02-30T09:14:22Z' },
    { ...validClaim, confidence: 1.01 },
    {
      ...validClaim,
      confidence: 1,
      source: { kind: 'inference', basis: 'Repeated failures imply flakiness.' },
    },
    { ...validClaim, extra: true },
  ];

  for (const claim of invalidClaims) {
    assert.throws(() => parseClaims([claim]), RecordValidationError);
  }
});

test('enforces exact source variants and canonical evidence refs', () => {
  const invalidSources = [
    { kind: 'tool_output', command: 'npm test', exit_code: 0, captured },
    { kind: 'tool_output', command: 'npm test', exit_code: 256, ref: 'evidence/a#L1-L2', captured },
    { kind: 'tool_output', command: 'npm test', exit_code: 0, ref: '../a#L1-L2', captured },
    { kind: 'inference' },
    { kind: 'inference', basis: '' },
    { kind: 'inference', ref: 'evidence/a#L1-L2' },
    { kind: 'unknown' },
  ];

  for (const source of invalidSources) {
    assert.throws(() => parseClaims([{ ...validClaim, source }]), RecordValidationError);
  }
});

test('rejects duplicate IDs, malformed entities, and invalid run lifecycle', () => {
  assert.throws(() => parseClaims([validClaim, validClaim]), /duplicate ID/);
  assert.throws(() => parseEntities([{ ...validEntity, id: 'Bad Slug' }]), RecordValidationError);
  assert.throws(() => parseEntities([{ ...validEntity, aliases: ['same', 'same'] }]), RecordValidationError);
  assert.throws(() => parseRuns([{ ...validRun, verdict: undefined }]), RecordValidationError);
  assert.throws(() => parseRuns([{ ...validRun, ended: '2026-07-21T09:13:22Z' }]), RecordValidationError);
  assert.throws(() => parseRuns([{ ...validRun, verdict: 'maybe' }]), RecordValidationError);
});

test('requires top-level arrays', () => {
  assert.throws(() => parseClaims({}), /top-level array/);
  assert.throws(() => parseEntities(null), /top-level array/);
  assert.throws(() => parseRuns('[]'), /top-level array/);
});

test('exposes structured record issues without changing fail-fast parser behavior', () => {
  const badClaim = { ...validClaim, predicate: 'Not Snake' };
  const badEntity = { ...validEntity, aliases: ['same', 'same'] };
  const badRun = { ...validRun, verdict: 'maybe' };

  assert.deepEqual(validateClaimRecords([badClaim]), [{
    recordType: 'claims',
    index: 0,
    id: validClaim.id,
    message: 'claim predicate must be snake_case',
  }]);
  assert.equal(validateEntityRecords([badEntity])[0]?.id, validEntity.id);
  assert.equal(validateRunRecords([badRun])[0]?.id, validRun.id);
  assert.throws(() => parseClaims([badClaim]), RecordValidationError);
});
