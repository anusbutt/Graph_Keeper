import assert from 'node:assert/strict';
import test from 'node:test';

import { query } from '../../src/commands/query.js';
import type { Claim } from '../../src/lib/records.js';
import {
  createValidatorFixture,
  timestamp,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

function inferredClaim(
  id: string,
  predicate: string,
  object: string,
  created: string,
  supersedes?: string,
): Claim {
  return {
    ...validClaim,
    id,
    predicate,
    object,
    source: { kind: 'inference', basis: 'correction-chain fixture' },
    created,
    ...(supersedes === undefined ? {} : { supersedes }),
  };
}

test('query returns only the tip of every correction chain plus unsuperseded claims', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-query-corrections-');
  t.after(fixture.cleanup);
  const statusBase = inferredClaim('claim_11111111', 'has_status', 'failing', timestamp);
  const statusMiddle = inferredClaim(
    'claim_22222222',
    'has_status',
    'intermittent',
    '2026-07-21T09:15:22Z',
    statusBase.id,
  );
  const statusTip = inferredClaim(
    'claim_33333333',
    'has_status',
    'passing_with_utc_default',
    '2026-07-21T09:16:22Z',
    statusMiddle.id,
  );
  const ownerBase = inferredClaim(
    'claim_44444444',
    'has_owner',
    'payments_team',
    '2026-07-21T09:17:22Z',
  );
  const ownerTip = inferredClaim(
    'claim_55555555',
    'has_owner',
    'reliability_team',
    '2026-07-21T09:18:22Z',
    ownerBase.id,
  );
  const standalone = inferredClaim(
    'claim_66666666',
    'runs_in',
    'ci',
    '2026-07-21T09:19:22Z',
  );
  const claims = [statusMiddle, ownerBase, standalone, statusBase, ownerTip, statusTip];
  await fixture.writeGraph(
    [validEntity],
    claims,
    [{ ...validRun, claims_written: claims.map((claim) => claim.id) }],
  );

  const result = await query({ cwd: fixture.root, subject: validEntity.id });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /Active claims: 3/);
  for (const inactive of [statusBase, statusMiddle, ownerBase]) {
    assert.doesNotMatch(result.stdout, new RegExp(inactive.id));
  }
  for (const active of [statusTip, ownerTip, standalone]) {
    assert.match(result.stdout, new RegExp(active.id));
  }
  assert.ok(result.stdout.indexOf(statusTip.id) < result.stdout.indexOf(ownerTip.id));
  assert.ok(result.stdout.indexOf(ownerTip.id) < result.stdout.indexOf(standalone.id));
});

test('alias queries derive the same active chain tips without an active-status field', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-query-corrections-');
  t.after(fixture.cleanup);
  const oldClaim = inferredClaim('claim_aaaaaaaa', 'has_status', 'failing', timestamp);
  const tip = inferredClaim(
    'claim_bbbbbbbb',
    'has_status',
    'passing',
    '2026-07-21T09:15:22Z',
    oldClaim.id,
  );
  const claims = [oldClaim, tip];
  await fixture.writeGraph(
    [{ ...validEntity, aliases: ['payments correction alias'] }],
    claims,
    [{ ...validRun, claims_written: claims.map((claim) => claim.id) }],
  );

  const result = await query({ cwd: fixture.root, subject: 'payments correction alias' });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /Active claims: 1/);
  assert.doesNotMatch(result.stdout, new RegExp(oldClaim.id));
  assert.match(result.stdout, new RegExp(tip.id));
  assert.equal(Object.hasOwn(tip, 'active'), false);
});
