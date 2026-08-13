import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, root), 'utf8');
}

test('agent instructions have one shared source and a Claude-specific entry point', async () => {
  const agents = await read('AGENTS.md');
  const claude = await read('CLAUDE.md');
  const manifest = JSON.parse(await read('package.json')) as { readonly version: string };

  assert.match(agents, /canonical shared guidance/i);
  assert.match(agents, /package\.json.*source of truth/is);
  assert.doesNotMatch(
    agents,
    new RegExp('(?:starts at|version)\\s+' + manifest.version.replaceAll('.', '\\.'), 'i'),
  );

  assert.match(claude, /^@AGENTS\.md$/m);
  assert.match(claude, /\/graphkeeper/);
  assert.match(claude, /\.claude\/skills\/graphkeeper\/SKILL\.md/);
  for (const duplicatedRule of [
    'npm test',
    'append-only data model',
    'stable CLI diagnostics',
    'stored commands',
  ]) {
    assert.doesNotMatch(claude, new RegExp(duplicatedRule, 'i'));
  }
});

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

test('contribution guide explains the complete runtime flow and ownership boundaries', async () => {
  const guide = await read('CONTRIBUTING.md');
  for (const command of ['init', 'integrate remove', 'check', 'query', 'doctor', 'update']) {
    assert.match(guide, new RegExp('^' + command + '\\s+[-=]>', 'm'));
  }
  assert.match(guide, /init.*prerequisite.*plan.*templates.*Git hook.*agent adapter/is);
  assert.match(guide, /query.*check.*entity resolution.*jq/is);
  assert.match(guide, /doctor.*check.*graph-reference.*physical evidence/is);
  assert.match(guide, /update.*npm registry.*global install.*no repository changes/is);
  assert.match(guide, /shell validator.*commit-time authority/is);
  assert.match(guide, /TypeScript record parsers\s+are.*read-only consumers.*do not\s+replace/is);
  assert.match(guide, /graphkeeper doctor.*adds physical evidence.*do not run.*fast hook/is);
});

test('contribution guide fixes the supported platform and agent-adapter contract', async () => {
  const guide = await read('CONTRIBUTING.md');
  assert.match(guide, /graph.*schema.*CLI remain vendor-neutral/is);
  assert.match(guide, /Codex and Claude Code are explicit\s+internal adapters/is);
  assert.match(guide, /\.agents\/skills\/graphkeeper/is);
  assert.match(guide, /\.claude\/skills\/graphkeeper/is);
  assert.match(guide, /--integrate codex.*AGENTS\.md/is);
  assert.match(guide, /--integrate claude.*CLAUDE\.md/is);
  assert.match(guide, /not a public plugin framework/is);
  assert.match(guide, /Linux.*macOS.*directly/is);
  assert.match(guide, /Windows.*WSL.*Git Bash/is);
  assert.match(guide, /native PowerShell.*outside.*v1 runtime boundary/is);
});

test('contribution guide specifies test-first workflow and complete quality gates', async () => {
  const guide = await read('CONTRIBUTING.md');
  assert.match(guide, /failing test.*before.*implementation/is);
  for (const command of [
    'npm ci',
    'npm run build',
    'npm run typecheck',
    'npm test',
    'npm run test:functional',
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

  const issueConfig = await read('.github/ISSUE_TEMPLATE/config.yml');
  assert.match(issueConfig, /blank_issues_enabled:\s*false/);
  assert.match(issueConfig, /security\/advisories\/new/);
  assert.match(issueConfig, /github\.com\/anusbutt\/Graph_Keeper\/discussions/);

  const security = await read('.github/SECURITY.md');
  assert.match(security, /supported versions.*latest published/is);
  assert.match(security, /security\/advisories\/new/);
  assert.match(security, /do not.*public issue/is);

  const support = await read('.github/SUPPORT.md');
  assert.match(support, /README.*contributor guide/is);
  assert.match(support, /Q&A.*Ideas.*Design discussions.*Show and tell/is);
  assert.match(support, /bug report.*feature request/is);
  assert.match(support, /SECURITY\.md/);

  const conduct = await read('CODE_OF_CONDUCT.md');
  assert.match(conduct, /Contributor Covenant/);
  assert.match(conduct, /Enforcement/);
  assert.match(conduct, /report.*privately/is);

  const issueDrafts = await read('docs/contributor-issues.md');
  assert.equal((issueDrafts.match(/^## /gm) ?? []).length, 7);
  for (const field of ['Suggested labels', 'Context', 'Scope', 'Acceptance criteria']) {
    assert.equal((issueDrafts.match(new RegExp('\\*\\*' + field, 'g')) ?? []).length, 7);
  }

  const guide = await read('CONTRIBUTING.md');
  assert.match(guide, /GitHub Discussions.*does not authorize implementation/is);
  assert.match(guide, /accepts? a direction.*actionable scope.*issue/is);
});

test('CI and repository settings cover all supported platforms and governance', async () => {
  const ci = await read('.github/workflows/ci.yml');
  assert.match(ci, /actions\/checkout@v7/);
  assert.match(ci, /actions\/setup-node@v6/);
  assert.doesNotMatch(ci, /actions\/(?:checkout|setup-node)@v4/);
  for (const platform of ['ubuntu-latest', 'macos-latest', 'windows-latest']) {
    assert.match(ci, new RegExp(platform));
  }
  assert.match(ci, /windows-git-bash/is);
  assert.match(ci, /shell:\s*bash/);
  for (const command of [
    'npm run build',
    'npm run test:functional',
    'npm run test:performance',
    'check',
    'doctor',
    'package:smoke',
  ]) {
    assert.match(ci, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const performanceJob = ci.slice(ci.indexOf('  performance:'));
  assert.doesNotMatch(performanceJob, /Install jq|install jq/i);
  assert.match(ci, /Install jq for legacy validator/);

  const settings = await read('.github/repository-settings.md');
  assert.match(settings, /Description/);
  assert.match(settings, /Topics/);
  assert.match(settings, /Labels/);
  assert.match(settings, /Discussions.*Announcements.*Q&A.*Ideas.*Design discussions.*Show and tell/is);
  assert.match(settings, /Welcome to GraphKeeper Discussions/);
  assert.match(settings, /Default branch.*main/is);
  assert.match(settings, /Branch protection.*required status checks/is);
  assert.match(settings, /quality-ubuntu.*quality-macos.*quality-windows/is);
  assert.match(settings, /performance-ubuntu.*performance-windows-git-bash/is);
  assert.match(settings, /approvals are `0`.*one maintainer/is);
  assert.match(settings, /manual merge/is);
  assert.match(settings, /auto-merge/is);
  for (const label of ['area:testing', 'area:integration', 'area:architecture', 'help wanted']) {
    assert.match(settings, new RegExp(label));
  }
});
