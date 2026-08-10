import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  planCodexGuidanceContent,
  planScaffold,
} from '../../src/commands/init.js';
import { GraphKeeperError } from '../../src/lib/errors.js';
import { createRepositoryFixture } from '../helpers/repository.js';

const targets = [
  'graph/entities.json',
  'graph/claims.json',
  'graph/runs.json',
  'evidence',
  'graph/SCHEMA.md',
  '.agents/skills/graphkeeper/SKILL.md',
  'scripts/validate.sh',
];

const codexBlock = [
  '<!-- graphkeeper:codex:start -->',
  '## GraphKeeper memory',
  '',
  'Before repeating repository investigation, invoke `$graphkeeper` to check',
  'existing durable findings. Record new durable, evidence-backed findings through',
  'that skill.',
  '<!-- graphkeeper:codex:end -->',
].join('\n');

test('plans a deterministic create action for every target in a new repository', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    const plan = await planScaffold(fixture.root, { force: false, isGitRepository: true });
    assert.deepEqual(plan.map((action) => action.target), targets);
    assert.deepEqual(plan.map((action) => action.kind), targets.map(() => 'create'));
  } finally {
    await fixture.cleanup();
  }
});

test('plans create and skip actions for a partial repository without mutation', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    await mkdir(join(fixture.root, 'graph'), { recursive: true });
    await writeFile(join(fixture.root, 'graph', 'claims.json'), '[{\"preserve\":true}]\n', 'utf8');
    const plan = await planScaffold(fixture.root, { force: false, isGitRepository: true });
    assert.equal(plan.find((action) => action.target === 'graph/claims.json')?.kind, 'skip');
    assert.equal(plan.find((action) => action.target === 'graph/entities.json')?.kind, 'create');
  } finally {
    await fixture.cleanup();
  }
});

test('plans only documentation refreshes under force for an existing scaffold', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    for (const target of targets) {
      const absolute = join(fixture.root, target);
      if (target === 'evidence') {
        await mkdir(absolute, { recursive: true });
      } else {
        await mkdir(join(absolute, '..'), { recursive: true });
        await writeFile(absolute, 'existing\n', 'utf8');
      }
    }
    const plan = await planScaffold(fixture.root, { force: true, isGitRepository: true });
    assert.deepEqual(
      plan.filter((action) => action.kind === 'refresh').map((action) => action.target),
      ['graph/SCHEMA.md', '.agents/skills/graphkeeper/SKILL.md'],
    );
    assert.ok(plan.filter((action) => action.kind === 'skip').every((action) =>
      !['graph/SCHEMA.md', '.agents/skills/graphkeeper/SKILL.md'].includes(action.target)));
  } finally {
    await fixture.cleanup();
  }
});

test('adds one prominent enforcement warning for a non-Git directory', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    const plan = await planScaffold(fixture.root, { force: false, isGitRepository: false });
    const warnings = plan.filter((action) => action.kind === 'warn');
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]?.target, 'git-enforcement');
    assert.match(warnings[0]?.reason ?? '', /disabled until git init/i);
  } finally {
    await fixture.cleanup();
  }
});

test('plans create, append, refresh, and skip for the owned Codex block', () => {
  assert.deepEqual(planCodexGuidanceContent(null), {
    kind: 'create',
    content: codexBlock + '\n',
    expected: null,
  });

  const existing = '# Existing guidance';
  assert.deepEqual(planCodexGuidanceContent(existing), {
    kind: 'append',
    content: existing + '\n\n' + codexBlock + '\n',
    expected: existing,
  });

  const stale = '# Before\n<!-- graphkeeper:codex:start -->\nOld\n'
    + '<!-- graphkeeper:codex:end -->\n# After\n';
  const refreshed = planCodexGuidanceContent(stale);
  assert.equal(refreshed.kind, 'refresh');
  assert.equal(refreshed.content, '# Before\n' + codexBlock + '\n# After\n');
  assert.equal(refreshed.expected, stale);

  const current = codexBlock + '\n';
  assert.deepEqual(planCodexGuidanceContent(current), {
    kind: 'skip',
    content: current,
    expected: current,
  });
});

test('rejects malformed, repeated, and reversed Codex markers', () => {
  for (const malformed of [
    '<!-- graphkeeper:codex:start -->\nmissing end\n',
    '<!-- graphkeeper:codex:end -->\nmissing start\n',
    '<!-- graphkeeper:codex:end -->\n<!-- graphkeeper:codex:start -->\n',
    '<!-- graphkeeper:codex:start -->\na\n<!-- graphkeeper:codex:start -->\n'
      + '<!-- graphkeeper:codex:end -->\n',
  ]) {
    assert.throws(
      () => planCodexGuidanceContent(malformed),
      (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK004',
    );
  }
});
