import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import { runAppend } from '../../src/commands/append.js';
import { runClose } from '../../src/commands/close.js';
import { createValidatorFixture, runValidator, timestamp, validEntity } from '../helpers/validator.js';

test('fifty overlapping claim and close operations lose no data and an uncontended close stays bounded', {
  timeout: 30_000,
}, async () => {
  const fixture = await createValidatorFixture('graphkeeper-close-performance-');
  try {
    const runs = Array.from({ length: 51 }, (_, index) => ({
      id: 'run_2026-07-21-overlap_' + String(index).padStart(2, '0'),
      started: timestamp,
      tool: 'performance_harness',
      evidence: [],
      claims_written: [],
    }));
    await fixture.writeGraph([validEntity], [], runs);

    const uncontendedStarted = performance.now();
    const uncontended = await runClose({
      id: runs[0]?.id ?? '',
      ended: '2026-07-21T09:15:22Z',
      verdict: 'passed',
    }, fixture.root);
    const uncontendedMs = performance.now() - uncontendedStarted;
    assert.equal(uncontended.exitCode, 0, uncontended.stderr);
    assert.ok(uncontendedMs < 2_000, 'uncontended close took ' + uncontendedMs.toFixed(1) + 'ms');

    for (const [offset, run] of runs.slice(1).entries()) {
      const claimId = 'claim_' + (offset + 1).toString(16).padStart(8, '0');
      const [appended, closed] = await Promise.all([
        runAppend({
          kind: 'claim',
          claim: {
            id: claimId,
            subject: validEntity.id,
            predicate: 'trial_' + String(offset + 1),
            object: 'overlap',
            kind: 'inference',
            basis: 'concurrency trial',
            produced_by: run.id,
            created: timestamp,
          },
        }, fixture.root),
        runClose({
          id: run.id,
          ended: '2026-07-21T09:15:22Z',
          verdict: 'passed',
        }, fixture.root),
      ]);
      assert.equal(closed.exitCode, 0, closed.stderr);
      assert.ok(appended.exitCode === 0 || /GK401.*closed run/i.test(appended.stderr));
    }

    const claims = JSON.parse(
      await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8'),
    ) as Array<{ id: string; produced_by: string }>;
    const finalRuns = JSON.parse(
      await readFile(join(fixture.root, 'graph', 'runs.json'), 'utf8'),
    ) as Array<{ id: string; claims_written: string[]; ended?: string; verdict?: string }>;
    for (const claim of claims) {
      const run = finalRuns.find((candidate) => candidate.id === claim.produced_by);
      assert.ok(run?.claims_written.includes(claim.id), claim.id + ' must remain linked');
    }
    assert.ok(finalRuns.every((run) => run.ended !== undefined && run.verdict === 'passed'));

    const validation = await runValidator(fixture, '--worktree');
    assert.equal(validation.exitCode, 0, validation.stderr);
  } finally {
    await fixture.cleanup();
  }
});
