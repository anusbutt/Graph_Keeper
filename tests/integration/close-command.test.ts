import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { runAppend } from '../../src/commands/append.js';
import { runClose, type CloseRunOptions } from '../../src/commands/close.js';
import { doctor } from '../../src/commands/doctor.js';
import { acquireLock } from '../../src/lib/optimistic-write.js';
import {
  createValidatorFixture,
  runValidator,
  timestamp,
  validClaim,
  validEntity,
} from '../helpers/validator.js';

const runId = validClaim.produced_by;
const ended = '2026-07-21T09:15:22Z';

const openRun = {
  id: runId,
  started: timestamp,
  tool: 'codex',
  task: 'verify payment behavior',
  evidence: ['evidence/triage.log'],
  claims_written: [validClaim.id],
};

async function readRuns(root: string): Promise<unknown[]> {
  return JSON.parse(await readFile(join(root, 'graph', 'runs.json'), 'utf8')) as unknown[];
}

async function close(root: string, overrides: Partial<CloseRunOptions> = {}) {
  return runClose({ id: runId, ended, verdict: 'passed', ...overrides }, root);
}

test('close run adds one valid immutable closure and preserves accumulated provenance', async () => {
  const fixture = await createValidatorFixture('graphkeeper-close-success-');
  try {
    await fixture.writeGraph([validEntity], [validClaim], [openRun]);
    await fixture.commitAll();

    const report = await close(fixture.root);
    assert.equal(report.exitCode, 0, report.stderr);
    assert.equal(report.stdout, 'Closed run ' + runId + '\n');
    assert.deepEqual(await readRuns(fixture.root), [{ ...openRun, ended, verdict: 'passed' }]);

    const validation = await runValidator(fixture, '--worktree');
    assert.equal(validation.exitCode, 0, validation.stderr);
    const diagnosis = await doctor({ cwd: fixture.root });
    assert.equal(diagnosis.exitCode, 0, diagnosis.stderr);
    assert.match(diagnosis.stdout, /Summary: 0 error\(s\), 0 warning\(s\)/);
  } finally {
    await fixture.cleanup();
  }
});

test('close run accepts each verdict and an end time equal to the start time', async () => {
  for (const verdict of ['passed', 'failed', 'inconclusive', 'aborted'] as const) {
    const fixture = await createValidatorFixture('graphkeeper-close-verdict-');
    try {
      const selected = { ...openRun, id: 'run_2026-07-21-' + verdict };
      await fixture.writeGraph([], [], [selected]);
      const report = await runClose({ id: selected.id, ended: timestamp, verdict }, fixture.root);
      assert.equal(report.exitCode, 0, report.stderr);
      assert.deepEqual(await readRuns(fixture.root), [{ ...selected, ended: timestamp, verdict }]);
    } finally {
      await fixture.cleanup();
    }
  }
});

test('close run rejects unknown, closed, and invalid lifecycle requests without changing bytes', async () => {
  const cases: Array<{
    name: string;
    runs: unknown[];
    options: CloseRunOptions;
    error: RegExp;
  }> = [
    {
      name: 'unknown run',
      runs: [openRun],
      options: { id: 'run_2026-07-21-missing', ended, verdict: 'passed' },
      error: /GK401.*missing.*run does not exist/i,
    },
    {
      name: 'already closed',
      runs: [{ ...openRun, ended, verdict: 'passed' }],
      options: { id: runId, ended: '2026-07-21T09:16:22Z', verdict: 'failed' },
      error: /GK401.*triage_a1.*already closed/i,
    },
    {
      name: 'end before start',
      runs: [openRun],
      options: { id: runId, ended: '2026-07-21T09:14:21Z', verdict: 'passed' },
      error: /GK401.*triage_a1.*ended cannot precede started/i,
    },
    {
      name: 'malformed timestamp',
      runs: [openRun],
      options: { id: runId, ended: 'not-a-timestamp', verdict: 'passed' },
      error: /GK401.*triage_a1.*ended must be an ISO 8601 UTC timestamp/i,
    },
  ];

  for (const selected of cases) {
    const fixture = await createValidatorFixture('graphkeeper-close-reject-');
    try {
      await fixture.writeGraph([], [], selected.runs);
      const target = join(fixture.root, 'graph', 'runs.json');
      const before = await readFile(target);
      const report = await runClose(selected.options, fixture.root);
      assert.equal(report.exitCode, 1, selected.name);
      assert.match(report.stderr, selected.error, selected.name);
      assert.deepEqual(await readFile(target), before, selected.name);
    } finally {
      await fixture.cleanup();
    }
  }
});

test('close run rejects malformed existing run data without rewriting it', async () => {
  const fixture = await createValidatorFixture('graphkeeper-close-malformed-');
  try {
    await fixture.writeGraph([], [], [{ id: runId, started: timestamp, evidence: [], claims_written: [] }]);
    const target = join(fixture.root, 'graph', 'runs.json');
    const before = await readFile(target);

    const report = await close(fixture.root);
    assert.equal(report.exitCode, 1);
    assert.match(report.stderr, /GK401.*existing run data is invalid/i);
    assert.deepEqual(await readFile(target), before);
  } finally {
    await fixture.cleanup();
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

test('a close that wins the run lock makes a blocked claim fail without an orphan', async () => {
  const fixture = await createValidatorFixture('graphkeeper-close-before-claim-');
  try {
    const selected = { ...openRun, evidence: [], claims_written: [] };
    await fixture.writeGraph([validEntity], [], [selected]);
    const claimsTarget = join(fixture.root, 'graph', 'claims.json');
    const releaseClaims = await acquireLock(claimsTarget);
    const append = runAppend({
      kind: 'claim',
      claim: {
        subject: validEntity.id,
        predicate: 'has_status',
        object: 'flaky',
        kind: 'inference',
        basis: 'test race',
        produced_by: runId,
        created: timestamp,
      },
    }, fixture.root);
    await sleep(80);

    const closed = await close(fixture.root);
    await releaseClaims();
    const appended = await append;

    assert.equal(closed.exitCode, 0, closed.stderr);
    assert.equal(appended.exitCode, 1);
    assert.match(appended.stderr, /closed run/i);
    assert.deepEqual(JSON.parse(await readFile(claimsTarget, 'utf8')), []);
    assert.deepEqual(await readRuns(fixture.root), [{ ...selected, ended, verdict: 'passed' }]);
  } finally {
    await fixture.cleanup();
  }
});

test('claim provenance written before close is preserved by closure', async () => {
  const fixture = await createValidatorFixture('graphkeeper-claim-before-close-');
  try {
    const selected = { ...openRun, evidence: [], claims_written: [] };
    await fixture.writeGraph([validEntity], [], [selected]);
    const appended = await runAppend({
      kind: 'claim',
      claim: {
        id: 'claim_1234abcd',
        subject: validEntity.id,
        predicate: 'has_status',
        object: 'flaky',
        kind: 'inference',
        basis: 'test ordering',
        produced_by: runId,
        created: timestamp,
      },
    }, fixture.root);
    assert.equal(appended.exitCode, 0, appended.stderr);

    const closed = await close(fixture.root);
    assert.equal(closed.exitCode, 0, closed.stderr);
    assert.deepEqual(await readRuns(fixture.root), [{
      ...selected,
      claims_written: ['claim_1234abcd'],
      ended,
      verdict: 'passed',
    }]);
  } finally {
    await fixture.cleanup();
  }
});

test('two simultaneous closers produce one closure and one non-mutating rejection', async () => {
  const fixture = await createValidatorFixture('graphkeeper-close-race-');
  try {
    const selected = { ...openRun, evidence: [], claims_written: [] };
    await fixture.writeGraph([], [], [selected]);
    const results = await Promise.all([
      close(fixture.root, { verdict: 'passed' }),
      close(fixture.root, { verdict: 'failed' }),
    ]);
    assert.deepEqual(results.map((result) => result.exitCode).sort(), [0, 1]);
    assert.equal((await readRuns(fixture.root)).length, 1);
    const validation = await runValidator(fixture, '--worktree');
    assert.equal(validation.exitCode, 0, validation.stderr);
  } finally {
    await fixture.cleanup();
  }
});
