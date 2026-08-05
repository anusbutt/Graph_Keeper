import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { EXIT_OPERATIONAL, EXIT_PREREQUISITE, EXIT_SUCCESS, EXIT_USAGE } from '../../src/cli.js';
import { runProcess, type ProcessResult } from '../../src/lib/process.js';
import { createRepositoryFixture } from '../helpers/repository.js';

const cliPath = fileURLToPath(new URL('../../src/cli.js', import.meta.url));

function supportedEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...(process.platform === 'win32' ? { MSYSTEM: 'MINGW64' } : {}),
  };
}

async function runInit(
  cwd: string,
  args: readonly string[] = [],
  env: NodeJS.ProcessEnv = supportedEnvironment(),
): Promise<ProcessResult> {
  return runProcess(process.execPath, [cliPath, 'init', ...args], {
    cwd,
    env,
    timeoutMs: 15_000,
  });
}

test('initializes both unborn and clean committed Git repositories', async () => {
  for (const withCommit of [false, true]) {
    const fixture = await createRepositoryFixture();
    try {
      if (withCommit) {
        await writeFile(join(fixture.root, 'README.md'), 'fixture\n', 'utf8');
        await fixture.git(['add', 'README.md']);
        await fixture.git(['commit', '-m', 'initial']);
      }
      const result = await runInit(fixture.root);
      assert.equal(result.exitCode, EXIT_SUCCESS, result.stderr);
      assert.match(result.stdout, /CREATE graph\/entities\.json/);
      assert.deepEqual(JSON.parse(await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8')), []);
      assert.equal((await stat(join(fixture.root, 'evidence'))).isDirectory(), true);
      assert.match(await readFile(join(fixture.root, '.git', 'hooks', 'pre-commit'), 'utf8'), /GraphKeeper managed hook/);
    } finally {
      await fixture.cleanup();
    }
  }
});

test('repeat and forced runs preserve graph data, evidence, and validators', async () => {
  const fixture = await createRepositoryFixture();
  try {
    assert.equal((await runInit(fixture.root)).exitCode, EXIT_SUCCESS);
    const claims = '[{\"preserved\":true}]\n';
    const evidence = 'evidence bytes\n';
    const validator = '# user validator\n';
    await writeFile(join(fixture.root, 'graph', 'claims.json'), claims, 'utf8');
    await writeFile(join(fixture.root, 'evidence', 'run.log'), evidence, 'utf8');
    await writeFile(join(fixture.root, 'scripts', 'validate.sh'), validator, 'utf8');
    await writeFile(join(fixture.root, 'graph', 'SCHEMA.md'), 'outdated\n', 'utf8');

    const repeated = await runInit(fixture.root);
    assert.equal(repeated.exitCode, EXIT_SUCCESS, repeated.stderr);
    assert.match(repeated.stdout, /SKIP graph\/claims\.json/);
    const forced = await runInit(fixture.root, ['--force']);
    assert.equal(forced.exitCode, EXIT_SUCCESS, forced.stderr);
    assert.match(forced.stdout, /REFRESH graph\/SCHEMA\.md/);
    assert.equal(await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8'), claims);
    assert.equal(await readFile(join(fixture.root, 'evidence', 'run.log'), 'utf8'), evidence);
    assert.equal(await readFile(join(fixture.root, 'scripts', 'validate.sh'), 'utf8'), validator);
    assert.notEqual(await readFile(join(fixture.root, 'graph', 'SCHEMA.md'), 'utf8'), 'outdated\n');
  } finally {
    await fixture.cleanup();
  }
});

test('scaffolds a non-Git directory with a prominent enforcement warning', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    const result = await runInit(fixture.root);
    assert.equal(result.exitCode, EXIT_SUCCESS, result.stderr);
    assert.match(result.stderr, /WARNING.*enforcement is disabled until git init/is);
    assert.deepEqual(JSON.parse(await readFile(join(fixture.root, 'graph', 'runs.json'), 'utf8')), []);
  } finally {
    await fixture.cleanup();
  }
});

test('respects custom hooksPath and preserves a third-party hook', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await fixture.git(['config', 'core.hooksPath', '.team-hooks']);
    await mkdir(join(fixture.root, '.team-hooks'), { recursive: true });
    const existing = '#!/bin/sh\nprintf team-hook\n';
    await writeFile(join(fixture.root, '.team-hooks', 'pre-commit'), existing, 'utf8');
    const result = await runInit(fixture.root);
    assert.equal(result.exitCode, EXIT_SUCCESS, result.stderr);
    assert.equal(await readFile(join(fixture.root, '.team-hooks', 'pre-commit'), 'utf8'), existing);
    assert.match(result.stderr, /not overwritten.*chain/is);
    assert.match(await readFile(join(fixture.root, '.githooks', 'pre-commit'), 'utf8'), /GraphKeeper managed hook/);
  } finally {
    await fixture.cleanup();
  }
});

test('missing prerequisites fail before any files are changed', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    const env = supportedEnvironment();
    delete env.Path;
    env.PATH = '';
    const result = await runInit(fixture.root, [], env);
    assert.equal(result.exitCode, EXIT_PREREQUISITE);
    assert.match(result.stderr, /GK003.*Git is required.*https:\/\//s);
    await assert.rejects(stat(join(fixture.root, 'graph')));
  } finally {
    await fixture.cleanup();
  }
});

test('invalid init arguments are usage errors without mutation', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    const result = await runInit(fixture.root, ['--unknown']);
    assert.equal(result.exitCode, EXIT_USAGE);
    assert.match(result.stderr, /GK002/);
    await assert.rejects(stat(join(fixture.root, 'graph')));
  } finally {
    await fixture.cleanup();
  }
});

test('destination conflicts fail recoverably without replacing the conflict', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await mkdir(join(fixture.root, 'graph', 'entities.json'), { recursive: true });
    const result = await runInit(fixture.root);
    assert.equal(result.exitCode, EXIT_OPERATIONAL);
    assert.match(result.stderr, /wrong type.*preserved/is);
    assert.equal((await stat(join(fixture.root, 'graph', 'entities.json'))).isDirectory(), true);
    await assert.rejects(stat(join(fixture.root, 'graph', 'claims.json')));
  } finally {
    await fixture.cleanup();
  }
});
