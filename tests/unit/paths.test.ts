import assert from 'node:assert/strict';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { createRepositoryFixture } from '../helpers/repository.js';
import {
  assertRealPathContained,
  findRepositoryRoot,
  resolveContainedPath,
  resolveEvidencePath,
} from '../../src/lib/paths.js';

test('discovers the nearest repository root from a nested directory', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const nested = join(fixture.root, 'a', 'b');
    await mkdir(nested, { recursive: true });
    assert.equal(await findRepositoryRoot(nested), fixture.root);
  } finally {
    await fixture.cleanup();
  }
});

test('returns null when no repository marker exists', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    assert.equal(await findRepositoryRoot(fixture.root), null);
  } finally {
    await fixture.cleanup();
  }
});

test('resolves contained paths and rejects absolute or traversal paths', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    assert.equal(resolveContainedPath(fixture.root, 'graph/claims.json'), join(fixture.root, 'graph', 'claims.json'));
    assert.equal(resolveEvidencePath(fixture.root, 'evidence/run.log'), join(fixture.root, 'evidence', 'run.log'));
    assert.throws(() => resolveContainedPath(fixture.root, '../outside'), /unsafe path/);
    assert.throws(() => resolveContainedPath(fixture.root, fixture.root), /relative path/);
    assert.throws(() => resolveEvidencePath(fixture.root, 'graph/claims.json'), /evidence\//);
    assert.throws(() => resolveEvidencePath(fixture.root, 'evidence/a/../b'), /unsafe path/);
  } finally {
    await fixture.cleanup();
  }
});

test('rejects a symlink whose real target leaves the evidence directory', async (t) => {
  const fixture = await createRepositoryFixture(false);
  try {
    const evidence = join(fixture.root, 'evidence');
    const outside = join(fixture.root, 'outside');
    await mkdir(evidence, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, 'secret.txt'), 'secret', 'utf8');
    try {
      await symlink(outside, join(evidence, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error: unknown) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : '';
      if (code === 'EPERM') {
        t.skip('symlink creation is not permitted on this Windows host');
        return;
      }
      throw error;
    }
    await assert.rejects(
      assertRealPathContained(evidence, join(evidence, 'escape', 'secret.txt')),
      /escapes allowed root/,
    );
  } finally {
    await fixture.cleanup();
  }
});
