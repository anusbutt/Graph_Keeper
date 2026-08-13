import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { loadValidationSnapshot } from '../../src/lib/git-snapshot.js';
import { createValidatorFixture } from '../helpers/validator.js';

test('loads worktree graph, optional HEAD baseline, and worktree evidence changes', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-snapshot-');
  t.after(fixture.cleanup);
  await fixture.writeGraph();

  const unborn = await loadValidationSnapshot({
    repositoryRoot: fixture.root,
    mode: '--worktree',
  });
  assert.equal(unborn.head, null);
  assert.equal(JSON.parse(unborn.current.claims.content).length, 1);

  await fixture.commitAll();
  await writeFile(join(fixture.root, 'evidence', 'triage.log'), 'changed\n', 'utf8');
  const changed = await loadValidationSnapshot({
    repositoryRoot: fixture.root,
    mode: '--worktree',
  });
  assert.ok(changed.head);
  assert.deepEqual(changed.evidenceChanges.map((entry) => entry.paths), [
    ['evidence/triage.log'],
  ]);
});

test('staged mode reads index blobs instead of worktree files', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-snapshot-');
  t.after(fixture.cleanup);
  await fixture.writeGraph();
  await fixture.stageAll();
  const claimsPath = join(fixture.root, 'graph', 'claims.json');
  const stagedText = await readFile(claimsPath, 'utf8');
  await writeFile(claimsPath, '[]\n', 'utf8');

  const snapshot = await loadValidationSnapshot({
    repositoryRoot: fixture.root,
    mode: '--staged',
  });

  assert.equal(snapshot.current.claims.content, stagedText);
  assert.equal(snapshot.current.claims.missing, false);
});

test('missing staged files become empty arrays with ordered GK101 snapshot issues', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-snapshot-');
  t.after(fixture.cleanup);

  const snapshot = await loadValidationSnapshot({
    repositoryRoot: fixture.root,
    mode: '--staged',
  });

  assert.equal(snapshot.current.entities.content, '[]\n');
  assert.deepEqual(snapshot.issues.map((issue) => issue.code), ['GK101', 'GK101', 'GK101']);
  assert.deepEqual(snapshot.issues.map((issue) => issue.context), [
    'graph/entities.json',
    'graph/claims.json',
    'graph/runs.json',
  ]);
});
