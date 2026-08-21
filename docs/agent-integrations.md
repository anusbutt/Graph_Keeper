# Agent integration architecture

GraphKeeper v1 supports the following explicit internal adapters:

| ID | Skill | Guidance | Invocation |
|---|---|---|---|
| `codex` | `.agents/skills/graphkeeper/SKILL.md` | `AGENTS.md` | `$graphkeeper` |
| `claude` | `.claude/skills/graphkeeper/SKILL.md` | `CLAUDE.md` | `/graphkeeper` |
| `cursor` | `.cursor/skills/graphkeeper/SKILL.md` | `.cursor/rules/graphkeeper.md` | `@graphkeeper` |
| `opencode` | `.opencode/skills/graphkeeper/SKILL.md` | `AGENTS.md` | `graphkeeper` |
| `kilo` | `.kilo/skills/graphkeeper/SKILL.md` | `.kilo/rules/graphkeeper.md` | `@graphkeeper` |
| `windsurf` | `.windsurf/skills/graphkeeper/SKILL.md` | `.windsurf/rules/graphkeeper.md` | `@graphkeeper` |
| `geminicli` | `.gemini/skills/graphkeeper/SKILL.md` | `GEMINI.md` | `@graphkeeper` |
| `kiro` | `.kiro/skills/graphkeeper/SKILL.md` | `.kiro/steering/graphkeeper.md` | `/graphkeeper` |
| `antigravity` | `.agents/skills/graphkeeper/SKILL.md` | `.agents/rules/graphkeeper.md` | `graphkeeper` |

Some adapters (for example Codex and OpenCode) share `AGENTS.md` as their guidance
file. GraphKeeper supports this: each adapter owns exactly one marked block, blocks
from other registered adapters are allowed when properly paired, and planning, append,
and remove always touch only the owning adapter's span. Unknown or malformed markers
are still rejected with `GK004`.

### Shared skill paths

Antigravity and Codex share the same skill file, `.agents/skills/graphkeeper/SKILL.md`.
Both are `scaffoldSkillByInit`, so `init` scaffolds that canonical file exactly once and
neither adapter rewrites it during `--integrate`. Removal is owner-scoped by the **primary
owner**: the first registered adapter on a shared skill path (Codex) is the only one that
removes the skill directory. Removing a non-owner sharer (Antigravity) preserves the shared
skill directory and removes only its guidance block, reporting a `preserve` action.

The closed registry in `src/lib/agent-adapters.ts` defines these destinations,
invocations, unique markers, and post-install notes. It is an implementation detail,
not a public plugin framework. Every skill file is rendered byte-for-byte from
`templates/SKILL.md`; vendor-specific text belongs only in adapter metadata and the
short marked reminder.

## Adding an adapter

Adapters are pure data. Adding a new agent is a single entry in the `adapters` array
in `src/lib/agent-adapters.ts`; the command logic, the CLI `--integrate` grammar, the
`--integrate all` expansion, and the removal machinery all derive from that registry
automatically.

An entry provides:

- `id` — the CLI token for `--integrate <id>` and `integrate remove <id>`.
- `displayName` — human-readable label used in plans and diagnostics.
- `skillTarget` — where the canonical `SKILL.md` is written.
- `guidanceTarget` — which file receives the marked reminder block.
- `invocation` — how the agent invokes the skill, used in the reminder text.
- `startMarker` / `endMarker` — HTML-comment markers delimiting GraphKeeper's owned block.
- `scaffoldSkillByInit` — set `true` only when the skill is also scaffolded by
  `graphkeeper init` (as for Codex), so the integration step skips rewriting it.
- `postInstallNote` — optional restart hint surfaced after installation.

To keep the registry well-formed, every entry must satisfy `AgentAdapter` (enforced by
the typed `AGENT_ADAPTERS` assignment), ids must be unique, and `AgentId` is derived
from the array. Tests under `tests/unit/agent-adapters.test.ts` guard these invariants.
Before choosing destinations, confirm the target product's actual skill/rules layout;
the Cursor paths above are a reasonable default, not a substitute for product docs.

## Command grammar

`init` accepts distinct repeated `--integrate codex` and
`--integrate claude` flags, or one standalone `--integrate all`. Duplicate adapter
IDs and combinations of `all` with an explicit adapter are usage errors.
`--yes --dry-run` is valid and behaves as a read-only dry run.

`integrate remove` accepts exactly one registered adapter. GraphKeeper never derives
paths for unknown products.

## Planning and authorization

Installation and removal first load and validate every target into an immutable plan.
The CLI prints that plan before any write. An interactive terminal receives one
default-No confirmation; a non-interactive caller must pass `--yes`. Dry-run prints
the same plan without prompting or writing. Apply uses the captured contents and
directory listings, so a change after planning fails with `GK004` instead of being
silently replanned.

Skill files are installed before their guidance blocks. Removal reverses that order.
Each replacement is atomic, and a failed multi-file operation rolls back completed
integration writes where the just-written bytes are still recognizable.

## Ownership and removal

GraphKeeper owns only:

- the exact matching marker span in the adapter's guidance file; and
- a skill file whose bytes match the packaged canonical template.

Text outside the markers is never owned. Removal leaves the guidance file itself in
place, removes the skill directory only when empty, and never recursively deletes an
unexpected tree. A modified skill, wrong-type path, symlink, or directory containing
supporting files is preserved and reported for manual cleanup.
