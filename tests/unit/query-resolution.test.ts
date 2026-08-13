import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatQueryOutput,
  resolveEntity,
  selectActiveClaims,
} from '../../src/commands/query.js';
import type { Claim, Entity } from '../../src/lib/records.js';

const entities: Entity[] = [
  {
    id: 'payments_api',
    type: 'service',
    aliases: ['Payments API', 'checkout'],
    first_seen: '2026-07-21T09:14:22Z',
  },
  {
    id: 'checkout_worker',
    type: 'worker',
    aliases: ['checkout', 'Checkout Worker'],
    first_seen: '2026-07-21T09:15:22Z',
  },
  {
    id: 'alias_shadow',
    type: 'service',
    aliases: ['payments_api'],
    first_seen: '2026-07-21T09:16:22Z',
  },
];

test('canonical entity ID resolves exactly and wins over an alias collision', () => {
  const result = resolveEntity(entities, 'payments_api');

  assert.equal(result.kind, 'resolved');
  if (result.kind === 'resolved') {
    assert.equal(result.entity.id, 'payments_api');
    assert.equal(result.matchedBy, 'id');
  }
});

test('an exact unique alias resolves to its canonical entity', () => {
  const result = resolveEntity(entities, 'Payments API');

  assert.equal(result.kind, 'resolved');
  if (result.kind === 'resolved') {
    assert.equal(result.entity.id, 'payments_api');
    assert.equal(result.matchedBy, 'alias');
  }
});

test('a shared exact alias is ambiguous with sorted candidate IDs', () => {
  const result = resolveEntity(entities, 'checkout');

  assert.deepEqual(result, {
    kind: 'ambiguous',
    subject: 'checkout',
    candidateIds: ['checkout_worker', 'payments_api'],
  });
});

test('unknown and inexact subjects are not guessed', () => {
  assert.deepEqual(resolveEntity(entities, 'unknown'), { kind: 'not_found', subject: 'unknown' });
  assert.deepEqual(resolveEntity(entities, 'payments api'), { kind: 'not_found', subject: 'payments api' });
  assert.deepEqual(resolveEntity(entities, 'PAYMENTS_API'), { kind: 'not_found', subject: 'PAYMENTS_API' });
});

test('a known entity with no active claims has a distinct successful empty output', () => {
  const resolution = resolveEntity(entities, 'Checkout Worker');
  assert.equal(resolution.kind, 'resolved');
  if (resolution.kind !== 'resolved') return;

  const output = formatQueryOutput(resolution, []);

  assert.match(output, /^Entity: checkout_worker$/m);
  assert.match(output, /^Matched by alias: "Checkout Worker"$/m);
  assert.match(output, /^Active claims: 0$/m);
  assert.match(output, /^No active claims\.$/m);
});

test('active claim selection mirrors global supersession and stable ordinal ordering', () => {
  const claims: Claim[] = [
    {
      id: 'claim_cccccccc',
      subject: 'payments_api',
      predicate: 'has_state',
      object: 'third',
      source: { kind: 'inference', basis: 'fixture' },
      produced_by: 'run_2026-07-21-query_cc',
      created: '2026-07-21T09:16:22Z',
    },
    {
      id: 'claim_aaaaaaaa',
      subject: 'payments_api',
      predicate: 'has_state',
      object: 'obsolete',
      source: { kind: 'inference', basis: 'fixture' },
      produced_by: 'run_2026-07-21-query_aa',
      created: '2026-07-21T09:14:22Z',
    },
    {
      id: 'claim_dddddddd',
      subject: 'other_subject',
      predicate: 'replaces_state',
      object: 'replacement',
      source: { kind: 'inference', basis: 'fixture' },
      produced_by: 'run_2026-07-21-query_dd',
      supersedes: 'claim_aaaaaaaa',
      created: '2026-07-21T09:17:22Z',
    },
    {
      id: 'claim_bbbbbbbb',
      subject: 'payments_api',
      predicate: 'has_state',
      object: 'second',
      source: { kind: 'inference', basis: 'fixture' },
      produced_by: 'run_2026-07-21-query_bb',
      created: '2026-07-21T09:15:22Z',
    },
  ];
  const before = JSON.stringify(claims);

  const selected = selectActiveClaims(claims, 'payments_api');

  assert.deepEqual(selected.map((claim) => claim.id), ['claim_bbbbbbbb', 'claim_cccccccc']);
  assert.equal(JSON.stringify(claims), before);
});
