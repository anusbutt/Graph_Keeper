import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { createValidatorFixture, runValidator, validClaim, validEntity, type ValidatorFixture } from '../helpers/validator.js';
import { runAppend } from '../../src/commands/append.js';
import { doctor, type DoctorReport } from '../../src/commands/doctor.js';
import { acquireLock, writeJsonArrayUnderLock } from '../../src/lib/optimistic-write.js';

const timestamp = '2026-07-22T09:00:00Z';

async function expectDoctorClean(fixture: ValidatorFixture): Promise<void> {
  const diagnosis = await doctor({ cwd: fixture.root }) as DoctorReport;
  assert.equal(diagnosis.exitCode, 0, diagnosis.stderr);
  assert.match(diagnosis.stdout, /Summary: 0 error\(s\), 0 warning\(s\)/);
}

test('append claim appends a claim and updates the producing run; graph is doctor-clean', async () => {
  const fixture = await createValidatorFixture('graphkeeper-append-');
  try {
    await fixture.writeGraph(
      [validEntity],
      [validClaim],
      [{ id: 'run_2026-07-21-triage_a1', started: timestamp, tool: 'codex', evidence: ['evidence/triage.log'], claims_written: [validClaim.id] }],
    );
    await fixture.commitAll('baseline');

    const claim = await runAppend({
      kind: 'claim',
      claim: {
        subject: 'test_payments_flaky',
        predicate: 'has_status',
        object: 'flaky',
        confidence: 0.9,
        kind: 'tool_output',
        command: 'npm test -- payments',
        exit_code: 1,
        ref: 'evidence/triage.log#L1-L1',
        captured: timestamp,
        produced_by: 'run_2026-07-21-triage_a1',
        created: timestamp,
      },
    }, fixture.root);
    assert.equal(claim.exitCode, 0, claim.stderr);
    assert.match(claim.stdout, /Appended claim claim_[0-9a-f]{8}/);

    const claims = JSON.parse(await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8')) as Array<{ id: string; produced_by: string }>;
    assert.equal(claims.length, 2);
    const appended = claims.find((c) => c.produced_by === 'run_2026-07-21-triage_a1' && c.id !== 'claim_a1b2c3d4');
    assert.ok(appended);
    assert.match(appended?.id ?? '', /^claim_[0-9a-f]{8}$/);

    const runs = JSON.parse(await readFile(join(fixture.root, 'graph', 'runs.json'), 'utf8')) as Array<{ id: string; claims_written: string[]; evidence: string[] }>;
    assert.ok(appended && runs[0]?.claims_written.includes(appended.id), 'producing run must list the new claim');
    assert.ok(runs[0]?.evidence.includes('evidence/triage.log'), 'producing run must list the tool_output evidence file');

    await expectDoctorClean(fixture);
    const validation = await runValidator(fixture, '--worktree');
    assert.equal(validation.exitCode, 0, validation.stderr);
  } finally {
    await fixture.cleanup();
  }
});

test('two concurrent append claim calls both survive (race regression via command)', async () => {
  const fixture = await createValidatorFixture('graphkeeper-append-race-');
  try {
    await fixture.writeGraph(
      [validEntity],
      [],
      [{ id: 'run_2026-07-21-open', started: timestamp, tool: 'codex', evidence: [], claims_written: [] }],
    );
    const results = await Promise.all([
      runAppend({
        kind: 'claim',
        claim: {
          subject: 'test_payments_flaky', predicate: 'on_l', object: 'linux', produced_by: 'run_2026-07-21-open',
          created: timestamp, kind: 'inference', basis: 'linux result',
        },
      }, fixture.root),
      runAppend({
        kind: 'claim',
        claim: {
          subject: 'test_payments_flaky', predicate: 'on_w', object: 'win', produced_by: 'run_2026-07-21-open',
          created: timestamp, kind: 'inference', basis: 'windows result',
        },
      }, fixture.root),
    ]);
    for (const result of results as Array<{ exitCode: number; stderr: string }>) {
      assert.equal(result.exitCode, 0, result.stderr);
    }

    const claims = JSON.parse(await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8')) as Array<{ predicate: string }>;
    assert.equal(claims.length, 2, 'both claims must survive');
    assert.ok(claims.some((c) => c.predicate === 'on_l'));
    assert.ok(claims.some((c) => c.predicate === 'on_w'));

    await expectDoctorClean(fixture);
  } finally {
    await fixture.cleanup();
  }
});

test('append claim rejects an unknown subject and a nonexistent producing run', async () => {
  const fixture = await createValidatorFixture('graphkeeper-append-reject-');
  try {
    await fixture.writeGraph();
    await fixture.commitAll();

    const badSubject = await runAppend({
      kind: 'claim',
      claim: {
        subject: 'does_not_exist', predicate: 'has_status', object: 'x', kind: 'inference', basis: 'b',
        produced_by: 'run_2026-07-21-triage_a1', created: timestamp,
      },
    }, fixture.root);
    assert.notEqual(badSubject.exitCode, 0);
    assert.match(badSubject.stderr, /GK401.*subject does not resolve/i);

    const badRun = await runAppend({
      kind: 'claim',
      claim: {
        subject: 'test_payments_flaky', predicate: 'has_status', object: 'x', kind: 'inference', basis: 'b',
        produced_by: 'run_9999-01-01-missing', created: timestamp,
      },
    }, fixture.root);
    assert.notEqual(badRun.exitCode, 0);
    assert.match(badRun.stderr, /GK401.*producing run does not exist/i);
  } finally {
    await fixture.cleanup();
  }
});

test('append run appends a run and is doctor-clean', async () => {
  const fixture = await createValidatorFixture('graphkeeper-append-run-');
  try {
    await fixture.writeGraph([], [], [{ id: 'run_2026-07-21-triage_a1', started: timestamp, tool: 'codex', evidence: [], claims_written: [] }]);
    await fixture.commitAll();
    const report = await runAppend({
      kind: 'run',
      run: { id: 'run_2026-07-22-solo', started: timestamp, tool: 'codex', task: 'trace flaky' },
    }, fixture.root);
    assert.equal(report.exitCode, 0, report.stderr);
    assert.match(report.stdout, /Appended run run_2026-07-22-solo/);

    const runs = JSON.parse(await readFile(join(fixture.root, 'graph', 'runs.json'), 'utf8')) as Array<{ id: string }>;
    assert.equal(runs.length, 2);
    assert.ok(runs.some((r) => r.id === 'run_2026-07-22-solo'));

    await expectDoctorClean(fixture);
  } finally {
    await fixture.cleanup();
  }
});

test('append run rejects a duplicate run id', async () => {
  const fixture = await createValidatorFixture('graphkeeper-append-dup-');
  try {
    await fixture.writeGraph([], [], [{ id: 'run_2026-07-21-triage_a1', started: timestamp, tool: 'codex', evidence: [], claims_written: [] }]);
    await fixture.commitAll();
    const report = await runAppend({
      kind: 'run',
      run: { id: 'run_2026-07-21-triage_a1', started: timestamp, tool: 'codex' },
    }, fixture.root);
    assert.notEqual(report.exitCode, 0);
    assert.match(report.stderr, /GK401.*already exists/i);
  } finally {
    await fixture.cleanup();
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

test('append claim cannot orphan a claim when its run is closed mid-flight', async () => {
  const fixture = await createValidatorFixture('graphkeeper-append-midflight-');
  try {
    const run = {
      id: 'run_2026-07-21-midflight', started: timestamp, tool: 'codex', evidence: [], claims_written: [],
    };
    await fixture.writeGraph([validEntity], [], [run]);
    await fixture.commitAll();

    const runsTarget = join(fixture.root, 'graph', 'runs.json');

    // Hold the runs lock so append-claim acquires the claims lock and then blocks
    // here waiting for the runs lock. This simulates a concurrent closer that
    // wedges itself between the claim write and the run-link write.
    const releaseRuns = await acquireLock(runsTarget);
    const append = runAppend({
      kind: 'claim',
      claim: {
        subject: 'test_payments_flaky', predicate: 'p', object: 'o', kind: 'inference', basis: 'b',
        produced_by: run.id, created: timestamp,
      },
    }, fixture.root);

    // Let append-claim acquire the claims lock and block on the runs lock.
    await sleep(80);

    // Mid-flight: close the run while append-claim is blocked.
    await writeJsonArrayUnderLock(runsTarget, (records) => {
      const index = records.findIndex((r) => (r as { id?: string }).id === run.id);
      if (index === -1) return;
      (records[index] as { verdict?: string; ended?: string }).verdict = 'passed';
      (records[index] as { verdict?: string; ended?: string }).ended = '2026-07-22T09:01:00Z';
    });

    // Release so append-claim can proceed; it must re-read the now-closed run.
    await releaseRuns();
    const result = await append;

    assert.notEqual(result.exitCode, 0, 'append must fail cleanly');
    assert.match(result.stderr, /closed run/i);

    // No claim may have been committed, so no orphaned/unlinked claim exists.
    const claims = JSON.parse(
      await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8'),
    ) as Array<{ id: string; produced_by: string }>;
    assert.equal(claims.length, 0, 'claims.json must be untouched on failure');

    // The run was closed by the concurrent writer, but the append must not have
    // linked any claim id into it (no partial run-link write on failure).
    const runs = JSON.parse(
      await readFile(runsTarget, 'utf8'),
    ) as Array<{ id: string; claims_written: string[]; verdict?: string; ended?: string }>;
    const closedRun = runs.find((r) => r.id === run.id);
    assert.ok(closedRun, 'the closed run must still be present');
    assert.equal(closedRun?.verdict, 'passed');
    assert.equal(closedRun?.claims_written.length, 0, 'no claim id may be linked into the run on failure');
  } finally {
    await fixture.cleanup();
  }
});

test('a run closed just before append-claim is rejected without writing a claim', async () => {
  const fixture = await createValidatorFixture('graphkeeper-append-prestaged-');
  try {
    const run = {
      id: 'run_2026-07-21-prestaged',
      started: timestamp, tool: 'codex', evidence: [], claims_written: [],
      ended: '2026-07-22T09:01:00Z', verdict: 'passed',
    };
    await fixture.writeGraph([validEntity], [], [run]);
    await fixture.commitAll();

    const report = await runAppend({
      kind: 'claim',
      claim: {
        subject: 'test_payments_flaky', predicate: 'p', object: 'o', kind: 'inference', basis: 'b',
        produced_by: run.id, created: timestamp,
      },
    }, fixture.root);

    assert.notEqual(report.exitCode, 0);
    assert.match(report.stderr, /closed run/i);
    const claims = JSON.parse(
      await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8'),
    ) as Array<{ id: string }>;
    assert.equal(claims.length, 0);
  } finally {
    await fixture.cleanup();
  }
});