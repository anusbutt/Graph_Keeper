import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { planScaffold } from '../../src/commands/init.js';
import { createRepositoryFixture } from '../helpers/repository.js';

const targets = [
  'graph/entities.json',
  'graph/claims.json',
  'graph/runs.json',
  'evidence',
  'graph/SCHEMA.md',
  'SKILL.md',
  'scripts/validate.sh',
];

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
      ['graph/SCHEMA.md', 'SKILL.md'],
    );
    assert.ok(plan.filter((action) => action.kind === 'skip').every((action) =>
      !['graph/SCHEMA.md', 'SKILL.md'].includes(action.target)));
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
