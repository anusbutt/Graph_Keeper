import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

test('release README covers onboarding, operation, recovery, limits, and future storage', async () => {
  const readme = await readFile(join(projectRoot, 'README.md'), 'utf8');
  for (const contract of [
    /coding agents shouldn't just remember.*prove why they\s+remember/is,
    /grounded, auditable memory/i,
    /## Prerequisites/,
    /## Installation/,
    /npx graphkeeper@latest --help/,
    /npm install --global graphkeeper/,
    /npmjs\.com\/package\/graphkeeper/,
    /## Two-minute quickstart/,
    /## Before and after/,
    /graphkeeper init \[--force\]/,
    /graphkeeper check/,
    /graphkeeper query <subject>/,
    /graphkeeper doctor/,
    /native Windows PowerShell/i,
    /legacy.*validate\.sh.*sh.*jq/is,
    /## Recovery and adoption/,
    /rerun `graphkeeper init(?: --force)?`.*package-owned.*validator.*hook.*migrate/is,
    /customized.*shell-only.*POSIX.*jq/is,
    /0\.3\.0.*init --force.*preserves\s+`scripts\/validate\.sh`/is,
    /github\.com\/anusbutt\/Graph_Keeper\/discussions/,
    /10,000 claims, 2,000 entities, and 1,000 runs/,
    /SQLite or PostgreSQL/,
  ]) assert.match(readme, contract);
  assert.doesNotMatch(readme, /Native PowerShell is not supported/i);
});

test('npm metadata points to the canonical public repository and support channels', async () => {
  const manifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8')) as {
    name?: string;
    homepage?: string;
    bugs?: { url?: string };
    repository?: { type?: string; url?: string };
    bin?: Record<string, string>;
    keywords?: string[];
  };

  assert.equal(manifest.name, 'graphkeeper');
  assert.equal(manifest.homepage, 'https://github.com/anusbutt/Graph_Keeper#readme');
  assert.deepEqual(manifest.bugs, {
    url: 'https://github.com/anusbutt/Graph_Keeper/issues',
  });
  assert.deepEqual(manifest.repository, {
    type: 'git',
    url: 'git+https://github.com/anusbutt/Graph_Keeper.git',
  });
  assert.deepEqual(manifest.bin, { graphkeeper: 'dist/src/cli.js' });
  for (const keyword of ['ai-agents', 'coding-agents', 'knowledge-graph', 'provenance']) {
    assert.ok(manifest.keywords?.includes(keyword), `missing npm keyword: ${keyword}`);
  }
});

test('release version stays aligned across package, lockfile, CLI, README, and changelog', async () => {
  const manifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8')) as {
    version?: string;
  };
  const lockfile = JSON.parse(await readFile(join(projectRoot, 'package-lock.json'), 'utf8')) as {
    version?: string;
    packages?: Record<string, { version?: string }>;
  };
  const cli = await readFile(join(projectRoot, 'src/cli.ts'), 'utf8');
  const readme = await readFile(join(projectRoot, 'README.md'), 'utf8');
  const changelog = await readFile(join(projectRoot, 'CHANGELOG.md'), 'utf8');
  const version = manifest.version;

  assert.equal(version, '0.3.0');
  assert.equal(lockfile.version, version);
  assert.equal(lockfile.packages?.['']?.version, version);
  assert.match(cli, new RegExp("const VERSION = '" + version?.replaceAll('.', '\\.') + "';"));
  assert.match(readme, new RegExp('Version\\s+`' + version?.replaceAll('.', '\\.') + '`'));
  assert.match(changelog, new RegExp('## \\[' + version?.replaceAll('.', '\\.') + '\\] - 2026-08-13'));
});

test('release carries the MIT terms for GraphKeeper contributors', async () => {
  const license = await readFile(join(projectRoot, 'LICENSE'), 'utf8');
  assert.match(license, /^MIT License/);
  assert.match(license, /Copyright \(c\) 2026 GraphKeeper contributors/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
});

test('native Windows migration keeps customized validators conservative', async () => {
  const guide = await readFile(join(projectRoot, 'docs', 'windows-migration.md'), 'utf8');
  assert.match(guide, /Node\.js.*npm.*Git/is);
  assert.match(guide, /graphkeeper init --force/);
  assert.match(guide, /exact package-owned.*migrat/is);
  assert.match(guide, /customized.*does not replace or bypass/is);
  assert.match(guide, /legacy fallback.*POSIX shell.*jq/is);
  assert.match(guide, /rollback.*previous GraphKeeper npm version/is);
});
