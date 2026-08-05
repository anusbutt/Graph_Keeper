import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import { doctor } from '../../src/commands/doctor.js';
import type { Claim, Entity, Run } from '../../src/lib/records.js';
import { createValidatorFixture, timestamp } from '../helpers/validator.js';

const referenceCount = 10_000;
const entity: Entity = {
  id: 'doctor_benchmark',
  type: 'benchmark',
  aliases: [],
  first_seen: timestamp,
};
const runId = 'run_2026-07-21-doctor_benchmark';
const claims: Claim[] = Array.from({ length: referenceCount }, (_, index) => ({
  id: 'claim_' + index.toString(16).padStart(8, '0'),
  subject: entity.id,
  predicate: 'has_sample',
  object: 'value_' + index,
  source: {
    kind: 'tool_output',
    command: 'benchmark --sample ' + index,
    exit_code: 0,
    ref: 'evidence/triage.log#L1-L2',
    captured: timestamp,
  },
  produced_by: runId,
  created: timestamp,
}));
const run: Run = {
  id: runId,
  started: timestamp,
  tool: 'benchmark',
  evidence: ['evidence/triage.log'],
  claims_written: claims.map((claim) => claim.id),
  ended: timestamp,
  verdict: 'passed',
};

function percentile95(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? Number.POSITIVE_INFINITY;
}

test('10,000-reference doctor p95 stays below ten seconds and RSS below 256 MB', {
  timeout: 120_000,
}, async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph([entity], claims, [run]);
  const durations: number[] = [];
  let peakRss = process.memoryUsage().rss;

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const started = performance.now();
    const result = await doctor({ cwd: fixture.root });
    durations.push(performance.now() - started);
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /Summary: 0 error\(s\), 0 warning\(s\)/);
  }

  const p95 = percentile95(durations);
  const peakMegabytes = peakRss / (1024 * 1024);
  assert.ok(
    p95 < 10_000,
    'expected 10,000-reference doctor p95 below 10000ms, observed ' + p95.toFixed(1) + 'ms',
  );
  assert.ok(
    peakMegabytes < 256,
    'expected doctor RSS below 256MB, observed ' + peakMegabytes.toFixed(1) + 'MB',
  );
});
