import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import { query } from '../../src/commands/query.js';
import { runProcess, type ProcessResult } from '../../src/lib/process.js';
import type { Claim, Entity, Run } from '../../src/lib/records.js';
import { createValidatorFixture, timestamp } from '../helpers/validator.js';

const claimCount = 10_000;
const queryBudgetMs = process.platform === 'win32' ? 3_000 : 2_000;
const entity: Entity = {
  id: 'query_benchmark',
  type: 'benchmark',
  aliases: ['Query Benchmark'],
  first_seen: timestamp,
};
const claims: Claim[] = Array.from({ length: claimCount }, (_, index) => ({
  id: 'claim_' + index.toString(16).padStart(8, '0'),
  subject: entity.id,
  predicate: 'has_sample',
  object: 'value_' + index,
  source: { kind: 'inference', basis: 'benchmark fixture' },
  produced_by: 'run_2026-07-21-query_benchmark',
  created: timestamp,
}));
const run: Run = {
  id: 'run_2026-07-21-query_benchmark',
  started: timestamp,
  tool: 'benchmark',
  evidence: [],
  claims_written: claims.map((claim) => claim.id),
  ended: timestamp,
  verdict: 'passed',
};

function percentile95(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? Number.POSITIVE_INFINITY;
}

test('10,000-claim query selection and rendering p95 stays within its platform budget', {
  timeout: 60_000,
}, async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph([entity], claims, [run]);

  const runner = async (
    command: string,
    args: readonly string[],
    options: Parameters<typeof runProcess>[2],
  ): Promise<ProcessResult> => command === process.execPath
    ? { exitCode: 0, stdout: 'GraphKeeper: validation passed\n', stderr: '' }
    : runProcess(command, args, options);
  const durations: number[] = [];

  const warmup = await query({ cwd: fixture.root, subject: entity.id, runner });
  assert.equal(warmup.exitCode, 0, warmup.stderr);

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const started = performance.now();
    const result = await query({ cwd: fixture.root, subject: entity.id, runner });
    durations.push(performance.now() - started);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /Active claims: 10000/);
    assert.match(result.stdout, /Claim: claim_0000270f/);
  }

  const p95 = percentile95(durations);
  assert.ok(
    p95 < queryBudgetMs,
    'expected 10,000-claim query p95 below ' + queryBudgetMs + 'ms, observed ' + p95.toFixed(1) + 'ms',
  );
});
