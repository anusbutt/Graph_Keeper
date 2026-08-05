import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runProcess } from '../../src/lib/process.js';
import {
  createValidatorFixture,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

const cliPath = fileURLToPath(new URL('../../src/cli.js', import.meta.url));

async function runDoctor(root: string, args: readonly string[] = []) {
  return runProcess(process.execPath, [cliPath, 'doctor', ...args], {
    cwd: root,
    env: process.env,
    timeoutMs: 40_000,
  });
}

test('doctor CLI acceptance matrix includes healthy and warning-only outcomes', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph();
  const healthy = await runDoctor(fixture.root);
  assert.equal(healthy.exitCode, 0, healthy.stderr);
  assert.match(healthy.stdout, /Summary: 0 error\(s\), 0 warning\(s\)/);

  const orphan = {
    id: 'orphan_component',
    type: 'component',
    aliases: [],
    first_seen: validEntity.first_seen,
  };
  await fixture.writeGraph([validEntity, orphan], [validClaim], [validRun]);
  const warning = await runDoctor(fixture.root);
  assert.equal(warning.exitCode, 0, warning.stderr);
  assert.match(warning.stdout, /GK390 \[orphan_component\]/);
});

test('doctor CLI reports missing, binary, zero-line, reversed, zero-based, and out-of-bounds evidence', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  const entities = [
    validEntity,
    {
      id: 'missing_doc', type: 'document', aliases: [], first_seen: validEntity.first_seen,
      source_docs: ['evidence/missing.log#L1-L1'],
    },
    {
      id: 'binary_doc', type: 'document', aliases: [], first_seen: validEntity.first_seen,
      source_docs: ['evidence/binary.log#L1-L1'],
    },
    {
      id: 'empty_doc', type: 'document', aliases: [], first_seen: validEntity.first_seen,
      source_docs: ['evidence/empty.log#L1-L1'],
    },
    {
      id: 'reverse_doc', type: 'document', aliases: [], first_seen: validEntity.first_seen,
      source_docs: ['evidence/triage.log#L2-L1'],
    },
    {
      id: 'zero_doc', type: 'document', aliases: [], first_seen: validEntity.first_seen,
      source_docs: ['evidence/triage.log#L0-L1'],
    },
  ];
  const claim = { ...validClaim, source: { ...validClaim.source, ref: 'evidence/triage.log#L1-L9' } };
  await fixture.writeGraph(entities, [claim], [validRun]);
  await writeFile(join(fixture.root, 'evidence', 'binary.log'), Buffer.from([0xff]));
  await writeFile(join(fixture.root, 'evidence', 'empty.log'), '', 'utf8');

  const result = await runDoctor(fixture.root);

  assert.equal(result.exitCode, 1);
  for (const code of ['GK311', 'GK313', 'GK314', 'GK315', 'GK316']) {
    assert.match(result.stderr, new RegExp(code));
  }
  assert.match(result.stdout, /warning\(s\)/);
});

test('doctor detects duplicate raw keys even when normal JSON parsing keeps a valid last value', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph();
  const path = join(fixture.root, 'graph', 'entities.json');
  const raw = await readFile(path, 'utf8');
  await writeFile(path, raw.replace('"type": "test"', '"type": "component",\n    "type": "test"'), 'utf8');

  const result = await runDoctor(fixture.root);

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /GK301 \[graph\/entities\.json:\$\[0\]\].*duplicate JSON key "type"/);
});

test('doctor CLI rejects arguments as a usage error', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph();

  const result = await runDoctor(fixture.root, ['--unknown']);

  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /GK002 doctor does not accept arguments/);
});
