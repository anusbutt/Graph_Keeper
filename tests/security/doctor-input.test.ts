import assert from 'node:assert/strict';
import { access, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { doctor, evidenceFindings } from '../../src/commands/doctor.js';
import { createEvidenceInspector } from '../../src/lib/evidence.js';
import {
  createValidatorFixture,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

test('doctor rejects traversal references without reading outside the repository', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  const marker = join(fixture.root, 'outside-marker.log');
  await writeFile(marker, 'must remain unread\n', 'utf8');
  await fixture.writeGraph(
    [validEntity],
    [{ ...validClaim, source: { ...validClaim.source, ref: 'evidence/../outside-marker.log#L1-L1' } }],
    [{ ...validRun, evidence: ['evidence/../outside-marker.log'] }],
  );

  const result = await doctor({ cwd: fixture.root });

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /GK120|GK130/);
  assert.equal(await (await import('node:fs/promises')).readFile(marker, 'utf8'), 'must remain unread\n');
});

test('doctor rejects an evidence symlink whose real target leaves evidence', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  const outsideRoot = await mkdtemp(join(tmpdir(), 'graphkeeper-doctor-outside-'));
  t.after(() => rm(outsideRoot, { recursive: true, force: true }));
  const outside = join(outsideRoot, 'outside.log');
  await writeFile(outside, 'outside\n', 'utf8');
  await fixture.writeGraph(
    [{ ...validEntity, source_docs: ['evidence/escape/outside.log#L1-L1'] }],
    [validClaim],
    [validRun],
  );
  await symlink(
    outsideRoot,
    join(fixture.root, 'evidence', 'escape'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  const result = await doctor({ cwd: fixture.root });

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /GK310.*resolved evidence path leaves evidence\//);
});

test('doctor evidence handling maps an unreadable file without retrying or executing it', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  const unreadable = join(fixture.root, 'evidence', 'unreadable.log');
  await fixture.writeGraph();
  await writeFile(unreadable, 'secret\n', 'utf8');
  let reads = 0;
  const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' });
  const inspector = createEvidenceInspector(fixture.root, {
    readBytes: async () => {
      reads += 1;
      throw denied;
    },
  });

  const inspection = await inspector.inspect('evidence/unreadable.log#L1-L1');
  const findings = evidenceFindings(
    { ownerKind: 'entity', ownerId: validEntity.id, reference: inspection.reference },
    inspection,
  );

  assert.equal(reads, 1);
  assert.equal(inspection.issues[0]?.kind, 'unreadable');
  assert.equal(findings[0]?.code, 'GK312');
});

test('doctor treats malicious evidence content as inert text', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  const marker = join(fixture.root, 'DOCTOR_MARKER');
  const command = 'touch DOCTOR_MARKER; $(touch DOCTOR_MARKER)';
  await fixture.writeGraph();
  await writeFile(join(fixture.root, 'evidence', 'triage.log'), command + '\nsecond\n', 'utf8');

  const result = await doctor({ cwd: fixture.root });

  assert.equal(result.exitCode, 0, result.stderr);
  await assert.rejects(access(marker));
});
