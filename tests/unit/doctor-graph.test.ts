import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectEvidenceReferences,
  evidenceFindings,
  inspectGraphReferences,
} from '../../src/commands/doctor.js';
import type { Claim, Entity, Run } from '../../src/lib/records.js';
import { validClaim, validEntity, validRun } from '../helpers/validator.js';

test('reports dangling entity, run, supersedes, and run-claim references', () => {
  const claim: Claim = {
    ...validClaim,
    source: { ...validClaim.source, kind: 'tool_output' },
    subject: 'missing_entity',
    produced_by: 'run_2026-07-21-missing',
    supersedes: 'claim_11111111',
  };
  const run: Run = {
    ...validRun,
    verdict: 'passed',
    claims_written: ['claim_22222222'],
  };

  const findings = inspectGraphReferences([validEntity], [claim], [run]);

  assert.deepEqual(findings.map((finding) => finding.code), [
    'GK320',
    'GK321',
    'GK322',
    'GK323',
    'GK390',
  ]);
});

test('reports a run listing a claim produced by a different run', () => {
  const otherRun: Run = {
    ...validRun,
    id: 'run_2026-07-21-other',
    verdict: 'passed',
    claims_written: [validClaim.id],
  };
  const producerRun: Run = { ...validRun, verdict: 'passed', claims_written: [] };

  const findings = inspectGraphReferences([validEntity], [{
    ...validClaim,
    source: { ...validClaim.source, kind: 'tool_output' },
  }], [producerRun, otherRun]);

  assert.ok(findings.some((finding) => finding.code === 'GK324' && finding.context === otherRun.id));
  assert.ok(findings.some((finding) => finding.code === 'GK325' && finding.context === validClaim.id));
});

test('collects claim and entity source-document evidence ownership', () => {
  const entity: Entity = {
    ...validEntity,
    source_docs: ['evidence/docs.log#L2-L3'],
  };
  const references = collectEvidenceReferences([entity], [{
    ...validClaim,
    source: { ...validClaim.source, kind: 'tool_output' },
  }]);

  assert.deepEqual(references, [
    { ownerKind: 'entity', ownerId: validEntity.id, reference: 'evidence/docs.log#L2-L3' },
    { ownerKind: 'claim', ownerId: validClaim.id, reference: validClaim.source.ref },
  ]);
});

test('turns a dangling source-doc inspection into a precise doctor error', () => {
  const findings = evidenceFindings(
    { ownerKind: 'entity', ownerId: validEntity.id, reference: 'evidence/docs.log#L2-L3' },
    {
      reference: 'evidence/docs.log#L2-L3',
      relativePath: 'evidence/docs.log',
      start: 2,
      end: 3,
      issues: [{ kind: 'missing', message: 'referenced evidence file does not exist' }],
    },
  );

  assert.deepEqual(findings, [{
    severity: 'error',
    code: 'GK311',
    context: 'entity:' + validEntity.id + ' evidence/docs.log#L2-L3',
    message: 'referenced evidence file does not exist',
  }]);
});

test('warns once for each entity that no claim uses', () => {
  const orphan: Entity = {
    id: 'orphan_component',
    type: 'component',
    aliases: [],
    first_seen: validEntity.first_seen,
  };

  const findings = inspectGraphReferences([validEntity, orphan], [{
    ...validClaim,
    source: { ...validClaim.source, kind: 'tool_output' },
  }], [{ ...validRun, verdict: 'passed' }]);

  assert.deepEqual(findings.filter((finding) => finding.severity === 'warning'), [{
    severity: 'warning',
    code: 'GK390',
    context: orphan.id,
    message: 'entity is not referenced by any claim',
  }]);
});
