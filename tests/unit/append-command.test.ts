import assert from 'node:assert/strict';
import test from 'node:test';

import { parseAppendArguments, buildClaim, buildRun, generateRunId } from '../../src/commands/append.js';

test('parseAppendArguments parses a tool_output claim', () => {
  const parsed = parseAppendArguments('claim', [
    '--subject', 'test_payments_flaky',
    '--predicate', 'has_status',
    '--object', 'flaky',
    '--kind', 'tool_output',
    '--command', 'npm test',
    '--exit-code', '1',
    '--ref', 'evidence/triage.log#L1-L1',
    '--captured', '2026-07-22T09:00:00Z',
    '--produced-by', 'run_2026-07-21-triage_a1',
    '--confidence', '0.9',
  ]);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.options.kind, 'claim');
    const claimArgs = parsed.options.claim;
    assert.ok(claimArgs);
    assert.equal(claimArgs.kind, 'tool_output');
    assert.equal(claimArgs.exit_code, 1);
    assert.equal(claimArgs.confidence, 0.9);
  }
});

test('parseAppendArguments parses an inference claim with basis', () => {
  const parsed = parseAppendArguments('claim', [
    '--subject', 's', '--predicate', 'p', '--object', 'o', '--kind', 'inference',
    '--basis', 'reasoning', '--produced-by', 'run_2026-07-21-triage_a1',
  ]);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.options.claim?.kind, 'inference');
    assert.equal(parsed.options.claim?.basis, 'reasoning');
  }
});

test('parseAppendArguments rejects unknown claim flag', () => {
  const parsed = parseAppendArguments('claim', ['--nope', 'x']);
  assert.deepEqual(parsed, { ok: false, usageError: 'unknown claim flag: --nope' });
});

test('parseAppendArguments rejects invalid kind and verdict', () => {
  const badKind = parseAppendArguments('claim', ['--kind', 'magic', '--produced-by', 'x']);
  assert.equal(badKind.ok, false);
  const badVerdict = parseAppendArguments('run', ['--verdict', 'maybe']);
  assert.equal(badVerdict.ok, false);
});

test('parseAppendArguments parses a run with evidence and claims-written lists', () => {
  const parsed = parseAppendArguments('run', [
    '--started', '2026-07-22T09:00:00Z', '--tool', 'codex', '--id', 'run_2026-07-22-x',
    '--evidence', 'evidence/a.log,evidence/b.log',
    '--claims-written', 'claim_00000001,claim_00000002',
  ]);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.deepEqual(parsed.options.run?.evidence, ['evidence/a.log', 'evidence/b.log']);
    assert.deepEqual(parsed.options.run?.claims_written, ['claim_00000001', 'claim_00000002']);
  }
});

test('buildClaim and buildRun produce records that round-trip', () => {
  const claim = buildClaim({
    subject: 's', predicate: 'p', object: 'o', kind: 'inference', basis: 'b',
    produced_by: 'run_2026-07-21-triage_a1', created: '2026-07-22T09:00:00Z',
  });
  assert.equal(claim.subject, 's');
  assert.match(claim.id, /^claim_[0-9a-f]{8}$/);

  const run = buildRun({ started: '2026-07-22T09:00:00Z', tool: 'codex', id: 'x' });
  assert.equal(run.id, 'x');
  assert.match(generateRunId('2026-07-22T09:00:00Z'), /^run_2026-07-22-[0-9a-f]{4}$/);
});