import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { initialize, type InitWriteHooks } from '../../src/commands/init.js';
import { GraphKeeperError } from '../../src/lib/errors.js';
import { supportedInitEnvironment } from '../helpers/init.js';
import { createRepositoryFixture } from '../helpers/repository.js';

const packagedHook = async (): Promise<string> =>
  readFile(join(process.cwd(), 'templates', 'pre-commit'), 'utf8');

const legacyHook = [
  '#!/bin/sh',
  '# GraphKeeper managed hook',
  'set -eu',
  'root=$(git rev-parse --show-toplevel)',
  'exec sh \u0022\u0024root/scripts/validate.sh\u0022 --staged',
  '',
].join('\n');

test('installs the default hook atomically with its executable mode', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await initialize({ cwd: fixture.root, force: false, environment: supportedInitEnvironment() });
    const hook = join(fixture.root, '.git', 'hooks', 'pre-commit');
    assert.equal(await readFile(hook, 'utf8'), await packagedHook());
    if (process.platform !== 'win32') {
      assert.equal((await stat(hook)).mode & 0o777, 0o755);
    }
  } finally {
    await fixture.cleanup();
  }
});

test('creates and respects relative and absolute custom hook directories', async () => {
  for (const configured of ['.custom-hooks', 'ABSOLUTE']) {
    const fixture = await createRepositoryFixture();
    try {
      const hooksPath = configured === 'ABSOLUTE'
        ? join(fixture.root, 'absolute-hooks')
        : configured;
      await fixture.git(['config', 'core.hooksPath', hooksPath]);
      await initialize({ cwd: fixture.root, force: false, environment: supportedInitEnvironment() });
      const expected = configured === 'ABSOLUTE'
        ? join(fixture.root, 'absolute-hooks', 'pre-commit')
        : join(fixture.root, '.custom-hooks', 'pre-commit');
      assert.equal(await readFile(expected, 'utf8'), await packagedHook());
    } finally {
      await fixture.cleanup();
    }
  }
});

test('reports an exact existing GraphKeeper hook as already installed', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await initialize({ cwd: fixture.root, force: false, environment: supportedInitEnvironment() });
    const report = await initialize({
      cwd: fixture.root,
      force: false,
      environment: supportedInitEnvironment(),
    });
    assert.ok(report.actions.some((action) =>
      action.kind === 'skip'
      && action.target === 'pre-commit-hook'
      && /already installed/.test(action.reason)));
  } finally {
    await fixture.cleanup();
  }
});

test('atomically migrates the exact package-owned legacy hook', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const hook = join(fixture.root, '.git', 'hooks', 'pre-commit');
    await writeFile(hook, legacyHook, 'utf8');

    const report = await initialize({
      cwd: fixture.root,
      force: false,
      environment: supportedInitEnvironment(),
    });

    assert.equal(await readFile(hook, 'utf8'), await packagedHook());
    assert.ok(report.actions.some((action) =>
      action.kind === 'refresh' && action.target === 'pre-commit-hook'));
  } finally {
    await fixture.cleanup();
  }
});

test('legacy hook migration rejects a concurrent edit without overwriting it', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const hook = join(fixture.root, '.git', 'hooks', 'pre-commit');
    const concurrent = '#!/bin/sh\nprintf concurrent\n';
    await writeFile(hook, legacyHook, 'utf8');
    const writeHooks: InitWriteHooks = {
      beforeCommit: async (target, kind) => {
        if (target === 'pre-commit-hook' && kind === 'refresh') {
          await writeFile(hook, concurrent, 'utf8');
        }
      },
    };

    await assert.rejects(
      initialize({
        cwd: fixture.root,
        force: false,
        environment: supportedInitEnvironment(),
        writeHooks,
      }),
      (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK004',
    );
    assert.equal(await readFile(hook, 'utf8'), concurrent);
  } finally {
    await fixture.cleanup();
  }
});

test('never overwrites a third-party hook and writes chaining fallback guidance', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const hook = join(fixture.root, '.git', 'hooks', 'pre-commit');
    const thirdParty = '#!/bin/sh\nprintf third-party\n';
    await mkdir(join(fixture.root, '.git', 'hooks'), { recursive: true });
    await writeFile(hook, thirdParty, 'utf8');

    const report = await initialize({
      cwd: fixture.root,
      force: false,
      environment: supportedInitEnvironment(),
    });
    assert.equal(await readFile(hook, 'utf8'), thirdParty);
    assert.equal(
      await readFile(join(fixture.root, '.githooks', 'pre-commit'), 'utf8'),
      await packagedHook(),
    );
    const warning = report.actions.find((action) =>
      action.kind === 'warn' && action.target === 'pre-commit-hook');
    assert.match(warning?.reason ?? '', /not overwritten/);
    assert.match(warning?.reason ?? '', /\.githooks\/pre-commit/);
    assert.match(warning?.reason ?? '', /chain/i);
    assert.match(warning?.reason ?? '', /node /i);
  } finally {
    await fixture.cleanup();
  }
});

test('refreshes an exact legacy fallback while preserving the third-party hook', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const hook = join(fixture.root, '.git', 'hooks', 'pre-commit');
    const fallback = join(fixture.root, '.githooks', 'pre-commit');
    const thirdParty = '#!/bin/sh\nprintf third-party\n';
    await mkdir(join(fixture.root, '.githooks'), { recursive: true });
    await writeFile(hook, thirdParty, 'utf8');
    await writeFile(fallback, legacyHook, 'utf8');

    const report = await initialize({
      cwd: fixture.root,
      force: false,
      environment: supportedInitEnvironment(),
    });

    assert.equal(await readFile(hook, 'utf8'), thirdParty);
    assert.equal(await readFile(fallback, 'utf8'), await packagedHook());
    assert.ok(report.actions.some((action) =>
      action.kind === 'refresh' && action.target === '.githooks/pre-commit'));
  } finally {
    await fixture.cleanup();
  }
});

test('treats a modified marker-bearing hook as a collision', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const hook = join(fixture.root, '.git', 'hooks', 'pre-commit');
    const modified = '#!/bin/sh\n# GraphKeeper managed hook\nprintf modified\n';
    await writeFile(hook, modified, 'utf8');
    const report = await initialize({
      cwd: fixture.root,
      force: false,
      environment: supportedInitEnvironment(),
    });
    assert.equal(await readFile(hook, 'utf8'), modified);
    assert.ok(report.actions.some((action) =>
      action.kind === 'warn' && action.target === 'pre-commit-hook'));
  } finally {
    await fixture.cleanup();
  }
});

test('does not attempt hook installation in a non-Git directory', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    const report = await initialize({
      cwd: fixture.root,
      force: false,
      environment: supportedInitEnvironment(),
    });
    assert.equal(report.isGitRepository, false);
    assert.ok(report.actions.some((action) =>
      action.kind === 'warn' && action.target === 'git-enforcement'));
  } finally {
    await fixture.cleanup();
  }
});
