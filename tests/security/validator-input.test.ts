import assert from 'node:assert/strict';
import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  createValidatorFixture,
  runValidator,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

test('validator never executes stored commands or evidence contents', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  const marker = join(fixture.root, 'SECURITY_MARKER');
  const command = 'touch SECURITY_MARKER; printf attacked';
  await fixture.writeGraph(
    [validEntity],
    [{ ...validClaim, source: { ...validClaim.source, command } }],
    [validRun],
  );
  await writeFile(join(fixture.root, 'evidence', 'triage.log'), command + '\n', 'utf8');

  const result = await runValidator(fixture, '--worktree');

  assert.equal(result.exitCode, 0, result.stderr);
  await assert.rejects(access(marker));
});

test('validator rejects traversal and whitespace in evidence references as data', async (t) => {
  const cases = [
    {
      entities: [validEntity],
      claims: [{ ...validClaim, source: { ...validClaim.source, ref: 'evidence/../secret#L1-L1' } }],
      runs: [{ ...validRun, evidence: ['evidence/../secret'] }],
      code: 'GK120',
    },
    {
      entities: [{ ...validEntity, source_docs: ['evidence/file name.log#L1-L2'] }],
      claims: [validClaim],
      runs: [validRun],
      code: 'GK110',
    },
    {
      entities: [validEntity],
      claims: [validClaim],
      runs: [{ ...validRun, evidence: ['evidence/../outside.log'] }],
      code: 'GK130',
    },
  ];

  for (const item of cases) {
    const fixture = await createValidatorFixture();
    try {
      await fixture.writeGraph(item.entities, item.claims, item.runs);
      const result = await runValidator(fixture, '--worktree');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, new RegExp(item.code));
    } finally {
      await fixture.cleanup();
    }
  }
});

test('fast validation checks evidence reference shape without dereferencing the file', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  const missingRef = 'evidence/not-captured-here.log#L999-L1000';
  await fixture.writeGraph(
    [validEntity],
    [{ ...validClaim, source: { ...validClaim.source, ref: missingRef } }],
    [{ ...validRun, evidence: ['evidence/not-captured-here.log'] }],
  );

  const result = await runValidator(fixture, '--worktree');

  assert.equal(result.exitCode, 0, result.stderr);
  await assert.rejects(access(join(fixture.root, 'evidence', 'not-captured-here.log')));
});

test('validator handles a repository root containing spaces without changing execution semantics', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper repo with spaces ');
  t.after(fixture.cleanup);
  await fixture.writeGraph();

  const result = await runValidator(fixture, '--worktree');

  assert.match(fixture.root, / /);
  assert.equal(result.exitCode, 0, result.stderr);
});
