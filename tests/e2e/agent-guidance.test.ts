import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  parseClaims,
  parseEntities,
  parseRuns,
  type Claim,
  type Entity,
} from '../../src/lib/records.js';
import { createValidatorFixture, runValidator } from '../helpers/validator.js';

const fixtureRoot = new URL('../../../tests/fixtures/agent-guidance/', import.meta.url);

interface GuidanceCase {
  readonly id: string;
  readonly input: string;
  readonly expected_action: string;
  readonly entity_id?: string;
  readonly claim_id?: string;
  readonly claim_ids?: readonly string[];
  readonly observed_claim_id?: string;
  readonly inference_claim_id?: string;
  readonly evidence_path?: string;
}

async function readJson(relativePath: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(relativePath, fixtureRoot), 'utf8'));
}

function caseById(cases: readonly GuidanceCase[], id: string): GuidanceCase {
  const found = cases.find((entry) => entry.id === id);
  assert.ok(found, 'missing guidance case ' + id);
  return found;
}

function claimById(claims: readonly Claim[], id: string | undefined): Claim {
  assert.ok(id);
  const found = claims.find((claim) => claim.id === id);
  assert.ok(found, 'missing expected claim ' + id);
  return found;
}

function entityById(entities: readonly Entity[], id: string | undefined): Entity {
  assert.ok(id);
  const found = entities.find((entity) => entity.id === id);
  assert.ok(found, 'missing expected entity ' + id);
  return found;
}

test('guidance fixtures cover all eight required agent decisions', async () => {
  const cases = await readJson('cases.json') as GuidanceCase[];
  assert.deepEqual(
    cases.map((entry) => entry.id).sort(),
    [
      'compound_finding',
      'existing_alias',
      'fact_vs_inference',
      'inference',
      'new_entity',
      'session_chatter',
      'structured_evidence',
      'tool_output',
    ],
  );
});

test('compound findings become independently changeable claims', async () => {
  const cases = await readJson('cases.json') as GuidanceCase[];
  const claims = parseClaims(await readJson('expected/graph/claims.json'));
  const compound = caseById(cases, 'compound_finding');
  assert.equal(compound.expected_action, 'split_atomic_claims');
  assert.deepEqual(compound.claim_ids, ['claim_2b3c4d5e', 'claim_3c4d5e6f']);

  const atomicClaims = compound.claim_ids?.map((id) => claimById(claims, id)) ?? [];
  assert.deepEqual(
    atomicClaims.map(({ predicate, object }) => ({ predicate, object })),
    [
      { predicate: 'has_timeout_duration', object: '5000_ms' },
      { predicate: 'has_attempt_count', object: '3' },
    ],
  );
  assert.equal(new Set(atomicClaims.map((claim) => claim.id)).size, 2);
});

test('direct observation and interpretation use separate source kinds', async () => {
  const cases = await readJson('cases.json') as GuidanceCase[];
  const claims = parseClaims(await readJson('expected/graph/claims.json'));
  const separated = caseById(cases, 'fact_vs_inference');
  const observed = claimById(claims, separated.observed_claim_id);
  const inferred = claimById(claims, separated.inference_claim_id);

  assert.equal(observed.source.kind, 'tool_output');
  assert.equal(observed.confidence, 1);
  assert.equal(inferred.source.kind, 'inference');
  assert.notEqual(inferred.confidence, 1);
  if (inferred.source.kind === 'inference') {
    assert.match(inferred.source.basis, /observed retry pattern.*dependency latency/i);
  }
});

test('every expected claim is linked bidirectionally to its producing run', async () => {
  const claims = parseClaims(await readJson('expected/graph/claims.json'));
  const runs = parseRuns(await readJson('expected/graph/runs.json'));
  assert.equal(runs.length, 1);
  const run = runs[0];
  assert.ok(run);
  assert.deepEqual(new Set(run.claims_written), new Set(claims.map((claim) => claim.id)));
  for (const claim of claims) {
    assert.equal(claim.produced_by, run.id);
    if (claim.source.kind === 'tool_output') {
      assert.ok(run.evidence.includes(claim.source.ref.split('#', 1)[0] ?? ''));
    }
  }
});

test('expected graph reuses an exact alias and creates only the genuinely new entity', async () => {
  const cases = await readJson('cases.json') as GuidanceCase[];
  const entities = parseEntities(await readJson('expected/graph/entities.json'));
  const claims = parseClaims(await readJson('expected/graph/claims.json'));

  const aliasCase = caseById(cases, 'existing_alias');
  const reused = entityById(entities, aliasCase.entity_id);
  assert.ok(reused.aliases.includes(aliasCase.input));
  assert.equal(entities.filter((entity) => entity.id === reused.id).length, 1);
  assert.ok(claims.some((claim) => claim.subject === reused.id));

  const newCase = caseById(cases, 'new_entity');
  const created = entityById(entities, newCase.entity_id);
  assert.equal(created.id, 'service_api_timeout');
  assert.match(created.id, /^[a-z0-9]+(?:_[a-z0-9]+)*$/);
});

test('expected claims distinguish tool output from inference exactly', async () => {
  const cases = await readJson('cases.json') as GuidanceCase[];
  const claims = parseClaims(await readJson('expected/graph/claims.json'));

  const toolClaim = claimById(claims, caseById(cases, 'tool_output').claim_id);
  assert.equal(toolClaim.source.kind, 'tool_output');
  if (toolClaim.source.kind === 'tool_output') {
    assert.equal(toolClaim.source.command, 'npm test -- payments');
    assert.equal(toolClaim.source.exit_code, 1);
    assert.match(toolClaim.source.ref, /^evidence\/.+#L[0-9]+-L[0-9]+$/);
  }

  const inferenceClaim = claimById(claims, caseById(cases, 'inference').claim_id);
  assert.equal(inferenceClaim.source.kind, 'inference');
  assert.deepEqual(Object.keys(inferenceClaim.source).sort(), ['basis', 'kind']);
});

test('structured diagnostics remain in evidence while claim objects stay flat', async () => {
  const cases = await readJson('cases.json') as GuidanceCase[];
  const claims = parseClaims(await readJson('expected/graph/claims.json'));
  const structured = caseById(cases, 'structured_evidence');
  const claim = claimById(claims, structured.claim_id);
  const evidence = await readFile(
    new URL('expected/' + structured.evidence_path, fixtureRoot),
    'utf8',
  );
  assert.equal(typeof claim.object, 'string');
  assert.doesNotMatch(JSON.stringify(claim), /retry_delays_ms/);
  assert.match(evidence, /retry_delays_ms/);
});

test('session chatter remains outside expected durable graph and evidence', async () => {
  const cases = await readJson('cases.json') as GuidanceCase[];
  const chatter = caseById(cases, 'session_chatter');
  assert.equal(chatter.expected_action, 'exclude_to_progress_notes');
  const durable = [
    JSON.stringify(await readJson('expected/graph/entities.json')),
    JSON.stringify(await readJson('expected/graph/claims.json')),
    JSON.stringify(await readJson('expected/graph/runs.json')),
    await readFile(new URL('expected/evidence/agent-guidance.log', fixtureRoot), 'utf8'),
  ].join('\n');
  assert.doesNotMatch(durable, new RegExp(chatter.input, 'i'));
});

test('complete expected output passes record parsers and the canonical validator', async () => {
  const entities = parseEntities(await readJson('expected/graph/entities.json'));
  const claims = parseClaims(await readJson('expected/graph/claims.json'));
  const runs = parseRuns(await readJson('expected/graph/runs.json'));
  const evidence = await readFile(
    new URL('expected/evidence/agent-guidance.log', fixtureRoot),
    'utf8',
  );
  const fixture = await createValidatorFixture();
  try {
    await fixture.writeGraph(entities, claims, runs);
    await mkdir(join(fixture.root, 'evidence'), { recursive: true });
    await writeFile(
      join(fixture.root, 'evidence', 'agent-guidance.log'),
      evidence,
      'utf8',
    );
    const result = await runValidator(fixture, '--worktree');
    assert.equal(result.exitCode, 0, result.stderr);
  } finally {
    await fixture.cleanup();
  }
});
