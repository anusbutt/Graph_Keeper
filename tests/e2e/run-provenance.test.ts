import assert from 'node:assert/strict';
import { chmod, copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { doctor } from '../../src/commands/doctor.js';
import { query } from '../../src/commands/query.js';
import type { Claim, Entity, Run } from '../../src/lib/records.js';
import {
  createValidatorFixture,
  runValidator,
} from '../helpers/validator.js';

const hookSource = fileURLToPath(new URL('../../../templates/pre-commit', import.meta.url));
const runFixtures = fileURLToPath(new URL('../../../tests/fixtures/runs/', import.meta.url));
const evidenceFixtures = fileURLToPath(
  new URL('../../../tests/fixtures/evidence/', import.meta.url),
);

async function installHook(root: string): Promise<void> {
  const target = join(root, '.git', 'hooks', 'pre-commit');
  await copyFile(hookSource, target);
  await chmod(target, 0o755);
}

async function copyRepository(source: string, root: string): Promise<void> {
  await cp(join(source, 'graph'), join(root, 'graph'), { recursive: true });
  await cp(join(source, 'evidence'), join(root, 'evidence'), { recursive: true });
}

test('canonical long-lived, concurrent, and overlapping-reference repositories are healthy', async (t) => {
  const scenarios = [
    join(runFixtures, 'long-lived-open'),
    join(runFixtures, 'concurrent-appends'),
    join(evidenceFixtures, 'overlapping-references'),
  ];

  for (const source of scenarios) {
    await t.test(source.split(/[\\/]/).at(-1) ?? source, async (st) => {
      const fixture = await createValidatorFixture('graphkeeper-run-repository-');
      st.after(fixture.cleanup);
      await copyRepository(source, fixture.root);

      const validation = await runValidator(fixture, '--worktree');
      const diagnosis = await doctor({ cwd: fixture.root });

      assert.equal(validation.exitCode, 0, validation.stderr);
      assert.equal(diagnosis.exitCode, 0, diagnosis.stderr);
      assert.match(diagnosis.stdout, /Summary: 0 error\(s\), 0 warning\(s\)/);
    });
  }

  const concurrentRuns = JSON.parse(
    await readFile(join(runFixtures, 'concurrent-appends', 'graph', 'runs.json'), 'utf8'),
  ) as Run[];
  assert.equal(new Set(concurrentRuns.map((run) => run.id)).size, concurrentRuns.length);

  const overlappingClaims = JSON.parse(
    await readFile(
      join(evidenceFixtures, 'overlapping-references', 'graph', 'claims.json'),
      'utf8',
    ),
  ) as Claim[];
  assert.equal(overlappingClaims.length, 2);
  assert.equal(overlappingClaims[0]?.source.kind, 'tool_output');
  assert.equal(overlappingClaims[1]?.source.kind, 'tool_output');
  if (
    overlappingClaims[0]?.source.kind === 'tool_output'
    && overlappingClaims[1]?.source.kind === 'tool_output'
  ) {
    assert.equal(
      overlappingClaims[0].source.ref.split('#')[0],
      overlappingClaims[1].source.ref.split('#')[0],
    );
    assert.notEqual(overlappingClaims[0].source.ref, overlappingClaims[1].source.ref);
  }
});

test('a complete run can open, capture evidence and a claim, close, and remain traceable', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-run-provenance-');
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  const entity: Entity = {
    id: 'test_payments_flaky',
    type: 'test',
    aliases: ['payments test'],
    first_seen: '2026-07-21T09:14:00Z',
  };
  const opened: Run = {
    id: 'run_2026-07-21-provenance',
    started: '2026-07-21T09:14:00Z',
    tool: 'coding_agent',
    task: 'trace payments failure',
    evidence: [],
    claims_written: [],
  };
  await fixture.writeJson('graph/entities.json', [entity]);
  await fixture.writeJson('graph/claims.json', []);
  await fixture.writeJson('graph/runs.json', [opened]);
  await mkdir(join(fixture.root, 'evidence'), { recursive: true });
  await fixture.commitAll('open provenance run');

  const evidencePath = join(fixture.root, 'evidence', 'provenance.log');
  await copyFile(join(evidenceFixtures, 'immutable', 'captured.log'), evidencePath);
  const claim: Claim = {
    id: 'claim_90909090',
    subject: entity.id,
    predicate: 'has_failure',
    object: 'timeout',
    source: {
      kind: 'tool_output',
      command: 'npm test -- payments',
      exit_code: 1,
      ref: 'evidence/provenance.log#L1-L3',
      captured: '2026-07-21T09:15:00Z',
    },
    produced_by: opened.id,
    created: '2026-07-21T09:15:30Z',
  };
  const grown: Run = {
    ...opened,
    evidence: ['evidence/provenance.log'],
    claims_written: [claim.id],
  };
  await fixture.writeJson('graph/claims.json', [claim]);
  await fixture.writeJson('graph/runs.json', [grown]);
  await fixture.commitAll('capture evidence and claim');

  const closed: Run = {
    ...grown,
    ended: '2026-07-21T09:16:00Z',
    verdict: 'failed',
  };
  await fixture.writeJson('graph/runs.json', [closed]);
  await fixture.commitAll('close provenance run');

  const diagnosis = await doctor({ cwd: fixture.root });
  const queried = await query({ cwd: fixture.root, subject: entity.id });
  assert.equal(diagnosis.exitCode, 0, diagnosis.stderr);
  assert.match(diagnosis.stdout, /Summary: 0 error\(s\), 0 warning\(s\)/);
  assert.equal(queried.exitCode, 0, queried.stderr);
  assert.match(queried.stdout, /Claim: claim_90909090/);
  assert.match(queried.stdout, /Producer: run_2026-07-21-provenance/);
  assert.match(queried.stdout, /Evidence: evidence\/provenance\.log#L1-L3/);

  const capturedLines = (await readFile(evidencePath, 'utf8')).trimEnd().split(/\r?\n/);
  assert.deepEqual(capturedLines, [
    'command: npm test -- payments',
    'exit: 1',
    'result: timeout after 5000ms',
  ]);

  const headBeforeMutation = await fixture.git(['rev-parse', 'HEAD']);
  await copyFile(join(evidenceFixtures, 'immutable', 'attempted-rewrite.log'), evidencePath);
  await fixture.writeJson('graph/runs.json', [{ ...closed, verdict: 'passed' }]);
  await fixture.stageAll();
  const rejected = await fixture.git(['commit', '-m', 'attempt provenance rewrite']);
  const headAfterMutation = await fixture.git(['rev-parse', 'HEAD']);

  assert.notEqual(rejected.exitCode, 0);
  assert.match(rejected.stderr, /GK153.*run_2026-07-21-provenance/);
  assert.match(rejected.stderr, /GK154.*evidence\/provenance\.log/);
  assert.equal(headAfterMutation.stdout, headBeforeMutation.stdout);
});

test('claim-to-run and tool-output-to-evidence provenance mismatches are rejected', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-run-provenance-');
  t.after(fixture.cleanup);
  const entity: Entity = {
    id: 'test_payments_flaky',
    type: 'test',
    aliases: [],
    first_seen: '2026-07-21T09:14:00Z',
  };
  const claim: Claim = {
    id: 'claim_81818181',
    subject: entity.id,
    predicate: 'has_failure',
    object: 'timeout',
    source: {
      kind: 'tool_output',
      command: 'npm test -- payments',
      exit_code: 1,
      ref: 'evidence/provenance.log#L1-L3',
      captured: '2026-07-21T09:15:00Z',
    },
    produced_by: 'run_2026-07-21-provenance',
    created: '2026-07-21T09:15:30Z',
  };
  const run: Run = {
    id: claim.produced_by,
    started: '2026-07-21T09:14:00Z',
    tool: 'coding_agent',
    evidence: [],
    claims_written: [],
  };
  await fixture.writeGraph([entity], [claim], [run]);

  const missingClaimLink = await runValidator(fixture, '--worktree');
  assert.equal(missingClaimLink.exitCode, 1);
  assert.match(missingClaimLink.stderr, /GK140.*claim_81818181/);

  await fixture.writeGraph(
    [entity],
    [claim],
    [{ ...run, claims_written: [claim.id] }],
  );
  const missingEvidenceLink = await runValidator(fixture, '--worktree');
  assert.equal(missingEvidenceLink.exitCode, 1);
  assert.match(missingEvidenceLink.stderr, /GK140.*claim_81818181/);
});
