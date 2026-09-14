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

test('validator rejects traversal, absolute, mixed-separator, drive, UNC, and whitespace evidence paths', async (t) => {
  const unsafePaths = [
    'evidence/../outside.log',
    'evidence/nested\\..\\outside.log',
    'evidence/nested\\file.log',
    '/absolute/outside.log',
    'C:\\absolute\\outside.log',
    '\\\\server\\share\\outside.log',
    'evidence/C:/absolute/outside.log',
    'evidence/\\\\server\\share\\outside.log',
    'evidence/file name.log',
  ];

  for (const evidencePath of unsafePaths) {
    const fixture = await createValidatorFixture();
    try {
      const reference = evidencePath + '#L1-L1';
      await fixture.writeGraph(
        [{ ...validEntity, source_docs: [reference] }],
        [{ ...validClaim, source: { ...validClaim.source, ref: reference } }],
        [{ ...validRun, evidence: [evidencePath] }],
      );
      const result = await runValidator(fixture, '--worktree');
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /GK110/, evidencePath);
      assert.match(result.stderr, /GK120/, evidencePath);
      assert.match(result.stderr, /GK130/, evidencePath);
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
