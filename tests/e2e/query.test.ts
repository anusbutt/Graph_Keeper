import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runProcess } from '../../src/lib/process.js';
import type { Claim, Entity, Run } from '../../src/lib/records.js';
import {
  createValidatorFixture,
  timestamp,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

const cliPath = fileURLToPath(new URL('../../src/cli.js', import.meta.url));

async function runQuery(root: string, subject: string) {
  return runProcess(process.execPath, [cliPath, 'query', subject], {
    cwd: root,
    env: process.env,
    timeoutMs: 15_000,
  });
}

const primary: Entity = {
  ...validEntity,
  aliases: ['Payments Test', 'shared alias'],
};
const secondary: Entity = {
  id: 'payments_worker',
  type: 'worker',
  aliases: ['shared alias'],
  first_seen: timestamp,
};
const empty: Entity = {
  id: 'empty_subject',
  type: 'component',
  aliases: ['Nothing Known'],
  first_seen: timestamp,
};
const obsolete: Claim = {
  ...validClaim,
  source: { ...validClaim.source, kind: 'tool_output' },
  id: 'claim_11111111',
  object: 'failing',
};
const inference: Claim = {
  ...validClaim,
  id: 'claim_22222222',
  predicate: 'likely_cause',
  object: 'timezone mismatch',
  source: { kind: 'inference', basis: 'failures align with midnight UTC' },
  created: '2026-07-21T09:15:22Z',
};
const correction: Claim = {
  ...validClaim,
  source: { ...validClaim.source, kind: 'tool_output' },
  id: 'claim_33333333',
  object: 'passing with UTC default',
  supersedes: obsolete.id,
  created: '2026-07-21T09:16:22Z',
};
const run: Run = {
  ...validRun,
  verdict: 'passed',
  claims_written: [obsolete.id, inference.id, correction.id],
};

test('query acceptance matrix covers canonical ID, exact alias, corrections, and mixed sources', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph([primary, secondary, empty], [obsolete, correction, inference], [run]);

  const canonical = await runQuery(fixture.root, primary.id);
  const alias = await runQuery(fixture.root, 'Payments Test');

  assert.equal(canonical.exitCode, 0, canonical.stderr);
  assert.equal(alias.exitCode, 0, alias.stderr);
  assert.match(canonical.stdout, /Matched by: canonical ID/);
  assert.match(alias.stdout, /Matched by alias: "Payments Test"/);
  for (const result of [canonical, alias]) {
    assert.match(result.stdout, /Active claims: 2/);
    assert.doesNotMatch(result.stdout, /claim_11111111/);
    assert.match(result.stdout, /Claim: claim_22222222[\s\S]*Source: inference/);
    assert.match(result.stdout, /Claim: claim_33333333[\s\S]*Source: tool_output/);
    assert.match(result.stdout, /Evidence: evidence\/triage\.log#L1-L2/);
  }
});

test('query acceptance matrix distinguishes ambiguity, unknown subjects, and known empty entities', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph([primary, secondary, empty], [obsolete, correction, inference], [run]);

  const ambiguous = await runQuery(fixture.root, 'shared alias');
  const unknown = await runQuery(fixture.root, 'not recorded');
  const noClaims = await runQuery(fixture.root, empty.id);

  assert.equal(ambiguous.exitCode, 1);
  assert.match(ambiguous.stderr, /GK201 \[shared alias\].*payments_worker, test_payments_flaky/);
  assert.doesNotMatch(ambiguous.stdout, /Claim:/);
  assert.equal(unknown.exitCode, 1);
  assert.match(unknown.stderr, /GK202 \[not recorded\] no entity found/);
  assert.doesNotMatch(unknown.stdout, /Claim:/);
  assert.equal(noClaims.exitCode, 0, noClaims.stderr);
  assert.match(noClaims.stdout, /Entity: empty_subject/);
  assert.match(noClaims.stdout, /Active claims: 0/);
  assert.match(noClaims.stdout, /No active claims\./);
});

test('query CLI rejects missing, empty, and multiple subjects as usage errors', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph();

  for (const args of [[], [''], ['one', 'two']]) {
    const result = await runProcess(process.execPath, [cliPath, 'query', ...args], {
      cwd: fixture.root,
      env: process.env,
      timeoutMs: 10_000,
    });
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /GK002 query requires exactly one non-empty subject/);
  }
});
