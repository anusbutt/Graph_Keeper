import assert from 'node:assert/strict';
import { cp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { check } from '../../src/commands/check.js';
import { doctor } from '../../src/commands/doctor.js';
import { query } from '../../src/commands/query.js';
import {
  parseClaims,
  parseEntities,
  parseRuns,
  type Claim,
} from '../../src/lib/records.js';
import { createValidatorFixture } from '../helpers/validator.js';

const exampleRoot = fileURLToPath(
  new URL('../../../examples/worked-example/', import.meta.url),
);
const reviewerCasesPath = fileURLToPath(
  new URL('../../../tests/fixtures/reviewer/cases.json', import.meta.url),
);

interface ReviewerCase {
  readonly id: string;
  readonly statement: string;
  readonly candidate_claim_id?: string;
  readonly expected_decision: 'APPROVE' | 'REVISE';
  readonly expected_claim_ids: readonly string[];
  readonly expected_output: string;
}

async function copyExample(root: string): Promise<void> {
  await cp(join(exampleRoot, 'graph'), join(root, 'graph'), { recursive: true });
  await cp(join(exampleRoot, 'evidence'), join(root, 'evidence'), { recursive: true });
}

async function readExampleGraph(): Promise<{
  entities: ReturnType<typeof parseEntities>;
  claims: ReturnType<typeof parseClaims>;
  runs: ReturnType<typeof parseRuns>;
}> {
  return {
    entities: parseEntities(JSON.parse(
      await readFile(join(exampleRoot, 'graph', 'entities.json'), 'utf8'),
    ) as unknown),
    claims: parseClaims(JSON.parse(
      await readFile(join(exampleRoot, 'graph', 'claims.json'), 'utf8'),
    ) as unknown),
    runs: parseRuns(JSON.parse(
      await readFile(join(exampleRoot, 'graph', 'runs.json'), 'utf8'),
    ) as unknown),
  };
}

function activeClaimIds(claims: readonly Claim[]): Set<string> {
  const superseded = new Set(
    claims.flatMap((claim) => claim.supersedes === undefined ? [] : [claim.supersedes]),
  );
  return new Set(claims.filter((claim) => !superseded.has(claim.id)).map((claim) => claim.id));
}

function evaluateFixture(caseItem: ReviewerCase, claims: readonly Claim[]): string {
  const candidate = claims.find((claim) => claim.id === caseItem.candidate_claim_id);
  const active = activeClaimIds(claims);
  let reason: string;

  if (candidate === undefined) {
    reason = 'no matching active claim';
  } else if (!active.has(candidate.id)) {
    reason = 'only matching claim is superseded';
  } else if (candidate.source.kind !== 'tool_output') {
    reason = 'support is inference-only';
  } else {
    return `APPROVE\n- "${caseItem.statement}" — ${candidate.id}`;
  }
  return `REVISE\n- "${caseItem.statement}" — missing active tool-output external evidence: ${reason}`;
}

test('worked example passes check and doctor, then queries only active claims', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-worked-example-');
  t.after(fixture.cleanup);
  await copyExample(fixture.root);

  const validation = await check({ cwd: fixture.root });
  const diagnosis = await doctor({ cwd: fixture.root });
  const queried = await query({ cwd: fixture.root, subject: 'payments test' });

  assert.equal(validation.exitCode, 0, validation.stderr);
  assert.match(validation.stdout, /GraphKeeper: validation passed/);
  assert.equal(diagnosis.exitCode, 0, diagnosis.stderr);
  assert.match(diagnosis.stdout, /Summary: 0 error\(s\), 0 warning\(s\)/);
  assert.equal(queried.exitCode, 0, queried.stderr);
  assert.match(queried.stdout, /Matched by alias: "payments test"/);
  assert.match(queried.stdout, /Active claims: 2/);
  assert.doesNotMatch(queried.stdout, /claim_11111111/);
  assert.match(queried.stdout, /claim_22222222/);
  assert.match(queried.stdout, /claim_33333333/);
});

test('every worked-example claim traces bidirectionally to its run and exact evidence', async () => {
  const { entities, claims, runs } = await readExampleGraph();
  assert.equal(entities.length, 1);
  const runById = new Map(runs.map((run) => [run.id, run]));

  for (const claim of claims) {
    const run = runById.get(claim.produced_by);
    assert.ok(run, `missing producer ${claim.produced_by}`);
    assert.ok(run.claims_written.includes(claim.id), `run does not list ${claim.id}`);
    if (claim.source.kind !== 'tool_output') continue;

    const match = /^(evidence\/[^#]+)#L([0-9]+)-L([0-9]+)$/.exec(claim.source.ref);
    assert.ok(match);
    const evidencePath = match[1] as string;
    assert.ok(run.evidence.includes(evidencePath));
    const lines = (await readFile(join(exampleRoot, evidencePath), 'utf8'))
      .trimEnd()
      .split(/\r?\n/);
    const start = Number(match[2]);
    const end = Number(match[3]);
    assert.equal(lines.slice(start - 1, end).length, end - start + 1);
  }

  const correction = claims.find((claim) => claim.id === 'claim_22222222');
  assert.equal(correction?.supersedes, 'claim_11111111');
  assert.equal(correction?.source.kind, 'tool_output');
  if (correction?.source.kind === 'tool_output') {
    const evidence = await readFile(join(exampleRoot, 'evidence', 'utc-rerun.log'), 'utf8');
    assert.match(evidence, /TZ=UTC/);
    assert.match(evidence, /payments test: passed/);
  }
});

test('reviewer fixtures approve only active tool-output support and revise every other case', async () => {
  const { claims } = await readExampleGraph();
  const cases = JSON.parse(await readFile(reviewerCasesPath, 'utf8')) as ReviewerCase[];
  assert.deepEqual(cases.map((item) => item.id), [
    'supported',
    'inference_only',
    'unsupported',
    'superseded',
  ]);

  for (const caseItem of cases) {
    const observed = evaluateFixture(caseItem, claims);
    assert.equal(observed, caseItem.expected_output, caseItem.id);
    assert.equal(observed.split('\n', 1)[0], caseItem.expected_decision);
    for (const claimId of caseItem.expected_claim_ids) {
      assert.match(observed, new RegExp(claimId));
    }
    if (caseItem.expected_decision === 'REVISE') {
      assert.deepEqual(caseItem.expected_claim_ids, []);
      assert.match(observed, new RegExp(caseItem.statement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.doesNotMatch(observed, /— claim_[0-9a-f]{8}$/);
    }
  }
});

test('worked-example walkthrough covers setup, query, evidence, correction, and review', async () => {
  const readme = await readFile(join(exampleRoot, 'README.md'), 'utf8');
  for (const heading of [
    'Setup',
    'Query the durable subject',
    'Trace the evidence',
    'Understand the correction',
    'Apply the grounded reviewer',
  ]) {
    assert.match(readme, new RegExp('^## ' + heading + '$', 'm'));
  }
  for (const command of ['check', 'doctor', 'query test_payments_flaky']) {
    assert.match(readme, new RegExp(command));
  }
  for (const claimId of ['claim_11111111', 'claim_22222222', 'claim_33333333']) {
    assert.match(readme, new RegExp(claimId));
  }
  assert.match(readme, /APPROVE.*claim_22222222/is);
  assert.match(readme, /Inference-only.*REVISE/is);
  assert.match(readme, /Unsupported.*REVISE/is);
  assert.match(readme, /Superseded.*REVISE/is);
});
