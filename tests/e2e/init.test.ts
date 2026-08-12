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

async function runCli(
  cwd: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = supportedEnvironment(),
): Promise<ProcessResult> {
  return runProcess(process.execPath, [cliPath, ...args], {
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
      assert.match(
        await readFile(join(fixture.root, '.agents', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
        /^---\nname: graphkeeper\n/,
      );
      await assert.rejects(readFile(join(fixture.root, 'SKILL.md'), 'utf8'));
      await assert.rejects(readFile(join(fixture.root, 'AGENTS.md'), 'utf8'));
      await assert.rejects(readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'));
      assert.match(await readFile(join(fixture.root, '.git', 'hooks', 'pre-commit'), 'utf8'), /GraphKeeper managed hook/);
    } finally {
      await fixture.cleanup();
    }
  }
});

test('explicit Codex integration creates the managed AGENTS.md block through the CLI', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const result = await runInit(fixture.root, ['--integrate', 'codex', '--yes']);
    assert.equal(result.exitCode, EXIT_SUCCESS, result.stderr);
    assert.match(result.stdout, /CREATE AGENTS\.md/);
    const agents = await readFile(join(fixture.root, 'AGENTS.md'), 'utf8');
    assert.match(agents, /<!-- graphkeeper:codex:start -->/);
    assert.match(agents, /invoke `\$graphkeeper`/);
    assert.equal((agents.match(/graphkeeper:codex:start/g) ?? []).length, 1);
  } finally {
    await fixture.cleanup();
  }
});

test('non-interactive integration requires --yes and refuses before mutation', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const result = await runInit(fixture.root, ['--integrate', 'claude']);
    assert.equal(result.exitCode, EXIT_USAGE);
    assert.match(result.stderr, /GK002.*non-interactive.*--yes/is);
    assert.match(result.stdout, /GraphKeeper will:/);
    await assert.rejects(stat(join(fixture.root, 'graph')));
    await assert.rejects(stat(join(fixture.root, 'CLAUDE.md')));
  } finally {
    await fixture.cleanup();
  }
});

test('--dry-run preflights all adapters without prompting or writing', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const result = await runInit(fixture.root, [
      '--integrate', 'all',
      '--yes',
      '--dry-run',
    ]);
    assert.equal(result.exitCode, EXIT_SUCCESS, result.stderr);
    assert.match(result.stdout, /CREATE AGENTS\.md/);
    assert.match(result.stdout, /CREATE CLAUDE\.md/);
    assert.match(result.stdout, /\.claude\/skills\/graphkeeper\/SKILL\.md/);
    assert.match(result.stdout, /DRY RUN No changes were made/);
    assert.doesNotMatch(result.stdout, /Restart Claude Code/);
    await assert.rejects(stat(join(fixture.root, 'graph')));
    await assert.rejects(stat(join(fixture.root, 'AGENTS.md')));
    await assert.rejects(stat(join(fixture.root, 'CLAUDE.md')));
  } finally {
    await fixture.cleanup();
  }
});

test('--yes never bypasses marker validation or writes a partial scaffold', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const malformed = '<!-- graphkeeper:claude:start -->\nmissing end\n';
    await writeFile(join(fixture.root, 'CLAUDE.md'), malformed, 'utf8');
    const result = await runInit(
      fixture.root,
      ['--integrate', 'claude', '--yes'],
    );
    assert.equal(result.exitCode, EXIT_OPERATIONAL);
    assert.match(result.stderr, /GK004.*marker/is);
    assert.equal(await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'), malformed);
    await assert.rejects(stat(join(fixture.root, 'graph')));
  } finally {
    await fixture.cleanup();
  }
});

test('all adapters install and conservative removal works through the CLI', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const installed = await runInit(fixture.root, ['--integrate', 'all', '--yes']);
    assert.equal(installed.exitCode, EXIT_SUCCESS, installed.stderr);
    assert.match(await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'), /graphkeeper:codex/);
    assert.match(await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'), /graphkeeper:claude/);

    const refused = await runCli(fixture.root, ['integrate', 'remove', 'claude']);
    assert.equal(refused.exitCode, EXIT_USAGE);
    assert.match(refused.stderr, /non-interactive.*--yes/is);
    assert.equal(
      (await stat(join(fixture.root, '.claude', 'skills', 'graphkeeper'))).isDirectory(),
      true,
    );

    const dryRun = await runCli(
      fixture.root,
      ['integrate', 'remove', 'claude', '--yes', '--dry-run'],
    );
    assert.equal(dryRun.exitCode, EXIT_SUCCESS, dryRun.stderr);
    assert.match(dryRun.stdout, /DRY RUN No changes were made/);
    assert.match(await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'), /graphkeeper:claude/);

    const removed = await runCli(
      fixture.root,
      ['integrate', 'remove', 'claude', '--yes'],
    );
    assert.equal(removed.exitCode, EXIT_SUCCESS, removed.stderr);
    assert.match(removed.stdout, /REMOVE CLAUDE\.md/);
    assert.doesNotMatch(
      await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'),
      /graphkeeper:claude/,
    );
    await assert.rejects(stat(join(fixture.root, '.claude', 'skills', 'graphkeeper')));
    assert.match(await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'), /graphkeeper:codex/);
  } finally {
    await fixture.cleanup();
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

test('discoverable skill destination conflicts fail without replacing the conflict', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const conflict = join(fixture.root, '.agents', 'skills', 'graphkeeper', 'SKILL.md');
    await mkdir(conflict, { recursive: true });
    const result = await runInit(fixture.root);
    assert.equal(result.exitCode, EXIT_OPERATIONAL);
    assert.match(result.stderr, /wrong type.*preserved/is);
    assert.equal((await stat(conflict)).isDirectory(), true);
    await assert.rejects(stat(join(fixture.root, 'graph', 'claims.json')));
  } finally {
    await fixture.cleanup();
  }
});

test('invalid init integration grammar returns GK002 without repository mutation', async () => {
  for (const args of [
    ['--integrate'],
    ['--integrate', 'unknown'],
    ['--force', '--force'],
    ['--integrate', 'codex', '--integrate', 'codex'],
    ['--integrate', 'all', '--integrate', 'claude'],
    ['--unknown'],
  ]) {
    const fixture = await createRepositoryFixture();
    try {
      const result = await runInit(fixture.root, args);
      assert.equal(result.exitCode, EXIT_USAGE, args.join(' '));
      assert.match(result.stderr, /GK002/);
      await assert.rejects(stat(join(fixture.root, 'graph', 'claims.json')));
      await assert.rejects(stat(join(fixture.root, 'AGENTS.md')));
    } finally {
      await fixture.cleanup();
    }
  }
});
