import assert from 'node:assert/strict';
import test from 'node:test';

import type { Run } from '../../src/lib/records.js';
import {
  createValidatorFixture,
  runValidator,
  timestamp,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

function openRun(overrides: Partial<Run> = {}): Run {
  return {
    id: validRun.id,
    started: timestamp,
    tool: validRun.tool,
    evidence: [],
    claims_written: [],
    ...overrides,
  };
}

test('a run opens with stable identity and empty provenance sets', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-run-lifecycle-');
  t.after(fixture.cleanup);
  await fixture.writeGraph([validEntity], [], [openRun()]);

  const result = await runValidator(fixture, '--worktree');

  assert.equal(result.exitCode, 0, result.stderr);
});

test('an open run grows evidence and claim sets, then closes exactly once', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-run-lifecycle-');
  t.after(fixture.cleanup);
  const opened = openRun();
  await fixture.writeGraph([validEntity], [], [opened]);
  await fixture.commitAll('open run');

  const grown: Run = {
    ...opened,
    task: 'triage payments test',
    evidence: ['evidence/triage.log'],
    claims_written: [validClaim.id],
  };
  await fixture.writeGraph([validEntity], [validClaim], [grown]);
  const growth = await runValidator(fixture, '--worktree');
  assert.equal(growth.exitCode, 0, growth.stderr);
  await fixture.commitAll('capture evidence and claim');

  const closed: Run = {
    ...grown,
    ended: '2026-07-21T09:15:22Z',
    verdict: 'passed',
  };
  await fixture.writeGraph([validEntity], [validClaim], [closed]);
  const closure = await runValidator(fixture, '--worktree');
  assert.equal(closure.exitCode, 0, closure.stderr);
  await fixture.commitAll('close run');

  const committed = await runValidator(fixture, '--worktree');
  assert.equal(committed.exitCode, 0, committed.stderr);
});

test('a newly recorded run may open, capture provenance, and close in one commit', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-run-lifecycle-');
  t.after(fixture.cleanup);
  await fixture.writeGraph();
  await fixture.stageAll();

  const result = await runValidator(fixture, '--staged');

  assert.equal(result.exitCode, 0, result.stderr);
});

test('all four verdicts close a run and interrupted runs need no invented claims', async (t) => {
  for (const verdict of ['passed', 'failed', 'inconclusive', 'aborted'] as const) {
    await t.test(verdict, async (st) => {
      const fixture = await createValidatorFixture('graphkeeper-run-verdict-');
      st.after(fixture.cleanup);
      const run: Run = {
        ...openRun({ id: `run_2026-07-21-${verdict}` }),
        ended: '2026-07-21T09:15:22Z',
        verdict,
      };
      await fixture.writeGraph([validEntity], [], [run]);

      const result = await runValidator(fixture, '--worktree');

      assert.equal(result.exitCode, 0, result.stderr);
      if (verdict === 'aborted' || verdict === 'inconclusive') {
        assert.deepEqual(run.claims_written, []);
      }
    });
  }
});

test('a run cannot end before it starts', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-run-lifecycle-');
  t.after(fixture.cleanup);
  const reversed: Run = {
    ...openRun(),
    ended: '2026-07-21T09:14:21Z',
    verdict: 'failed',
  };
  await fixture.writeGraph([validEntity], [], [reversed]);

  const result = await runValidator(fixture, '--worktree');

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /GK130.*run_2026-07-21-triage_a1/);
});

test('open-run provenance sets cannot lose committed entries', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-run-lifecycle-');
  t.after(fixture.cleanup);
  const withEvidence = openRun({ evidence: ['evidence/triage.log'] });
  await fixture.writeGraph([validEntity], [], [withEvidence]);
  await fixture.commitAll('open run with evidence');
  await fixture.writeGraph([validEntity], [], [openRun()]);

  const result = await runValidator(fixture, '--worktree');

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /GK153.*run_2026-07-21-triage_a1/);
});

test('an optional task can be added once while open but cannot later change', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-run-lifecycle-');
  t.after(fixture.cleanup);
  await fixture.writeGraph([validEntity], [], [openRun()]);
  await fixture.commitAll('open run');
  const tasked = openRun({ task: 'triage payments test' });
  await fixture.writeGraph([validEntity], [], [tasked]);
  assert.equal((await runValidator(fixture, '--worktree')).exitCode, 0);
  await fixture.commitAll('name task');
  await fixture.writeGraph([validEntity], [], [{ ...tasked, task: 'rewrite task' }]);

  const result = await runValidator(fixture, '--worktree');

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /GK153.*run_2026-07-21-triage_a1/);
});

test('a closed run cannot reopen or mutate any field or provenance set', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-run-lifecycle-');
  t.after(fixture.cleanup);
  const closedBaseline: Run = {
    ...validRun,
    verdict: 'passed',
  };
  await fixture.writeGraph([validEntity], [validClaim], [closedBaseline]);
  await fixture.commitAll('closed run baseline');

  const mutations: readonly Run[] = [
    openRun({ evidence: closedBaseline.evidence, claims_written: closedBaseline.claims_written }),
    { ...closedBaseline, tool: 'different_tool' },
    { ...closedBaseline, task: 'added after close' },
    { ...closedBaseline, evidence: [...closedBaseline.evidence, 'evidence/later.log'] },
    { ...closedBaseline, ended: '2026-07-21T09:16:22Z' },
    { ...closedBaseline, verdict: 'failed' },
  ];

  for (const mutation of mutations) {
    await fixture.writeGraph([validEntity], [validClaim], [mutation]);
    const result = await runValidator(fixture, '--worktree');
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /GK153.*run_2026-07-21-triage_a1/);
  }
});
