import assert from 'node:assert/strict';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  initialize,
  type InitWriteHooks,
} from '../../src/commands/init.js';
import { GraphKeeperError } from '../../src/lib/errors.js';
import { supportedInitEnvironment } from '../helpers/init.js';
import { createRepositoryFixture } from '../helpers/repository.js';

const files = [
  'graph/entities.json',
  'graph/claims.json',
  'graph/runs.json',
  'graph/SCHEMA.md',
  'SKILL.md',
  'scripts/validate.sh',
];

test('creates a complete scaffold with exact packaged content', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const report = await initialize({
      cwd: fixture.root,
      force: false,
      environment: supportedInitEnvironment(),
    });
    for (const relativePath of files) {
      const installed = await readFile(join(fixture.root, relativePath), 'utf8');
      const source = relativePath === 'scripts/validate.sh'
        ? join(process.cwd(), relativePath)
        : join(process.cwd(), 'templates', relativePath);
      assert.equal(installed, await readFile(source, 'utf8'));
    }
    assert.equal((await stat(join(fixture.root, 'evidence'))).isDirectory(), true);
    assert.equal(report.actions.filter((action) => action.kind === 'create').length, 8);
    if (process.platform !== 'win32') {
      const mode = (await stat(join(fixture.root, 'scripts', 'validate.sh'))).mode & 0o777;
      assert.equal(mode, 0o755);
    }
  } finally {
    await fixture.cleanup();
  }
});

test('repeat initialization preserves graph data and evidence byte-for-byte', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await initialize({ cwd: fixture.root, force: false, environment: supportedInitEnvironment() });
    const claims = '[{\"user\":\"data\"}]\n';
    const evidence = 'captured output\n';
    await writeFile(join(fixture.root, 'graph', 'claims.json'), claims, 'utf8');
    await writeFile(join(fixture.root, 'evidence', 'run.log'), evidence, 'utf8');

    const report = await initialize({
      cwd: fixture.root,
      force: false,
      environment: supportedInitEnvironment(),
    });
    assert.equal(await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8'), claims);
    assert.equal(await readFile(join(fixture.root, 'evidence', 'run.log'), 'utf8'), evidence);
    assert.ok(report.actions.some((action) =>
      action.target === 'graph/claims.json' && action.kind === 'skip'));
  } finally {
    await fixture.cleanup();
  }
});

test('--force refreshes only generated documentation', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await initialize({ cwd: fixture.root, force: false, environment: supportedInitEnvironment() });
    await writeFile(join(fixture.root, 'graph', 'entities.json'), '[{\"preserve\":true}]\n', 'utf8');
    await writeFile(join(fixture.root, 'graph', 'SCHEMA.md'), 'old schema\n', 'utf8');
    await writeFile(join(fixture.root, 'SKILL.md'), 'old skill\n', 'utf8');
    await writeFile(join(fixture.root, 'scripts', 'validate.sh'), 'user validator\n', 'utf8');

    const report = await initialize({
      cwd: fixture.root,
      force: true,
      environment: supportedInitEnvironment(),
    });
    assert.equal(
      await readFile(join(fixture.root, 'graph', 'entities.json'), 'utf8'),
      '[{\"preserve\":true}]\n',
    );
    assert.equal(
      await readFile(join(fixture.root, 'scripts', 'validate.sh'), 'utf8'),
      'user validator\n',
    );
    assert.equal(
      await readFile(join(fixture.root, 'graph', 'SCHEMA.md'), 'utf8'),
      await readFile(join(process.cwd(), 'templates', 'graph', 'SCHEMA.md'), 'utf8'),
    );
    assert.deepEqual(
      report.actions.filter((action) => action.kind === 'refresh').map((action) => action.target),
      ['graph/SCHEMA.md', 'SKILL.md'],
    );
  } finally {
    await fixture.cleanup();
  }
});

test('an interrupted atomic refresh preserves the old file and a retry recovers', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await initialize({ cwd: fixture.root, force: false, environment: supportedInitEnvironment() });
    const schemaPath = join(fixture.root, 'graph', 'SCHEMA.md');
    await writeFile(schemaPath, 'old schema\n', 'utf8');
    let interrupted = false;
    const hooks: InitWriteHooks = {
      beforeCommit: async (target) => {
        if (!interrupted && target === 'graph/SCHEMA.md') {
          interrupted = true;
          throw new Error('simulated interruption');
        }
      },
    };
    await assert.rejects(
      initialize({
        cwd: fixture.root,
        force: true,
        environment: supportedInitEnvironment(),
        writeHooks: hooks,
      }),
      (error: unknown) => error instanceof GraphKeeperError && error.exitCode === 4,
    );
    assert.equal(await readFile(schemaPath, 'utf8'), 'old schema\n');

    await initialize({ cwd: fixture.root, force: true, environment: supportedInitEnvironment() });
    assert.equal(
      await readFile(schemaPath, 'utf8'),
      await readFile(join(process.cwd(), 'templates', 'graph', 'SCHEMA.md'), 'utf8'),
    );
    const leftovers = (await readdir(join(fixture.root, 'graph')))
      .filter((name) => name.includes('.graphkeeper-tmp-'));
    assert.deepEqual(leftovers, []);
  } finally {
    await fixture.cleanup();
  }
});
