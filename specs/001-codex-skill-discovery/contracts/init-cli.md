# Contract: `graphkeeper init` Codex integration

## Accepted grammar

```text
graphkeeper init
graphkeeper init --force
graphkeeper init --integrate codex
graphkeeper init --force --integrate codex
graphkeeper init --integrate codex --force
```

`--force` and `--integrate codex` may each appear at most once.

## Rejected grammar

These return exit code 2 with `GK002` and perform no repository mutation:

- `graphkeeper init --integrate`
- `graphkeeper init --integrate claude`
- duplicate `--force`
- duplicate `--integrate codex`
- unknown flags or positional arguments

## Default filesystem output

```text
.agents/skills/graphkeeper/SKILL.md
graph/entities.json
graph/claims.json
graph/runs.json
graph/SCHEMA.md
evidence/
scripts/validate.sh
```

A clean repository does not receive root `SKILL.md`, `AGENTS.md`, or
`CLAUDE.md` from default initialization.

## Managed Codex block

```md
<!-- graphkeeper:codex:start -->
## GraphKeeper memory

Before repeating repository investigation, invoke `$graphkeeper` to check
existing durable findings. Record new durable, evidence-backed findings through
that skill.
<!-- graphkeeper:codex:end -->
```

## Exit and diagnostic behavior

| Condition | Exit | Diagnostic |
|-----------|------|------------|
| Success or idempotent skip | 0 | existing action report |
| Invalid CLI grammar | 2 | `GK002` |
| Missing runtime prerequisite | 3 | `GK003` |
| Wrong destination type, malformed markers, concurrent guidance change, or I/O failure | 4 | `GK004` |
| Unexpected internal failure | 5 | `GK005` |

## Ownership and preservation

- Default init preserves `AGENTS.md` and `CLAUDE.md` byte-for-byte.
- Codex integration owns only the single marked block.
- Existing root `SKILL.md` is legacy user content and is never changed.
- Graph records, evidence, validators, and third-party hooks retain their existing rules.
