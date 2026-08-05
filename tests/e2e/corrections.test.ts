import assert from 'node:assert/strict';
import { chmod, copyFile, cp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { query } from '../../src/commands/query.js';
import type { Claim, Run } from '../../src/lib/records.js';
import {
  createValidatorFixture,
  runValidator,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

const hookSource = fileURLToPath(new URL('../../../templates/pre-commit', import.meta.url));
const correctionFixtures = fileURLToPath(
  new URL('../../../tests/fixtures/corrections/', import.meta.url),
);

const baseClaim: Claim = {
  ...validClaim,
  id: 'claim_11111111',
  object: 'failing',
  source: { kind: 'inference', basis: 'initial triage' },
  produced_by: 'run_2026-07-21-correction_base',
  created: '2026-07-21T09:14:22Z',
};

const firstCorrection: Claim = {
  ...baseClaim,
  id: 'claim_22222222',
  object: 'intermittent',
  source: { kind: 'inference', basis: 'rerun narrowed the failure mode' },
  produced_by: 'run_2026-07-21-correction_first',
  created: '2026-07-21T09:15:22Z',
  supersedes: baseClaim.id,
};

const chainTip: Claim = {
  ...baseClaim,
  id: 'claim_33333333',
  object: 'passing_with_utc_default',
  source: { kind: 'inference', basis: 'UTC configuration removed the failure' },
  produced_by: 'run_2026-07-21-correction_second',
  created: '2026-07-21T09:16:22Z',
  supersedes: firstCorrection.id,
};

function runFor(claim: Claim): Run {
  return {
    ...validRun,
    id: claim.produced_by,
    started: claim.created,
    evidence: [],
    claims_written: [claim.id],
    ended: claim.created,
    verdict: 'passed',
  };
}

async function installHook(root: string): Promise<void> {
  const target = join(root, '.git', 'hooks', 'pre-commit');
  await copyFile(hookSource, target);
  await chmod(target, 0o755);
}

test('a first correction preserves the old claim and becomes the only active chain member', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-correction-');
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph([validEntity], [baseClaim], [runFor(baseClaim)]);
  await fixture.commitAll('record original claim');
  const committedOriginal = JSON.parse(
    await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8'),
  ) as Claim[];

  await fixture.writeGraph(
    [validEntity],
    [baseClaim, firstCorrection],
    [runFor(baseClaim), runFor(firstCorrection)],
  );
  const committed = await fixture.git(['add', '--all']).then(async () =>
    fixture.git(['commit', '-m', 'append first correction']),
  );

  assert.equal(committed.exitCode, 0, committed.stderr);
  const stored = JSON.parse(
    await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8'),
  ) as Claim[];
  assert.deepEqual(stored[0], committedOriginal[0]);
  assert.equal(stored[1]?.supersedes, baseClaim.id);

  const result = await query({ cwd: fixture.root, subject: validEntity.id });
  assert.equal(result.exitCode, 0, result.stderr);
  assert.doesNotMatch(result.stdout, new RegExp(baseClaim.id));
  assert.match(result.stdout, new RegExp(firstCorrection.id));
});

test('a correction chain extends from its active tip without changing earlier generations', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-correction-');
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph(
    [validEntity],
    [baseClaim, firstCorrection],
    [runFor(baseClaim), runFor(firstCorrection)],
  );
  await fixture.commitAll('record first correction');
  const before = JSON.parse(
    await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8'),
  ) as Claim[];

  await fixture.writeGraph(
    [validEntity],
    [baseClaim, firstCorrection, chainTip],
    [runFor(baseClaim), runFor(firstCorrection), runFor(chainTip)],
  );
  await fixture.stageAll();
  const committed = await fixture.git(['commit', '-m', 'extend correction chain']);

  assert.equal(committed.exitCode, 0, committed.stderr);
  const stored = JSON.parse(
    await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8'),
  ) as Claim[];
  assert.deepEqual(stored.slice(0, 2), before);
  assert.equal(stored[2]?.supersedes, firstCorrection.id);

  const result = await query({ cwd: fixture.root, subject: validEntity.id });
  assert.equal(result.exitCode, 0, result.stderr);
  assert.doesNotMatch(result.stdout, new RegExp(baseClaim.id));
  assert.doesNotMatch(result.stdout, new RegExp(firstCorrection.id));
  assert.match(result.stdout, new RegExp(chainTip.id));
});

test('a second direct correction is rejected as a fork and names the target and both successors', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-correction-');
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph(
    [validEntity],
    [baseClaim, firstCorrection],
    [runFor(baseClaim), runFor(firstCorrection)],
  );
  await fixture.commitAll('record first correction');
  const competing: Claim = {
    ...chainTip,
    id: 'claim_44444444',
    produced_by: 'run_2026-07-21-correction_fork',
    supersedes: baseClaim.id,
  };
  await fixture.writeGraph(
    [validEntity],
    [baseClaim, firstCorrection, competing],
    [runFor(baseClaim), runFor(firstCorrection), runFor(competing)],
  );
  await fixture.stageAll();

  const committed = await fixture.git(['commit', '-m', 'attempt competing correction']);

  assert.notEqual(committed.exitCode, 0);
  assert.match(committed.stderr, /GK140/);
  for (const id of [baseClaim.id, firstCorrection.id, competing.id]) {
    assert.match(committed.stderr, new RegExp(id));
  }
});

test('a self-cycle is rejected and identifies its cycle member', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-correction-');
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  const selfCycle: Claim = { ...baseClaim, supersedes: baseClaim.id };
  await fixture.writeGraph([validEntity], [selfCycle], [runFor(selfCycle)]);
  await fixture.stageAll();

  const committed = await fixture.git(['commit', '-m', 'attempt self cycle']);

  assert.notEqual(committed.exitCode, 0);
  assert.match(committed.stderr, /GK140.*cycle members: claim_11111111/);
});

test('a multi-node cycle is rejected and identifies every cycle member', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-correction-');
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  const cycle = [
    { ...baseClaim, supersedes: chainTip.id },
    firstCorrection,
    chainTip,
  ];
  await fixture.writeGraph(
    [validEntity],
    cycle,
    cycle.map(runFor),
  );
  await fixture.stageAll();

  const committed = await fixture.git(['commit', '-m', 'attempt multi-node cycle']);

  assert.notEqual(committed.exitCode, 0);
  assert.match(committed.stderr, /GK140.*cycle members:/);
  for (const claim of cycle) assert.match(committed.stderr, new RegExp(claim.id));
});

test('changing an old claim is rejected even when a valid successor is appended', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-correction-');
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph([validEntity], [baseClaim], [runFor(baseClaim)]);
  await fixture.commitAll('record original claim');
  const mutated = { ...baseClaim, object: 'rewritten_history' };
  await fixture.writeGraph(
    [validEntity],
    [mutated, firstCorrection],
    [runFor(baseClaim), runFor(firstCorrection)],
  );
  await fixture.stageAll();

  const committed = await fixture.git(['commit', '-m', 'attempt history rewrite']);

  assert.notEqual(committed.exitCode, 0);
  assert.match(committed.stderr, /GK151.*claim_11111111/);
});

test('canonical correction repositories distinguish a valid chain from fork and cycle failures', async (t) => {
  for (const scenario of [
    { name: 'valid-chain', exitCode: 0, pattern: /validation passed/ },
    { name: 'invalid-fork', exitCode: 1, pattern: /GK140.*claim_11111111.*claim_22222222.*claim_44444444/ },
    { name: 'invalid-cycle', exitCode: 1, pattern: /GK140.*cycle members:.*claim_11111111.*claim_22222222.*claim_33333333/ },
  ]) {
    await t.test(scenario.name, async (st) => {
      const fixture = await createValidatorFixture('graphkeeper-correction-repo-');
      st.after(fixture.cleanup);
      await cp(
        join(correctionFixtures, scenario.name, 'graph'),
        join(fixture.root, 'graph'),
        { recursive: true },
      );

      const result = await runValidator(fixture, '--worktree');

      assert.equal(result.exitCode, scenario.exitCode, result.stderr);
      assert.match(result.stdout + result.stderr, scenario.pattern);
    });
  }
});
