import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { doctor } from '../../src/commands/doctor.js';
import {
  createValidatorFixture,
  runValidator,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

test('release security gate rejects traversal and evidence symlink escape', async (t) => {
  const traversal = await createValidatorFixture();
  t.after(traversal.cleanup);
  const outsideMarker = join(traversal.root, 'outside-secret.log');
  await writeFile(outsideMarker, 'outside data must not be read\n', 'utf8');
  await traversal.writeGraph(
    [validEntity],
    [{ ...validClaim, source: { ...validClaim.source, ref: 'evidence/../outside-secret.log#L1-L1' } }],
    [{ ...validRun, evidence: ['evidence/../outside-secret.log'] }],
  );
  const traversalResult = await doctor({ cwd: traversal.root });
  assert.equal(traversalResult.exitCode, 1);
  assert.match(traversalResult.stderr, /GK120|GK130/);
  assert.equal(await readFile(outsideMarker, 'utf8'), 'outside data must not be read\n');

  const symlinkFixture = await createValidatorFixture();
  t.after(symlinkFixture.cleanup);
  const outsideRoot = await mkdtemp(join(tmpdir(), 'graphkeeper-release-outside-'));
  t.after(() => rm(outsideRoot, { recursive: true, force: true }));
  await writeFile(join(outsideRoot, 'escaped.log'), 'escaped\n', 'utf8');
  await symlinkFixture.writeGraph(
    [{ ...validEntity, source_docs: ['evidence/escape/escaped.log#L1-L1'] }],
    [validClaim],
    [validRun],
  );
  await symlink(
    outsideRoot,
    join(symlinkFixture.root, 'evidence', 'escape'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const symlinkResult = await doctor({ cwd: symlinkFixture.root });
  assert.equal(symlinkResult.exitCode, 1);
  assert.match(symlinkResult.stderr, /GK310.*leaves evidence\//);
});

test('release security gate keeps commands and malicious evidence inert in paths with spaces', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper secure repo with spaces ');
  t.after(fixture.cleanup);
  const marker = join(fixture.root, 'RELEASE_SECURITY_MARKER');
  const hostile = 'touch RELEASE_SECURITY_MARKER; $(touch RELEASE_SECURITY_MARKER)';
  await fixture.writeGraph(
    [validEntity],
    [{ ...validClaim, source: { ...validClaim.source, command: hostile } }],
    [validRun],
  );
  await writeFile(join(fixture.root, 'evidence', 'triage.log'), hostile + '\nsecond\n', 'utf8');

  const checked = await runValidator(fixture, '--worktree');
  assert.equal(checked.exitCode, 0, checked.stderr);
  const diagnosed = await doctor({ cwd: fixture.root });
  assert.equal(diagnosed.exitCode, 0, diagnosed.stderr);
  assert.match(fixture.root, / /);
  await assert.rejects(access(marker));
});

test('release diagnostics redact stored secrets while reporting invalid records', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  const secret = 'gk_release_secret_DO_NOT_PRINT_7f82';
  await fixture.writeGraph(
    [validEntity],
    [{
      ...validClaim,
      confidence: 2,
      source: { ...validClaim.source, command: 'deploy --token ' + secret },
    }],
    [validRun],
  );
  await writeFile(join(fixture.root, 'evidence', 'triage.log'), secret + '\n', 'utf8');

  const checked = await runValidator(fixture, '--worktree');
  assert.equal(checked.exitCode, 1);
  assert.match(checked.stderr, /GK120/);
  const diagnosed = await doctor({ cwd: fixture.root });
  assert.equal(diagnosed.exitCode, 1);
  const diagnostics = checked.stdout + checked.stderr + diagnosed.stdout + diagnosed.stderr;
  assert.doesNotMatch(diagnostics, new RegExp(secret));
});
