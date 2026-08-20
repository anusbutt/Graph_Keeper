import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  AGENT_ADAPTERS,
  AGENT_IDS,
  getAgentAdapter,
  isAgentId,
  planGuidanceContent,
  planGuidanceRemovalContent,
  type AgentAdapter,
} from '../../src/lib/agent-adapters.js';
import { GraphKeeperError } from '../../src/lib/errors.js';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

function sourceFile(relativePath: string): Promise<string> {
  return readFile(join(projectRoot, relativePath), 'utf8');
}

test('registers explicit adapters with independent destinations', () => {
  assert.deepEqual(AGENT_ADAPTERS.map((adapter) => adapter.id), ['codex', 'claude', 'cursor']);
  assert.deepEqual(
    AGENT_ADAPTERS.map((adapter) => adapter.skillTarget),
    [
      '.agents/skills/graphkeeper/SKILL.md',
      '.claude/skills/graphkeeper/SKILL.md',
      '.cursor/skills/graphkeeper/SKILL.md',
    ],
  );
  assert.deepEqual(
    AGENT_ADAPTERS.map((adapter) => adapter.guidanceTarget),
    ['AGENTS.md', 'CLAUDE.md', '.cursor/rules/graphkeeper.md'],
  );
  assert.notEqual(AGENT_ADAPTERS[0]?.startMarker, AGENT_ADAPTERS[1]?.startMarker);
  assert.notEqual(AGENT_ADAPTERS[1]?.startMarker, AGENT_ADAPTERS[2]?.startMarker);
});

test('plans Claude create, append, refresh, and skip without changing outside bytes', () => {
  const adapter = getAgentAdapter('claude');
  const created = planGuidanceContent(adapter, null);
  assert.equal(created.kind, 'create');
  assert.match(created.content, /invoke \/graphkeeper/);
  assert.match(created.content, /graphkeeper:claude:start/);

  const existing = '# Règles\r\nNo final newline';
  const appended = planGuidanceContent(adapter, existing);
  assert.equal(appended.kind, 'append');
  assert.ok(appended.content.startsWith(existing + '\r\n\r\n'));
  assert.doesNotMatch(appended.content.replace(existing, ''), /(^|[^\r])\n/);

  const stale = '# Before\n<!-- graphkeeper:claude:start -->\nOld\n'
    + '<!-- graphkeeper:claude:end -->\n# After';
  const refreshed = planGuidanceContent(adapter, stale);
  assert.equal(refreshed.kind, 'refresh');
  assert.ok(refreshed.content.startsWith('# Before\n'));
  assert.ok(refreshed.content.endsWith('\n# After'));
  assert.match(refreshed.content, /invoke \/graphkeeper/);

  assert.equal(planGuidanceContent(adapter, refreshed.content).kind, 'skip');
});

test('rejects missing, repeated, reversed, mixed, and malformed adapter markers', () => {
  const adapter = getAgentAdapter('claude');
  for (const malformed of [
    '<!-- graphkeeper:claude:start -->\nmissing end',
    '<!-- graphkeeper:claude:end -->\nmissing start',
    '<!-- graphkeeper:claude:end -->\n<!-- graphkeeper:claude:start -->',
    '<!-- graphkeeper:claude:start -->\na\n<!-- graphkeeper:claude:start -->\n'
      + '<!-- graphkeeper:claude:end -->',
    '<!-- graphkeeper:claude:start -->\n<!-- graphkeeper:codex:end -->',
    '<!-- graphkeeper:claude:start -->\n<!-- graphkeeper:claude:end -->\n'
      + '<!-- graphkeeper:codex:start -->',
  ]) {
    assert.throws(
      () => planGuidanceContent(adapter, malformed),
      (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK004',
      malformed,
    );
  }
});

test('removal deletes only the exact owned marker span', () => {
  const adapter = getAgentAdapter('codex');
  const existing = '# Before\n<!-- graphkeeper:codex:start -->\nManaged\n'
    + '<!-- graphkeeper:codex:end -->\n# After';
  assert.deepEqual(planGuidanceRemovalContent(adapter, existing), {
    kind: 'remove',
    content: '# Before\n\n# After',
    expected: existing,
  });
  assert.deepEqual(planGuidanceRemovalContent(adapter, '# No block'), {
    kind: 'skip',
    content: '# No block',
    expected: '# No block',
  });
});

test('every registered adapter satisfies the contract with unique, ordered ids', () => {
  const required: readonly (keyof AgentAdapter)[] = [
    'id',
    'displayName',
    'skillTarget',
    'guidanceTarget',
    'invocation',
    'startMarker',
    'endMarker',
  ];
  const seen = new Set<string>();
  for (const adapter of AGENT_ADAPTERS) {
    for (const key of required) {
      assert.equal(typeof adapter[key], 'string', adapter.id + ' must define ' + key);
      assert.ok((adapter[key] as string).length > 0, adapter.id + ' ' + key + ' must be non-empty');
    }
    assert.ok(
      adapter.postInstallNote === undefined || typeof adapter.postInstallNote === 'string',
      adapter.id + ' postInstallNote must be a string or absent',
    );
    assert.ok(!seen.has(adapter.id), 'duplicate adapter id: ' + adapter.id);
    seen.add(adapter.id);
  }
  assert.deepEqual(AGENT_IDS, AGENT_ADAPTERS.map((adapter) => adapter.id));
  assert.equal(new Set(AGENT_IDS).size, AGENT_IDS.length, 'AGENT_IDS must be unique');
  for (const id of AGENT_IDS) {
    assert.equal(isAgentId(id), true);
    assert.equal(getAgentAdapter(id).id, id);
  }
});

test('cli derives the agent grammar from AGENT_IDS instead of a literal codex|claude string', async () => {
  const cliSource = await sourceFile('src/cli.ts');
  assert.equal(
    cliSource.includes('codex|claude'),
    false,
    'src/cli.ts must not hardcode the agent list; derive the grammar from AGENT_IDS',
  );
});

test('init derives its skill-scaffolding skip set from adapter data, not a hardcoded codex literal', async () => {
  const initSource = await sourceFile('src/commands/init.ts');
  assert.equal(
    initSource.includes("Set<AgentId>(['codex'])"),
    false,
    'src/commands/init.ts must not hardcode a codex id; express the skip set as adapter data',
  );
});
