import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RecordValidationError,
  parseClaims,
  parseEntities,
  parseRuns,
} from '../../src/lib/records.js';
import {
  createValidatorFixture,
  runValidator,
  timestamp,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

test('canonical validator records are readable by the TypeScript parsers', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-parser-parity-');
  t.after(fixture.cleanup);

  const inferenceClaim = {
    id: 'claim_1a2b3c4d',
    subject: validEntity.id,
    predicate: 'likely_status',
    object: 'still_flaky',
    source: {
      kind: 'inference',
      basis: 'The latest durable result has not been superseded.',
    },
    produced_by: validRun.id,
    created: timestamp,
  };
  const openRun = {
    id: validRun.id,
    started: validRun.started,
    tool: validRun.tool,
    task: 'review durable status',
    evidence: [],
    claims_written: [inferenceClaim.id],
  };
  const minimalEntity = {
    id: validEntity.id,
    type: validEntity.type,
    aliases: [],
    first_seen: validEntity.first_seen,
  };

  const acceptedGraphs = [
    {
      name: 'tool-output claim with a closed run and optional fields',
      entities: [validEntity],
      claims: [validClaim],
      runs: [validRun],
    },
    {
      name: 'inference claim with an open run and minimal entity',
      entities: [minimalEntity],
      claims: [inferenceClaim],
      runs: [openRun],
    },
  ] as const;

  for (const graph of acceptedGraphs) {
    await t.test(graph.name, async () => {
      await fixture.writeGraph(graph.entities, graph.claims, graph.runs);

      const validation = await runValidator(fixture, '--worktree');

      assert.equal(validation.exitCode, 0, validation.stderr);
      assert.deepEqual(parseEntities(graph.entities), graph.entities);
      assert.deepEqual(parseClaims(graph.claims), graph.claims);
      assert.deepEqual(parseRuns(graph.runs), graph.runs);
    });
  }
});

test('canonical validator and TypeScript parsers reject the same record-shape boundaries', async (t) => {
  const mixedInferenceClaim = {
    ...validClaim,
    source: {
      kind: 'inference',
      basis: 'Reasoning only.',
      ref: 'evidence/triage.log#L1-L2',
    },
  };
  const runWithoutVerdict = {
    id: validRun.id,
    started: validRun.started,
    tool: validRun.tool,
    evidence: validRun.evidence,
    claims_written: validRun.claims_written,
    ended: validRun.ended,
  };
  const entityWithUnknownField = { ...validEntity, unexpected: true };
  const cases = [
    {
      name: 'unknown entity field',
      code: 'GK110',
      entities: [entityWithUnknownField],
      claims: [validClaim],
      runs: [validRun],
      parse: () => parseEntities([entityWithUnknownField]),
    },
    {
      name: 'mixed inference source fields',
      code: 'GK120',
      entities: [validEntity],
      claims: [mixedInferenceClaim],
      runs: [validRun],
      parse: () => parseClaims([mixedInferenceClaim]),
    },
    {
      name: 'run ending without a verdict',
      code: 'GK130',
      entities: [validEntity],
      claims: [validClaim],
      runs: [runWithoutVerdict],
      parse: () => parseRuns([runWithoutVerdict]),
    },
  ] as const;

  for (const parityCase of cases) {
    await t.test(parityCase.name, async (st) => {
      const fixture = await createValidatorFixture('graphkeeper-parser-parity-');
      st.after(fixture.cleanup);
      await fixture.writeGraph(parityCase.entities, parityCase.claims, parityCase.runs);

      const validation = await runValidator(fixture, '--worktree');

      assert.equal(validation.exitCode, 1);
      assert.match(validation.stderr, new RegExp(parityCase.code));
      assert.throws(parityCase.parse, RecordValidationError);
    });
  }
});
