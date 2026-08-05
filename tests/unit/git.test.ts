import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { GraphKeeperError } from '../../src/lib/errors.js';
import {
  findGitRoot,
  hasHead,
  readStagedBlob,
  resolveHooksPath,
} from '../../src/lib/git.js';
import { createRepositoryFixture } from '../helpers/repository.js';

test('detects an unborn repository and then an existing HEAD', async () => {
  const fixture = await createRepositoryFixture();
  try {
    assert.equal(await hasHead(fixture.root), false);
    await mkdir(join(fixture.root, 'graph'), { recursive: true });
    await writeFile(join(fixture.root, 'README.md'), 'fixture\n', 'utf8');
    await fixture.git(['add', 'README.md']);
    await fixture.git(['commit', '-m', 'initial']);
    assert.equal(await hasHead(fixture.root), true);
    assert.equal(await findGitRoot(join(fixture.root, 'graph')), fixture.root);
  } finally {
    await fixture.cleanup();
  }
});

test('reads exactly the staged blob instead of worktree content', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const path = join(fixture.root, 'graph', 'claims.json');
    await mkdir(join(fixture.root, 'graph'), { recursive: true });
    await writeFile(path, '[]\n', 'utf8');
    await fixture.git(['add', 'graph/claims.json']);
    await writeFile(path, '[{"worktree":true}]\n', 'utf8');
    assert.equal(await readStagedBlob(fixture.root, 'graph/claims.json'), '[]\n');
  } finally {
    await fixture.cleanup();
  }
});

test('resolves relative and absolute custom hooksPath values', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await fixture.git(['config', 'core.hooksPath', '.custom-hooks']);
    assert.equal(await resolveHooksPath(fixture.root), join(fixture.root, '.custom-hooks'));
    const absolute = resolve(fixture.root, 'absolute-hooks');
    await fixture.git(['config', 'core.hooksPath', absolute]);
    assert.equal(await resolveHooksPath(fixture.root), absolute);
  } finally {
    await fixture.cleanup();
  }
});

test('translates Git failures to stable operational errors', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    await assert.rejects(
      findGitRoot(fixture.root),
      (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK004' && error.exitCode === 4,
    );
  } finally {
    await fixture.cleanup();
  }
});
