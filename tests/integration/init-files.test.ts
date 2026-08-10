import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
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
  '.agents/skills/graphkeeper/SKILL.md',
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
        : relativePath === '.agents/skills/graphkeeper/SKILL.md'
          ? join(process.cwd(), 'templates', 'SKILL.md')
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
    await writeFile(
      join(fixture.root, '.agents', 'skills', 'graphkeeper', 'SKILL.md'),
      'old discoverable skill\n',
      'utf8',
    );
    await writeFile(join(fixture.root, 'SKILL.md'), 'legacy skill\n', 'utf8');
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
      ['graph/SCHEMA.md', '.agents/skills/graphkeeper/SKILL.md'],
    );
    assert.equal(await readFile(join(fixture.root, 'SKILL.md'), 'utf8'), 'legacy skill\n');
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

test('default and forced init preserve existing agent guidance and add the discoverable skill', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const agents = '# Existing Codex rules\r\n\r\nKeep this.\r\n';
    const claude = '# Existing Claude rules\n';
    const legacy = '# Legacy GraphKeeper guidance\n';
    await writeFile(join(fixture.root, 'AGENTS.md'), agents, 'utf8');
    await writeFile(join(fixture.root, 'CLAUDE.md'), claude, 'utf8');
    await writeFile(join(fixture.root, 'SKILL.md'), legacy, 'utf8');

    for (const force of [false, true]) {
      await initialize({
        cwd: fixture.root,
        force,
        environment: supportedInitEnvironment(),
      });
      assert.equal(await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'), agents);
      assert.equal(await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'), claude);
      assert.equal(await readFile(join(fixture.root, 'SKILL.md'), 'utf8'), legacy);
    }
    assert.match(
      await readFile(join(fixture.root, '.agents', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
      /^---\nname: graphkeeper\n/,
    );
  } finally {
    await fixture.cleanup();
  }
});

const codexBlock = [
  '<!-- graphkeeper:codex:start -->',
  '## GraphKeeper memory',
  '',
  'Before repeating repository investigation, invoke `$graphkeeper` to check',
  'existing durable findings. Record new durable, evidence-backed findings through',
  'that skill.',
  '<!-- graphkeeper:codex:end -->',
].join('\n');

test('Codex integration creates one managed block and is idempotent', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const claude = '# Claude guidance\n';
    await writeFile(join(fixture.root, 'CLAUDE.md'), claude, 'utf8');

    const first = await initialize({
      cwd: fixture.root,
      force: false,
      integrateCodex: true,
      environment: supportedInitEnvironment(),
    });
    assert.equal(await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'), codexBlock + '\n');
    assert.equal(await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'), claude);
    assert.equal(first.actions.find((action) => action.target === 'AGENTS.md')?.kind, 'create');

    const second = await initialize({
      cwd: fixture.root,
      force: true,
      integrateCodex: true,
      environment: supportedInitEnvironment(),
    });
    assert.equal(await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'), codexBlock + '\n');
    assert.equal(second.actions.find((action) => action.target === 'AGENTS.md')?.kind, 'skip');
  } finally {
    await fixture.cleanup();
  }
});

test('Codex integration appends with the existing CRLF convention and no lost bytes', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const existing = '# Existing rules\r\nKeep this exactly.';
    await writeFile(join(fixture.root, 'AGENTS.md'), existing, 'utf8');
    await initialize({
      cwd: fixture.root,
      force: false,
      integrateCodex: true,
      environment: supportedInitEnvironment(),
    });
    const expected = existing + '\r\n\r\n' + codexBlock.replace(/\n/g, '\r\n') + '\r\n';
    assert.equal(await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'), expected);
  } finally {
    await fixture.cleanup();
  }
});

test('Codex integration refreshes only its valid owned span', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const existing = '# Before\n<!-- graphkeeper:codex:start -->\nOld instructions\n'
      + '<!-- graphkeeper:codex:end -->\n# After\n';
    await writeFile(join(fixture.root, 'AGENTS.md'), existing, 'utf8');
    await initialize({
      cwd: fixture.root,
      force: false,
      integrateCodex: true,
      environment: supportedInitEnvironment(),
    });
    assert.equal(
      await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'),
      '# Before\n' + codexBlock + '\n# After\n',
    );
  } finally {
    await fixture.cleanup();
  }
});

test('malformed Codex markers stop initialization before any repository writes', async () => {
  for (const malformed of [
    '<!-- graphkeeper:codex:start -->\nmissing end\n',
    '<!-- graphkeeper:codex:end -->\nmissing start\n',
    '<!-- graphkeeper:codex:end -->\n<!-- graphkeeper:codex:start -->\n',
    '<!-- graphkeeper:codex:start -->\na\n<!-- graphkeeper:codex:start -->\n'
      + '<!-- graphkeeper:codex:end -->\n',
  ]) {
    const fixture = await createRepositoryFixture();
    try {
      await writeFile(join(fixture.root, 'AGENTS.md'), malformed, 'utf8');
      await assert.rejects(
        initialize({
          cwd: fixture.root,
          force: false,
          integrateCodex: true,
          environment: supportedInitEnvironment(),
        }),
        (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK004',
      );
      assert.equal(await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'), malformed);
      await assert.rejects(stat(join(fixture.root, 'graph', 'claims.json')));
    } finally {
      await fixture.cleanup();
    }
  }
});

test('a wrong-type AGENTS.md destination is preserved and rejected before writes', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await mkdir(join(fixture.root, 'AGENTS.md'));
    await assert.rejects(
      initialize({
        cwd: fixture.root,
        force: false,
        integrateCodex: true,
        environment: supportedInitEnvironment(),
      }),
      (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK004',
    );
    assert.equal((await stat(join(fixture.root, 'AGENTS.md'))).isDirectory(), true);
    await assert.rejects(stat(join(fixture.root, 'graph', 'claims.json')));
  } finally {
    await fixture.cleanup();
  }
});

test('Codex integration rejects a concurrent AGENTS.md change without overwriting it', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const existing = codexBlock.replace('## GraphKeeper memory', 'Old managed text') + '\n';
    const concurrent = '# Concurrent contributor edit\n';
    await writeFile(join(fixture.root, 'AGENTS.md'), existing, 'utf8');
    const hooks: InitWriteHooks = {
      beforeCommit: async (target) => {
        if (target === 'AGENTS.md') {
          await writeFile(join(fixture.root, 'AGENTS.md'), concurrent, 'utf8');
        }
      },
    };
    await assert.rejects(
      initialize({
        cwd: fixture.root,
        force: false,
        integrateCodex: true,
        environment: supportedInitEnvironment(),
        writeHooks: hooks,
      }),
      (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK004',
    );
    assert.equal(await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'), concurrent);
  } finally {
    await fixture.cleanup();
  }
});
