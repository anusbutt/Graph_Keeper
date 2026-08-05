import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { initialize } from '../../src/commands/init.js';
import { supportedInitEnvironment } from '../helpers/init.js';
import { createRepositoryFixture } from '../helpers/repository.js';

const packagedHook = async (): Promise<string> =>
  readFile(join(process.cwd(), 'templates', 'pre-commit'), 'utf8');

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
