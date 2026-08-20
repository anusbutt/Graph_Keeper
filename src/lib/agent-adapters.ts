import { GraphKeeperError } from './errors.js';

export interface AgentAdapter {
  readonly id: AgentId;
  readonly displayName: string;
  readonly skillTarget: string;
  readonly guidanceTarget: string;
  readonly invocation: string;
  readonly startMarker: string;
  readonly endMarker: string;
  readonly scaffoldSkillByInit?: boolean;
  readonly postInstallNote?: string;
}

export type GuidanceActionKind = 'create' | 'append' | 'refresh' | 'skip';

export interface GuidanceContentPlan {
  readonly kind: GuidanceActionKind;
  readonly content: string;
  readonly expected: string | null;
}

const adapters = [
  {
    id: 'codex',
    displayName: 'Codex',
    skillTarget: '.agents/skills/graphkeeper/SKILL.md',
    guidanceTarget: 'AGENTS.md',
    invocation: '`$graphkeeper`',
    startMarker: '<!-- graphkeeper:codex:start -->',
    endMarker: '<!-- graphkeeper:codex:end -->',
    scaffoldSkillByInit: true,
  },
  {
    id: 'claude',
    displayName: 'Claude Code',
    skillTarget: '.claude/skills/graphkeeper/SKILL.md',
    guidanceTarget: 'CLAUDE.md',
    invocation: '/graphkeeper',
    startMarker: '<!-- graphkeeper:claude:start -->',
    endMarker: '<!-- graphkeeper:claude:end -->',
    postInstallNote: 'Restart Claude Code if .claude/skills did not exist when the current session started.',
  },
  {
    id: 'cursor',
    displayName: 'Cursor',
    skillTarget: '.cursor/skills/graphkeeper/SKILL.md',
    guidanceTarget: '.cursor/rules/graphkeeper.md',
    invocation: '`@graphkeeper`',
    startMarker: '<!-- graphkeeper:cursor:start -->',
    endMarker: '<!-- graphkeeper:cursor:end -->',
    postInstallNote: 'Restart Cursor if .cursor/skills did not exist when the current session began.',
  },
  {
    id: 'opencode',
    displayName: 'OpenCode',
    skillTarget: '.opencode/skills/graphkeeper/SKILL.md',
    guidanceTarget: 'AGENTS.md',
    invocation: '`graphkeeper`',
    startMarker: '<!-- graphkeeper:opencode:start -->',
    endMarker: '<!-- graphkeeper:opencode:end -->',
    postInstallNote: 'Restart opencode if .opencode/skills did not exist when the current session began.',
  },
  {
    id: 'kilo',
    displayName: 'Kilo Code',
    skillTarget: '.kilo/skills/graphkeeper/SKILL.md',
    guidanceTarget: '.kilo/rules/graphkeeper.md',
    invocation: '`@graphkeeper`',
    startMarker: '<!-- graphkeeper:kilo:start -->',
    endMarker: '<!-- graphkeeper:kilo:end -->',
    postInstallNote: 'Restart Kilo Code if .kilo/skills did not exist when the current session began.',
  },
  {
    id: 'windsurf',
    displayName: 'Windsurf',
    skillTarget: '.windsurf/skills/graphkeeper/SKILL.md',
    guidanceTarget: '.windsurf/rules/graphkeeper.md',
    invocation: '`@graphkeeper`',
    startMarker: '<!-- graphkeeper:windsurf:start -->',
    endMarker: '<!-- graphkeeper:windsurf:end -->',
    postInstallNote: 'Restart Windsurf if .windsurf/skills did not exist when the current session began.',
  },
  {
    id: 'geminicli',
    displayName: 'Gemini CLI',
    skillTarget: '.gemini/skills/graphkeeper/SKILL.md',
    guidanceTarget: 'GEMINI.md',
    invocation: '`@graphkeeper`',
    startMarker: '<!-- graphkeeper:geminicli:start -->',
    endMarker: '<!-- graphkeeper:geminicli:end -->',
    postInstallNote: 'Restart Gemini CLI if .gemini/skills did not exist when the current session began.',
  },
] as const;

export type AgentId = (typeof adapters)[number]['id'];

export const AGENT_ADAPTERS: readonly AgentAdapter[] = adapters;
export const AGENT_IDS: readonly AgentId[] = adapters.map((adapter) => adapter.id);

export function isAgentId(value: string): value is AgentId {
  return AGENT_IDS.some((id) => id === value);
}

export function getAgentAdapter(id: AgentId): AgentAdapter {
  const adapter = AGENT_ADAPTERS.find((candidate) => candidate.id === id);
  if (adapter === undefined) throw new Error('Missing internal agent adapter: ' + id);
  return adapter;
}

function operational(message: string): GraphKeeperError {
  return new GraphKeeperError('GK004', 'operational', message);
}

function occurrenceCount(content: string, value: string): number {
  let count = 0;
  let offset = 0;
  while (true) {
    const found = content.indexOf(value, offset);
    if (found === -1) return count;
    count += 1;
    offset = found + value.length;
  }
}

function guidanceBlock(adapter: AgentAdapter, newline: string): string {
  return [
    adapter.startMarker,
    '## GraphKeeper memory',
    '',
    `Before repeating repository investigation, invoke ${adapter.invocation} to check`,
    'existing durable findings. Record new durable, evidence-backed findings through',
    'that skill.',
    adapter.endMarker,
  ].join(newline);
}

interface MarkerTally {
  start: number;
  end: number;
  firstStart?: number;
  lastEnd?: number;
}

const GRAPH_KEEPER_MARKER = /graphkeeper:([a-z0-9_-]+):(start|end)/gi;

function foreignMarkerProblem(
  adapter: AgentAdapter,
  content: string,
): { id: string; detail: string } | null {
  const tallies = new Map<string, MarkerTally>();
  for (const match of content.matchAll(GRAPH_KEEPER_MARKER)) {
    const id = match[1] as string;
    const kind = match[2] as 'start' | 'end';
    if (id === adapter.id) continue;
    let tally = tallies.get(id);
    if (tally === undefined) {
      tally = { start: 0, end: 0 };
      tallies.set(id, tally);
    }
    if (kind === 'start') {
      tally.start += 1;
      if (tally.firstStart === undefined) tally.firstStart = match.index ?? 0;
    } else {
      tally.end += 1;
      tally.lastEnd = match.index ?? 0;
    }
  }
  for (const [id, tally] of tallies) {
    if (!isAgentId(id)) {
      return { id, detail: 'contains an unregistered GraphKeeper marker' };
    }
    if (tally.start !== 1 || tally.end !== 1) {
      return { id, detail: 'contains malformed or repeated GraphKeeper markers' };
    }
    if (tally.firstStart !== undefined && tally.lastEnd !== undefined && tally.firstStart > tally.lastEnd) {
      return { id, detail: 'contains reversed GraphKeeper markers' };
    }
  }
  return null;
}

function rejectForeignOrMalformedMarkers(
  adapter: AgentAdapter,
  content: string,
): void {
  const problem = foreignMarkerProblem(adapter, content);
  if (problem !== null) {
    throw operational(
      adapter.guidanceTarget + ' ' + problem.detail + ' (' + problem.id + ')',
    );
  }
}

export function planGuidanceContent(
  adapter: AgentAdapter,
  existing: string | null,
): GuidanceContentPlan {
  if (existing === null) {
    return {
      kind: 'create',
      content: guidanceBlock(adapter, '\n') + '\n',
      expected: null,
    };
  }

  rejectForeignOrMalformedMarkers(adapter, existing);
  const newline = existing.includes('\r\n') ? '\r\n' : '\n';
  const block = guidanceBlock(adapter, newline);
  const startCount = occurrenceCount(existing, adapter.startMarker);
  const endCount = occurrenceCount(existing, adapter.endMarker);
  if (startCount === 0 && endCount === 0) {
    const separator = existing.length === 0
      ? ''
      : existing.endsWith(newline + newline)
        ? ''
        : existing.endsWith(newline)
          ? newline
          : newline + newline;
    return {
      kind: 'append',
      content: existing + separator + block + newline,
      expected: existing,
    };
  }
  if (startCount !== 1 || endCount !== 1) {
    throw operational(
      adapter.guidanceTarget + ' contains malformed or repeated GraphKeeper '
        + adapter.displayName + ' markers',
    );
  }

  const start = existing.indexOf(adapter.startMarker);
  const endStart = existing.indexOf(adapter.endMarker);
  if (start > endStart) {
    throw operational(
      adapter.guidanceTarget + ' contains reversed GraphKeeper '
        + adapter.displayName + ' markers',
    );
  }
  const end = endStart + adapter.endMarker.length;
  const content = existing.slice(0, start) + block + existing.slice(end);
  return {
    kind: content === existing ? 'skip' : 'refresh',
    content,
    expected: existing,
  };
}

export interface GuidanceRemovalContentPlan {
  readonly kind: 'remove' | 'skip';
  readonly content: string | null;
  readonly expected: string | null;
}

export function planGuidanceRemovalContent(
  adapter: AgentAdapter,
  existing: string | null,
): GuidanceRemovalContentPlan {
  if (existing === null) return { kind: 'skip', content: null, expected: null };

  rejectForeignOrMalformedMarkers(adapter, existing);
  const startCount = occurrenceCount(existing, adapter.startMarker);
  const endCount = occurrenceCount(existing, adapter.endMarker);
  if (startCount === 0 && endCount === 0) {
    return { kind: 'skip', content: existing, expected: existing };
  }
  if (startCount !== 1 || endCount !== 1) {
    throw operational(
      adapter.guidanceTarget + ' contains malformed or repeated GraphKeeper '
        + adapter.displayName + ' markers',
    );
  }

  const start = existing.indexOf(adapter.startMarker);
  const endStart = existing.indexOf(adapter.endMarker);
  if (start > endStart) {
    throw operational(
      adapter.guidanceTarget + ' contains reversed GraphKeeper '
        + adapter.displayName + ' markers',
    );
  }
  const end = endStart + adapter.endMarker.length;
  return {
    kind: 'remove',
    content: existing.slice(0, start) + existing.slice(end),
    expected: existing,
  };
}
