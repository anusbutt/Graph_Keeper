import assert from 'node:assert/strict';
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  applyInitialization,
  initialize,
  prepareInitialization,
  type InitWriteHooks,
} from '../../src/commands/init.js';
import {
  applyAgentIntegrationPlan,
  prepareAgentRemoval,
} from '../../src/commands/integrate.js';
import { GraphKeeperError } from '../../src/lib/errors.js';
import { supportedInitEnvironment } from '../helpers/init.js';
import { createRepositoryFixture } from '../helpers/repository.js';

const template = async (): Promise<string> =>
  readFile(join(process.cwd(), 'templates', 'SKILL.md'), 'utf8');

test('Claude integration installs the canonical skill and one independent guidance block', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const agents = '# Existing Codex guidance\n';
    await writeFile(join(fixture.root, 'AGENTS.md'), agents, 'utf8');
    const report = await initialize({
      cwd: fixture.root,
      force: false,
      integrations: ['claude'],
      environment: supportedInitEnvironment(),
    });

    assert.equal(
      await readFile(join(fixture.root, '.claude', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
      await template(),
    );
    assert.equal(
      await readFile(join(fixture.root, '.agents', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
      await template(),
    );
    const claude = await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8');
    assert.match(claude, /<!-- graphkeeper:claude:start -->/);
    assert.match(claude, /invoke \/graphkeeper/);
    assert.equal((claude.match(/graphkeeper:claude:start/g) ?? []).length, 1);
    assert.equal(await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'), agents);
    assert.ok(report.notes.some((note) => /Restart Claude Code/.test(note)));
  } finally {
    await fixture.cleanup();
  }
});

test('Cursor integration installs the canonical skill and one independent guidance block', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const report = await initialize({
      cwd: fixture.root,
      force: false,
      integrations: ['cursor'],
      environment: supportedInitEnvironment(),
    });
    assert.equal(
      await readFile(join(fixture.root, '.cursor', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
      await template(),
    );
    const rules = await readFile(
      join(fixture.root, '.cursor', 'rules', 'graphkeeper.md'),
      'utf8',
    );
    assert.match(rules, /<!-- graphkeeper:cursor:start -->/);
    assert.match(rules, /invoke `@graphkeeper`/);
    assert.equal((rules.match(/graphkeeper:cursor:start/g) ?? []).length, 1);
    assert.ok(report.notes.some((note) => /Restart Cursor/.test(note)));
  } finally {
    await fixture.cleanup();
  }
});

test('Cursor removal deletes only canonical Cursor-owned material and leaves others intact', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await initialize({
      cwd: fixture.root,
      force: false,
      integrations: ['codex', 'claude', 'cursor'],
      environment: supportedInitEnvironment(),
    });
    const plan = await prepareAgentRemoval(fixture.root, 'cursor');
    assert.ok(plan.actions.some((action) =>
      action.kind === 'remove' && action.target === '.cursor/rules/graphkeeper.md'));
    await applyAgentIntegrationPlan(plan);

    assert.doesNotMatch(
      await readFile(join(fixture.root, '.cursor', 'rules', 'graphkeeper.md'), 'utf8'),
      /graphkeeper:cursor/,
    );
    await assert.rejects(stat(join(fixture.root, '.cursor', 'skills', 'graphkeeper')));
    assert.match(await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'), /graphkeeper:codex:start/);
    assert.match(await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'), /graphkeeper:claude:start/);

    const repeated = await prepareAgentRemoval(fixture.root, 'cursor');
    assert.ok(repeated.actions.every((action) => action.kind === 'skip'));
  } finally {
    await fixture.cleanup();
  }
});

test('OpenCode shares AGENTS.md with Codex and removal preserves the sibling block', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await initialize({
      cwd: fixture.root,
      force: false,
      integrations: ['codex', 'opencode'],
      environment: supportedInitEnvironment(),
    });
    assert.equal(
      await readFile(join(fixture.root, '.opencode', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
      await template(),
    );
    const agents = await readFile(join(fixture.root, 'AGENTS.md'), 'utf8');
    assert.match(agents, /graphkeeper:codex:start/);
    assert.match(agents, /graphkeeper:opencode:start/);
    assert.equal((agents.match(/graphkeeper:codex:start/g) ?? []).length, 1);
    assert.equal((agents.match(/graphkeeper:opencode:start/g) ?? []).length, 1);

    await applyAgentIntegrationPlan(await prepareAgentRemoval(fixture.root, 'opencode'));
    const after = await readFile(join(fixture.root, 'AGENTS.md'), 'utf8');
    assert.doesNotMatch(after, /graphkeeper:opencode/);
    assert.match(after, /graphkeeper:codex:start/);
    await assert.rejects(stat(join(fixture.root, '.opencode', 'skills', 'graphkeeper')));
    assert.equal(
      await readFile(join(fixture.root, '.agents', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
      await template(),
    );
  } finally {
    await fixture.cleanup();
  }
});

test('Kilo integration installs the canonical skill and one independent guidance block', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const report = await initialize({
      cwd: fixture.root,
      force: false,
      integrations: ['kilo'],
      environment: supportedInitEnvironment(),
    });
    assert.equal(
      await readFile(join(fixture.root, '.kilo', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
      await template(),
    );
    const rules = await readFile(
      join(fixture.root, '.kilo', 'rules', 'graphkeeper.md'),
      'utf8',
    );
    assert.match(rules, /<!-- graphkeeper:kilo:start -->/);
    assert.match(rules, /invoke `@graphkeeper`/);
    assert.equal((rules.match(/graphkeeper:kilo:start/g) ?? []).length, 1);
    assert.ok(report.notes.some((note) => /Restart Kilo Code/.test(note)));
  } finally {
    await fixture.cleanup();
  }
});

test('Windsurf integration installs the canonical skill and one independent guidance block', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const report = await initialize({
      cwd: fixture.root,
      force: false,
      integrations: ['windsurf'],
      environment: supportedInitEnvironment(),
    });
    assert.equal(
      await readFile(join(fixture.root, '.windsurf', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
      await template(),
    );
    const rules = await readFile(
      join(fixture.root, '.windsurf', 'rules', 'graphkeeper.md'),
      'utf8',
    );
    assert.match(rules, /<!-- graphkeeper:windsurf:start -->/);
    assert.match(rules, /invoke `@graphkeeper`/);
    assert.equal((rules.match(/graphkeeper:windsurf:start/g) ?? []).length, 1);
    assert.ok(report.notes.some((note) => /Restart Windsurf/.test(note)));
  } finally {
    await fixture.cleanup();
  }
});

test('Gemini CLI integration installs the canonical skill and one independent GEMINI.md block', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const report = await initialize({
      cwd: fixture.root,
      force: false,
      integrations: ['geminicli'],
      environment: supportedInitEnvironment(),
    });
    assert.equal(
      await readFile(join(fixture.root, '.gemini', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
      await template(),
    );
    const gemini = await readFile(join(fixture.root, 'GEMINI.md'), 'utf8');
    assert.match(gemini, /<!-- graphkeeper:geminicli:start -->/);
    assert.match(gemini, /invoke `@graphkeeper`/);
    assert.equal((gemini.match(/graphkeeper:geminicli:start/g) ?? []).length, 1);
    assert.ok(report.notes.some((note) => /Restart Gemini CLI/.test(note)));
  } finally {
    await fixture.cleanup();
  }
});

test('Kilo, Windsurf, and Gemini CLI removal deletes only canonical owned material and leaves others intact', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await initialize({
      cwd: fixture.root,
      force: false,
      integrations: ['kilo', 'windsurf', 'geminicli', 'codex'],
      environment: supportedInitEnvironment(),
    });
    for (const adapter of ['kilo', 'windsurf', 'geminicli'] as const) {
      const plan = await prepareAgentRemoval(fixture.root, adapter);
      await applyAgentIntegrationPlan(plan);
    }
    assert.doesNotMatch(
      await readFile(join(fixture.root, '.kilo', 'rules', 'graphkeeper.md'), 'utf8'),
      /graphkeeper:kilo/,
    );
    assert.doesNotMatch(
      await readFile(join(fixture.root, '.windsurf', 'rules', 'graphkeeper.md'), 'utf8'),
      /graphkeeper:windsurf/,
    );
    assert.doesNotMatch(await readFile(join(fixture.root, 'GEMINI.md'), 'utf8'), /graphkeeper:geminicli/);
    await assert.rejects(stat(join(fixture.root, '.kilo', 'skills', 'graphkeeper')));
    await assert.rejects(stat(join(fixture.root, '.windsurf', 'skills', 'graphkeeper')));
    await assert.rejects(stat(join(fixture.root, '.gemini', 'skills', 'graphkeeper')));
    assert.match(await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'), /graphkeeper:codex:start/);
    assert.equal(
      await readFile(join(fixture.root, '.agents', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
      await template(),
    );

    const repeated = await prepareAgentRemoval(fixture.root, 'geminicli');
    assert.ok(repeated.actions.every((action) => action.kind === 'skip'));
  } finally {
    await fixture.cleanup();
  }
});

test('multi-adapter installation is deterministic, idempotent, and isolated', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const first = await initialize({
      cwd: fixture.root,
      force: false,
      integrations: ['claude', 'codex'],
      environment: supportedInitEnvironment(),
    });
    assert.deepEqual(
      first.actions
        .filter((action) => ['AGENTS.md', 'CLAUDE.md'].includes(action.target))
        .map((action) => action.target),
      ['AGENTS.md', 'CLAUDE.md'],
    );

    const second = await initialize({
      cwd: fixture.root,
      force: true,
      integrations: ['codex', 'claude'],
      environment: supportedInitEnvironment(),
    });
    assert.equal(
      second.actions.find((action) => action.target === 'AGENTS.md')?.kind,
      'skip',
    );
    assert.equal(
      second.actions.find((action) => action.target === 'CLAUDE.md')?.kind,
      'skip',
    );
    assert.equal(
      await readFile(join(fixture.root, '.claude', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
      await template(),
    );
  } finally {
    await fixture.cleanup();
  }
});

test('planning is read-only and applying uses the exact planned snapshots', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const existing = '# Claude rules without final newline';
    await writeFile(join(fixture.root, 'CLAUDE.md'), existing, 'utf8');
    const plan = await prepareInitialization({
      cwd: fixture.root,
      force: false,
      integrations: ['claude'],
      environment: supportedInitEnvironment(),
    });
    assert.equal(await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'), existing);
    await assert.rejects(stat(join(fixture.root, 'graph')));

    const concurrent = '# Concurrent edit\n';
    await writeFile(join(fixture.root, 'CLAUDE.md'), concurrent, 'utf8');
    await assert.rejects(
      applyInitialization(plan),
      (error: unknown) =>
        error instanceof GraphKeeperError
        && error.code === 'GK004'
        && /changed after planning/.test(error.message),
    );
    assert.equal(await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'), concurrent);
    await assert.rejects(stat(join(fixture.root, 'graph')));
  } finally {
    await fixture.cleanup();
  }
});

test('a selected skill change after approval stops every planned write', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const plan = await prepareInitialization({
      cwd: fixture.root,
      force: false,
      integrations: ['claude'],
      environment: supportedInitEnvironment(),
    });
    const skill = join(fixture.root, '.claude', 'skills', 'graphkeeper', 'SKILL.md');
    await mkdir(join(skill, '..'), { recursive: true });
    await writeFile(skill, '# Concurrent skill\n', 'utf8');

    await assert.rejects(
      applyInitialization(plan),
      (error: unknown) =>
        error instanceof GraphKeeperError
        && error.code === 'GK004'
        && /changed after planning/.test(error.message),
    );
    assert.equal(await readFile(skill, 'utf8'), '# Concurrent skill\n');
    await assert.rejects(stat(join(fixture.root, 'graph')));
    await assert.rejects(stat(join(fixture.root, 'CLAUDE.md')));
  } finally {
    await fixture.cleanup();
  }
});

test('malformed markers in either selected adapter stop a multi-adapter init before writes', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const malformed = '<!-- graphkeeper:claude:start -->\nmissing end\n';
    await writeFile(join(fixture.root, 'CLAUDE.md'), malformed, 'utf8');
    await assert.rejects(
      initialize({
        cwd: fixture.root,
        force: false,
        integrations: ['codex', 'claude'],
        environment: supportedInitEnvironment(),
      }),
      (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK004',
    );
    assert.equal(await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'), malformed);
    await assert.rejects(stat(join(fixture.root, 'graph')));
    await assert.rejects(stat(join(fixture.root, 'AGENTS.md')));
  } finally {
    await fixture.cleanup();
  }
});

test('concurrent integration edits are preserved and prior integration writes roll back', async () => {
  const fixture = await createRepositoryFixture();
  try {
    const concurrent = '# Concurrent Claude edit\n';
    const hooks: InitWriteHooks = {
      beforeCommit: async (target) => {
        if (target === 'CLAUDE.md') {
          await writeFile(join(fixture.root, 'CLAUDE.md'), concurrent, 'utf8');
        }
      },
    };
    await assert.rejects(
      initialize({
        cwd: fixture.root,
        force: false,
        integrations: ['claude'],
        environment: supportedInitEnvironment(),
        writeHooks: hooks,
      }),
      (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK004',
    );
    assert.equal(await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'), concurrent);
    await assert.rejects(
      stat(join(fixture.root, '.claude', 'skills', 'graphkeeper', 'SKILL.md')),
    );
  } finally {
    await fixture.cleanup();
  }
});

test('removal deletes only canonical Claude-owned material and leaves Codex intact', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await initialize({
      cwd: fixture.root,
      force: false,
      integrations: ['codex', 'claude'],
      environment: supportedInitEnvironment(),
    });
    const plan = await prepareAgentRemoval(fixture.root, 'claude');
    assert.ok(plan.actions.some((action) =>
      action.kind === 'remove' && action.target === 'CLAUDE.md'));
    await applyAgentIntegrationPlan(plan);

    assert.doesNotMatch(await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'), /graphkeeper:claude/);
    await assert.rejects(stat(join(fixture.root, '.claude', 'skills', 'graphkeeper')));
    assert.match(await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'), /graphkeeper:codex:start/);
    assert.equal(
      await readFile(join(fixture.root, '.agents', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
      await template(),
    );

    const repeated = await prepareAgentRemoval(fixture.root, 'claude');
    assert.ok(repeated.actions.every((action) => action.kind === 'skip'));
  } finally {
    await fixture.cleanup();
  }
});

test('Codex removal is adapter-isolated and leaves Claude intact', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await initialize({
      cwd: fixture.root,
      force: false,
      integrations: ['codex', 'claude'],
      environment: supportedInitEnvironment(),
    });
    await applyAgentIntegrationPlan(
      await prepareAgentRemoval(fixture.root, 'codex'),
    );

    assert.doesNotMatch(await readFile(join(fixture.root, 'AGENTS.md'), 'utf8'), /graphkeeper:codex/);
    await assert.rejects(stat(join(fixture.root, '.agents', 'skills', 'graphkeeper')));
    assert.match(await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'), /graphkeeper:claude:start/);
    assert.equal(
      await readFile(join(fixture.root, '.claude', 'skills', 'graphkeeper', 'SKILL.md'), 'utf8'),
      await template(),
    );
  } finally {
    await fixture.cleanup();
  }
});

test('removal preserves modified skills and directories with unexpected files', async () => {
  for (const setup of ['modified', 'supporting-file'] as const) {
    const fixture = await createRepositoryFixture();
    try {
      await initialize({
        cwd: fixture.root,
        force: false,
        integrations: ['claude'],
        environment: supportedInitEnvironment(),
      });
      const skillDirectory = join(fixture.root, '.claude', 'skills', 'graphkeeper');
      if (setup === 'modified') {
        await writeFile(join(skillDirectory, 'SKILL.md'), '# User version\n', 'utf8');
      } else {
        await writeFile(join(skillDirectory, 'notes.md'), '# User notes\n', 'utf8');
      }

      const plan = await prepareAgentRemoval(fixture.root, 'claude');
      assert.ok(plan.actions.some((action) =>
        action.kind === 'preserve' && /manually/.test(action.reason)));
      await applyAgentIntegrationPlan(plan);
      assert.equal((await stat(skillDirectory)).isDirectory(), true);
      assert.ok((await readdir(skillDirectory)).length >= 1);
      assert.doesNotMatch(
        await readFile(join(fixture.root, 'CLAUDE.md'), 'utf8'),
        /graphkeeper:claude/,
      );
    } finally {
      await fixture.cleanup();
    }
  }
});

test('wrong-type integration guidance is rejected before any writes', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await mkdir(join(fixture.root, 'CLAUDE.md'));
    await assert.rejects(
      prepareInitialization({
        cwd: fixture.root,
        force: false,
        integrations: ['claude'],
        environment: supportedInitEnvironment(),
      }),
      (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK004',
    );
    await assert.rejects(stat(join(fixture.root, 'graph')));
  } finally {
    await fixture.cleanup();
  }
});
