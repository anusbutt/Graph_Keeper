import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGENT_ADAPTERS,
  getAgentAdapter,
  planGuidanceContent,
  planGuidanceRemovalContent,
} from '../../src/lib/agent-adapters.js';
import { GraphKeeperError } from '../../src/lib/errors.js';

test('registers explicit Codex and Claude adapters with independent destinations', () => {
  assert.deepEqual(AGENT_ADAPTERS.map((adapter) => adapter.id), ['codex', 'claude']);
  assert.deepEqual(
    AGENT_ADAPTERS.map((adapter) => adapter.skillTarget),
    [
      '.agents/skills/graphkeeper/SKILL.md',
      '.claude/skills/graphkeeper/SKILL.md',
    ],
  );
  assert.deepEqual(
    AGENT_ADAPTERS.map((adapter) => adapter.guidanceTarget),
    ['AGENTS.md', 'CLAUDE.md'],
  );
  assert.notEqual(AGENT_ADAPTERS[0]?.startMarker, AGENT_ADAPTERS[1]?.startMarker);
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
