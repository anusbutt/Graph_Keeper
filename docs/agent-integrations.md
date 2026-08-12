# Agent integration architecture

GraphKeeper v1 supports two explicit internal adapters:

| ID | Skill | Guidance | Invocation |
|---|---|---|---|
| `codex` | `.agents/skills/graphkeeper/SKILL.md` | `AGENTS.md` | `$graphkeeper` |
| `claude` | `.claude/skills/graphkeeper/SKILL.md` | `CLAUDE.md` | `/graphkeeper` |

The closed registry in `src/lib/agent-adapters.ts` defines these destinations,
invocations, unique markers, and post-install notes. It is an implementation detail,
not a public plugin framework. Both skill files are rendered byte-for-byte from
`templates/SKILL.md`; vendor-specific text belongs only in adapter metadata and the
short marked reminder.

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
