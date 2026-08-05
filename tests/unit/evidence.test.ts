import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createEvidenceInspector, logicalLineCount } from '../../src/lib/evidence.js';

test('logical line counting treats LF and CRLF identically and ignores a trailing terminator', () => {
  assert.equal(logicalLineCount('one\ntwo\n'), 2);
  assert.equal(logicalLineCount('one\r\ntwo\r\n'), 2);
  assert.equal(logicalLineCount('one\ntwo'), 2);
  assert.equal(logicalLineCount(''), 0);
});

test('accepts valid UTF-8 evidence and positive inclusive ranges', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'graphkeeper-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'evidence'));
  await writeFile(join(root, 'evidence', 'valid.log'), 'alpha\r\nbéta\r\ngamma\r\n', 'utf8');

  const result = await createEvidenceInspector(root).inspect('evidence/valid.log#L2-L3');

  assert.equal(result.lineCount, 3);
  assert.deepEqual(result.issues, []);
});

test('rejects invalid UTF-8 and binary control content', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'graphkeeper-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'evidence'));
  await writeFile(join(root, 'evidence', 'invalid.bin'), Buffer.from([0xff, 0xfe]));
  await writeFile(join(root, 'evidence', 'nul.log'), Buffer.from('text\0more'));
  const inspector = createEvidenceInspector(root);

  assert.equal((await inspector.inspect('evidence/invalid.bin#L1-L1')).issues[0]?.kind, 'non_text');
  assert.equal((await inspector.inspect('evidence/nul.log#L1-L1')).issues[0]?.kind, 'non_text');
});

test('reports zero-line, zero-based, reversed, and out-of-bounds ranges precisely', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'graphkeeper-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'evidence'));
  await writeFile(join(root, 'evidence', 'empty.log'), '', 'utf8');
  await writeFile(join(root, 'evidence', 'two.log'), 'one\ntwo\n', 'utf8');
  const inspector = createEvidenceInspector(root);

  assert.deepEqual(
    (await inspector.inspect('evidence/empty.log#L1-L1')).issues.map((issue) => issue.kind),
    ['out_of_bounds'],
  );
  assert.deepEqual(
    (await inspector.inspect('evidence/two.log#L0-L1')).issues.map((issue) => issue.kind),
    ['range_start'],
  );
  assert.deepEqual(
    (await inspector.inspect('evidence/two.log#L2-L1')).issues.map((issue) => issue.kind),
    ['range_order'],
  );
  assert.deepEqual(
    (await inspector.inspect('evidence/two.log#L1-L3')).issues.map((issue) => issue.kind),
    ['out_of_bounds'],
  );
});
