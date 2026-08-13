import assert from 'node:assert/strict';
import test from 'node:test';

import { query } from '../../src/commands/query.js';
import type { Claim, Entity, Run } from '../../src/lib/records.js';
import {
  createValidatorFixture,
  timestamp,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

const entity: Entity = {
  ...validEntity,
  aliases: ['Payments Test', 'payments'],
};

const oldClaim: Claim = {
  ...validClaim,
  source: { ...validClaim.source, kind: 'tool_output' },
  id: 'claim_11111111',
  object: 'failing',
  created: '2026-07-21T09:14:22Z',
};

const inferredClaim: Claim = {
  ...validClaim,
  id: 'claim_33333333',
  predicate: 'likely_cause',
  object: 'timezone mismatch',
  source: { kind: 'inference', basis: 'failure starts after midnight UTC' },
  created: '2026-07-21T09:15:22Z',
};

const correctedClaim: Claim = {
  ...validClaim,
  source: { ...validClaim.source, kind: 'tool_output' },
  id: 'claim_22222222',
  object: 'passing with UTC default',
  supersedes: oldClaim.id,
  created: '2026-07-21T09:16:22Z',
};

const run: Run = {
  ...validRun,
  verdict: 'passed',
  claims_written: [oldClaim.id, inferredClaim.id, correctedClaim.id],
};

test('query returns only active claims in created/id order with complete provenance', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph([entity], [correctedClaim, oldClaim, inferredClaim], [run]);

  const result = await query({ cwd: fixture.root, subject: entity.id });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.doesNotMatch(result.stdout, /claim_11111111/);
  assert.ok(result.stdout.indexOf(inferredClaim.id) < result.stdout.indexOf(correctedClaim.id));
  assert.match(result.stdout, /Claim: claim_33333333[\s\S]*Source: inference[\s\S]*Basis: "failure starts after midnight UTC"/);
  assert.match(result.stdout, /Claim: claim_22222222[\s\S]*Source: tool_output/);
  assert.match(result.stdout, /Command: "npm test"/);
  assert.match(result.stdout, /Exit code: 1/);
  assert.match(result.stdout, /Evidence: evidence\/triage\.log#L1-L2/);
  assert.match(result.stdout, new RegExp('Captured: ' + timestamp));
  assert.match(result.stdout, new RegExp('Producer: ' + validRun.id));
  assert.match(result.stdout, /Created: 2026-07-21T09:16:22Z/);
});

test('query uses claim ID as a stable secondary sort key', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  const laterId = { ...inferredClaim, id: 'claim_bbbbbbbb', created: timestamp };
  const earlierId = { ...inferredClaim, id: 'claim_aaaaaaaa', created: timestamp };
  const sortingRun = {
    ...run,
    claims_written: [laterId.id, earlierId.id],
  };
  await fixture.writeGraph([entity], [laterId, earlierId], [sortingRun]);

  const result = await query({ cwd: fixture.root, subject: entity.id });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.ok(result.stdout.indexOf(earlierId.id) < result.stdout.indexOf(laterId.id));
});

test('query returns validator failures before attempting claim selection', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph([entity], [{ ...validClaim, predicate: 'Not Snake' }], [validRun]);

  const result = await query({ cwd: fixture.root, subject: entity.id });

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /GK120/);
  assert.equal(result.stdout, '');
});

test('query maps jq selection timeout to an operational error', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph([entity], [validClaim], [validRun]);

  const result = await query({
    cwd: fixture.root,
    subject: entity.id,
    timeoutMs: 321,
    runner: async (command) => command === process.execPath
      ? { exitCode: 0, stdout: 'GraphKeeper: validation passed\n', stderr: '' }
      : { exitCode: null, stdout: '', stderr: '', problem: 'timeout' },
  });

  assert.equal(result.exitCode, 4);
  assert.match(result.stderr, /GK004 query selection timed out after 321 ms/);
});

test('query uses a fifteen-second default timeout for validation and selection', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph([entity], [validClaim], [validRun]);
  const observedTimeouts: number[] = [];

  const result = await query({
    cwd: fixture.root,
    subject: entity.id,
    runner: async (command, _args, options) => {
      observedTimeouts.push(options.timeoutMs ?? -1);
      return command === process.execPath
        ? { exitCode: 0, stdout: 'GraphKeeper: validation passed\n', stderr: '' }
        : { exitCode: 0, stdout: JSON.stringify([validClaim]), stderr: '' };
    },
  });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.deepEqual(observedTimeouts, [15_000, 15_000]);
});

test('query applies its timeout to validation and never selects after validation timeout', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph([entity], [validClaim], [validRun]);
  const commands: string[] = [];

  const result = await query({
    cwd: fixture.root,
    subject: entity.id,
    timeoutMs: 432,
    runner: async (command) => {
      commands.push(command);
      return { exitCode: null, stdout: '', stderr: '', problem: 'timeout' };
    },
  });

  assert.equal(result.exitCode, 4);
  assert.match(result.stderr, /GK004 validator timed out after 432 ms/);
  assert.deepEqual(commands, [process.execPath]);
});

test('query maps a missing jq selector to the prerequisite exit code', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph([entity], [validClaim], [validRun]);

  const result = await query({
    cwd: fixture.root,
    subject: entity.id,
    runner: async (command) => command === process.execPath
      ? { exitCode: 0, stdout: 'GraphKeeper: validation passed\n', stderr: '' }
      : { exitCode: null, stdout: '', stderr: '', problem: 'missing' },
  });

  assert.equal(result.exitCode, 3);
  assert.match(result.stderr, /GK003 jq 1\.6 or newer is required/);
});
