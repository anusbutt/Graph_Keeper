import assert from 'node:assert/strict';
import { appendFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  createValidatorFixture,
  runValidator,
  timestamp,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

test('allows a valid staged graph before the first commit', async () => {
  const fixture = await createValidatorFixture();
  try {
    await fixture.writeGraph();
    await fixture.stageAll();
    const result = await runValidator(fixture, '--staged');
    assert.equal(result.exitCode, 0, result.stderr);
  } finally {
    await fixture.cleanup();
  }
});

test('rejects semantic claim mutation or removal after commit', async () => {
  const fixture = await createValidatorFixture();
  try {
    await fixture.writeGraph();
    await fixture.commitAll();
    await fixture.writeGraph(undefined, [{ ...validClaim, object: 'stable' }]);
    assert.match((await runValidator(fixture, '--worktree')).stderr, /GK151/);
    await fixture.writeGraph(undefined, []);
    assert.match((await runValidator(fixture, '--worktree')).stderr, /GK151/);
  } finally {
    await fixture.cleanup();
  }
});

test('allows entity set growth but rejects identity edits and set removal', async () => {
  const fixture = await createValidatorFixture();
  try {
    await fixture.writeGraph();
    await fixture.commitAll();
    const grown = {
      ...validEntity,
      aliases: [...validEntity.aliases, 'payments suite'],
      source_docs: [...validEntity.source_docs, 'evidence/triage.log#L2-L2'],
    };
    await fixture.writeGraph([grown]);
    assert.equal((await runValidator(fixture, '--worktree')).exitCode, 0);
    await fixture.writeGraph([{ ...validEntity, type: 'service' }]);
    assert.match((await runValidator(fixture, '--worktree')).stderr, /GK152/);
    await fixture.writeGraph([{ ...validEntity, aliases: [] }]);
    assert.match((await runValidator(fixture, '--worktree')).stderr, /GK152/);
  } finally {
    await fixture.cleanup();
  }
});

test('allows one-way open-run growth and close, then rejects closed-run mutation', async () => {
  const fixture = await createValidatorFixture();
  try {
    const open = {
      id: validRun.id,
      started: timestamp,
      tool: validRun.tool,
      evidence: [],
      claims_written: [],
    };
    await fixture.writeGraph([validEntity], [], [open]);
    await fixture.commitAll();
    const grown = { ...open, task: 'triage', evidence: ['evidence/triage.log'] };
    await fixture.writeGraph([validEntity], [], [grown]);
    assert.equal((await runValidator(fixture, '--worktree')).exitCode, 0);
    const closed = { ...grown, ended: validRun.ended, verdict: validRun.verdict };
    await fixture.writeGraph([validEntity], [], [closed]);
    assert.equal((await runValidator(fixture, '--worktree')).exitCode, 0);
    await fixture.commitAll('close run');
    await fixture.writeGraph([validEntity], [], [{ ...closed, task: 'changed' }]);
    assert.match((await runValidator(fixture, '--worktree')).stderr, /GK153/);
  } finally {
    await fixture.cleanup();
  }
});

test('protects committed evidence from modification, deletion, and rename', async () => {
  const fixture = await createValidatorFixture();
  try {
    await fixture.writeGraph();
    await fixture.commitAll();
    const evidence = join(fixture.root, 'evidence', 'triage.log');
    await appendFile(evidence, 'changed\n', 'utf8');
    assert.match((await runValidator(fixture, '--worktree')).stderr, /GK154/);
    await writeFile(evidence, 'failure\nstack\n', 'utf8');
    await rename(evidence, join(fixture.root, 'evidence', 'renamed.log'));
    assert.match((await runValidator(fixture, '--worktree')).stderr, /GK154/);
  } finally {
    await fixture.cleanup();
  }
});
