import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, root), 'utf8');
}

test('contribution guide states every prerequisite and supported platform boundary', async () => {
  const guide = await read('CONTRIBUTING.md');
  assert.match(guide, /Node(?:\.js)?\s*(?:>=|18).*18/is);
  for (const prerequisite of ['npm', 'Git', 'jq 1.6', 'POSIX']) {
    assert.match(guide, new RegExp(prerequisite, 'i'));
  }
  assert.match(guide, /Linux.*macOS/is);
  assert.match(guide, /Windows.*WSL.*Git Bash/is);
  assert.match(guide, /native\s+PowerShell.*not supported/is);
});

test('contribution guide defines v1 scope and concrete extension points', async () => {
  const guide = await read('CONTRIBUTING.md');
  for (const nonGoal of [
    'database backend',
    'hosted service',
    'authentication',
    'dashboard',
    'vector search',
    'multi-repository',
    'telemetry',
  ]) {
    assert.match(guide, new RegExp(nonGoal, 'i'));
  }
  for (const path of [
    'src/cli.ts',
    'src/commands/query.ts',
    'src/commands/doctor.ts',
    'scripts/validate.sh',
    'templates/graph/SCHEMA.md',
    'templates/SKILL.md',
    'tests/integration',
  ]) {
    assert.match(guide, new RegExp(path.replaceAll('/', '\\/')));
  }
  assert.match(guide, /canonical validator.*scripts\/validate\.sh/is);
  assert.match(guide, /validation\s+rule.*accepting\s+test.*rejecting\s+test/is);
});

test('contribution guide specifies test-first workflow and complete quality gates', async () => {
  const guide = await read('CONTRIBUTING.md');
  assert.match(guide, /failing test.*before.*implementation/is);
  for (const command of [
    'npm ci',
    'npm run build',
    'npm run typecheck',
    'npm test',
    'npm run test:security',
    'npm run test:performance',
    'npm run package:smoke',
  ]) {
    assert.match(guide, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(guide, /pull request.*tests.*documentation.*schema/is);
  assert.match(guide, /HOOK.*DOCTOR.*GUIDANCE/is);
});

test('contribution guide documents recovery and known scale limits', async () => {
  const guide = await read('CONTRIBUTING.md');
  assert.match(guide, /rerun.*graphkeeper init/is);
  assert.match(guide, /existing.*pre-commit.*chain/is);
  assert.match(guide, /repair.*GK[0-9x]{3}/is);
  assert.match(guide, /merge conflict.*preserve.*committed/is);
  assert.match(guide, /roll(?:\s+back|back).*previous npm version/is);
  assert.match(guide, /10,000 claims/);
  assert.match(guide, /2,000 entities/);
  assert.match(guide, /1,000 runs/);
  assert.match(guide, /256 MB/);
  assert.match(guide, /(?:20 percent.*regression|regression.*20 percent)/is);
});

test('SQLite and PostgreSQL remain a future good-first-issue design exploration', async () => {
  const guide = await read('CONTRIBUTING.md');
  assert.match(guide, /good first issue/i);
  assert.match(guide, /SQLite.*PostgreSQL/is);
  assert.match(guide, /design exploration.*not.*v1 implementation/is);
  assert.match(guide, /preserve.*IDs.*source variants.*supersession.*run lifecycle/is);
});

test('issue and pull-request templates require actionable engineering context', async () => {
  const bug = await read('.github/ISSUE_TEMPLATE/bug_report.yml');
  for (const field of ['reproduction', 'expected', 'actual', 'GK', 'check', 'doctor', 'environment']) {
    assert.match(bug, new RegExp(field, 'i'));
  }
  const feature = await read('.github/ISSUE_TEMPLATE/feature_request.yml');
  for (const field of ['scope', 'evidence', 'alternatives', 'constitution', 'v1']) {
    assert.match(feature, new RegExp(field, 'i'));
  }
  const pullRequest = await read('.github/pull_request_template.md');
  assert.match(pullRequest, /tests.*documentation.*schema compatibility.*constitution/is);
  assert.match(pullRequest, /npm test/);
  assert.match(pullRequest, /package:smoke/);
});

test('CI and repository settings cover all supported platforms and governance', async () => {
  const ci = await read('.github/workflows/ci.yml');
  for (const platform of ['ubuntu-latest', 'macos-latest', 'windows-latest']) {
    assert.match(ci, new RegExp(platform));
  }
  assert.match(ci, /windows-git-bash/is);
  assert.match(ci, /shell:\s*bash/);
  for (const command of ['npm run build', 'npm test', 'check', 'doctor', 'package:smoke']) {
    assert.match(ci, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const settings = await read('.github/repository-settings.md');
  assert.match(settings, /Description/);
  assert.match(settings, /Topics/);
  assert.match(settings, /Labels/);
  assert.match(settings, /Default branch.*main/is);
  assert.match(settings, /Branch protection.*required status checks/is);
  assert.match(settings, /quality-ubuntu.*quality-macos.*quality-windows/is);
});
