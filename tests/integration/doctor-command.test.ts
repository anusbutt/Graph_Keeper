import assert from 'node:assert/strict';
import test from 'node:test';

import { doctor } from '../../src/commands/doctor.js';
import {
  createValidatorFixture,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

test('doctor reports a healthy valid graph with separate zero counts', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph();

  const result = await doctor({ cwd: fixture.root });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Warnings \(0\):/);
  assert.match(result.stdout, /Summary: 0 error\(s\), 0 warning\(s\)/);
  assert.match(result.stdout, /doctor healthy/);
});

test('warning-only doctor result succeeds and identifies orphan entities', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  const orphan = {
    id: 'unused_component',
    type: 'component',
    aliases: [],
    first_seen: validEntity.first_seen,
  };
  await fixture.writeGraph([validEntity, orphan], [validClaim], [validRun]);

  const result = await doctor({ cwd: fixture.root });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /GK390 \[unused_component\]/);
  assert.match(result.stdout, /Summary: 0 error\(s\), 1 warning\(s\)/);
});

test('doctor accumulates multiple evidence errors and warnings with separate counts', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  const orphan = {
    id: 'unused_component',
    type: 'component',
    aliases: [],
    source_docs: ['evidence/missing-doc.log#L1-L1'],
    first_seen: validEntity.first_seen,
  };
  const claim = {
    ...validClaim,
    source: { ...validClaim.source, ref: 'evidence/triage.log#L1-L9' },
  };
  await fixture.writeGraph([validEntity, orphan], [claim], [validRun]);

  const result = await doctor({ cwd: fixture.root });

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /Errors \(2\):/);
  assert.match(result.stderr, /GK311 \[entity:unused_component evidence\/missing-doc\.log#L1-L1\]/);
  assert.match(result.stderr, /GK316 \[claim:claim_a1b2c3d4 evidence\/triage\.log#L1-L9\]/);
  assert.match(result.stdout, /GK390 \[unused_component\]/);
  assert.match(result.stdout, /Summary: 2 error\(s\), 1 warning\(s\)/);
});

test('doctor retains canonical validator failures and still emits a summary', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph([validEntity], [{ ...validClaim, predicate: 'Not Snake' }], [validRun]);

  const result = await doctor({ cwd: fixture.root });

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /GK120/);
  assert.match(result.stdout, /Summary: 1 error\(s\), 0 warning\(s\)/);
});

test('doctor maps validator timeout to operational failure without deep reads', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph();
  const commands: string[] = [];

  const result = await doctor({
    cwd: fixture.root,
    timeoutMs: 654,
    runner: async (command) => {
      commands.push(command);
      return { exitCode: null, stdout: '', stderr: '', problem: 'timeout' };
    },
  });

  assert.equal(result.exitCode, 4);
  assert.match(result.stderr, /GK004 validator timed out after 654 ms/);
  assert.deepEqual(commands, [process.execPath]);
});
