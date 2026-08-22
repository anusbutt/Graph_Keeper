# GraphKeeper

[![CI](https://github.com/anusbutt/Graph_Keeper/actions/workflows/ci.yml/badge.svg)](https://github.com/anusbutt/Graph_Keeper/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/graphkeeper.svg)](https://www.npmjs.com/package/graphkeeper)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Coding agents shouldn't just remember. They should be able to prove why they
remember.**

GraphKeeper gives coding agents grounded, auditable memory—stored beside the code,
reviewable in Git, and traceable to exact evidence.

Coding agents forget project knowledge between sessions. GraphKeeper gives them
durable memory that is:

- **grounded in evidence** — every fact points at the exact lines that support it
- **stored in Git** — reviewable like any other change, not hidden in a hosted service
- **traceable to the run** that produced it
- **validated before becoming durable** — a commit hook and `graphkeeper check` reject
  bad or tampered records
- **able to supersede outdated knowledge** — corrections append a new claim instead of
  rewriting history

GraphKeeper is **Git-native, evidence-backed memory for coding agents**. It is not a
transcript store, a vector database, or a hosted memory service. It does not require a
backend, a database, or a separate memory server. Node.js 18+, npm, and Git are all
you need.

Works with any of the major coding agents you already use.

## Works with your coding agent

GraphKeeper ships first-class integrations for the coding agents below. If you use one
of them, GraphKeeper works with it.

| Coding agent | Integration flag | Skill | Guidance | Invocation |
|---|---|---|---|---|
| Codex | `--integrate codex` | `.agents/skills/graphkeeper/SKILL.md` | `AGENTS.md` | `$graphkeeper` |
| Claude Code | `--integrate claude` | `.claude/skills/graphkeeper/SKILL.md` | `CLAUDE.md` | `/graphkeeper` |
| Cursor | `--integrate cursor` | `.cursor/skills/graphkeeper/SKILL.md` | `AGENTS.md` | `@graphkeeper` |
| OpenCode | `--integrate opencode` | `.opencode/skills/graphkeeper/SKILL.md` | `AGENTS.md` | `graphkeeper` |
| Kilo Code | `--integrate kilo` | `.kilo/skills/graphkeeper/SKILL.md` | `.kilo/rules/graphkeeper.md` | `@graphkeeper` |
| Windsurf | `--integrate windsurf` | `.windsurf/skills/graphkeeper/SKILL.md` | `.windsurf/rules/graphkeeper.md` | `@graphkeeper` |
| Gemini CLI | `--integrate geminicli` | `.gemini/skills/graphkeeper/SKILL.md` | `GEMINI.md` | `@graphkeeper` |
| Kiro | `--integrate kiro` | `.kiro/skills/graphkeeper/SKILL.md` | `.kiro/steering/graphkeeper.md` | `/graphkeeper` |
| Antigravity | `--integrate antigravity` | `.agents/skills/graphkeeper/SKILL.md` | `.agents/rules/graphkeeper.md` | `graphkeeper` |

Install any subset, or all of them at once:

```sh
npx graphkeeper@latest init --integrate codex --integrate claude
# Or install every registered adapter:
npx graphkeeper@latest init --integrate all
```

Each integration installs a canonical skill your agent invokes, plus a small reminder
in the agent's guidance file. All skills are generated from one vendor-neutral
`templates/SKILL.md`. Adapters that share a guidance file (Codex and OpenCode both use
`AGENTS.md`) coexist: each owns one marked block, and your existing guidance outside
that block is preserved.

## Why GraphKeeper

Without durable memory, a coding agent that investigated something in one session
cannot tell a later session what it found, whether that finding is still current, or
where it came from.

```text
Without GraphKeeper

Agent session 1:  "The payments tests are flaky because of timezone issues."
Agent session 2:  "I don't know why the payments tests are flaky."
```

With GraphKeeper, the agent records the finding as a claim, captures the evidence it
came from, links both to the run that produced them, and commits the whole thing to
Git. A later session retrieves the claim, inspects its provenance, and continues from
there.

```text
With GraphKeeper

Claim  ──►  Evidence  ──►  Agent run  ──►  Git history  ──►  Next session
```

## Core idea

```text
Agent discovers something
        ↓
Evidence is captured
        ↓
Grounded claim is created
        ↓
GraphKeeper validates it
        ↓
Knowledge is stored in Git
        ↓
Future agent retrieves it
        ↓
Knowledge can be verified or superseded
```

The memory contract is deliberately small and explicit. An agent:

1. captures relevant output under `evidence/`;
2. appends an entity, a run, and an evidence-backed claim to `graph/`;
3. `graphkeeper check` validates schema, provenance, and append-only history against
   the committed Git state;
4. a future session retrieves the active claim with `graphkeeper query <subject>`;
5. it starts from a directly relevant grounded claim and performs only the freshness
   verification the current task requires — treating the claim as evidence to assess,
   not automatic truth;
6. if the fact changes, the agent appends a new claim with `supersedes`; both
   generations remain auditable.

GraphKeeper does not ingest conversations or decide what should become memory. The
shipped agent skills give every supported agent the same explicit writing contract.

## Two-minute quickstart

Prerequisites: **Node.js 18+**, **npm**, and **Git**. Supported on Linux, macOS,
Windows via Git Bash or WSL, and native Windows PowerShell.

Run this at the root of the repository whose memory you want to protect:

```sh
npx graphkeeper@latest init --integrate codex
npx graphkeeper@latest check
```

Review the displayed plan and confirm it. `init` creates the JSON graph, `evidence/`,
the canonical validator, a pre-commit hook, and the repository-scoped skill.
`--integrate codex` also adds the Codex reminder to `AGENTS.md`.

Now ask your agent to record a verified finding (with `$graphkeeper` in Codex,
`/graphkeeper` in Claude Code, or your agent's invocation from the table above). After
it writes the claim and evidence, validate and retrieve the result:

```sh
npx graphkeeper check
npx graphkeeper query test_payments_flaky
npx graphkeeper doctor
```

Commit the generated graph, validator, agent skill, and guidance file. The hook
normally lives under `.git` and is not committed; `.githooks/pre-commit` is created
only when GraphKeeper must preserve and chain another hook. An empty `evidence/`
directory becomes tracked with the first captured artifact.

To try the full discovery-to-supersession flow with populated data, copy
`examples/worked-example/graph` and `examples/worked-example/evidence` into a temporary
Git repository, then query `test_payments_flaky`.

## Before and after

Without grounded memory, a later session may only remember: “the payments test was
flaky.” It cannot tell whether that conclusion is current or where it came from.

The [worked example](examples/worked-example/README.md) records the initial failure as
`claim_11111111`, captures a passing UTC rerun, and appends `claim_22222222` with
`supersedes: "claim_11111111"`.

With GraphKeeper, the active correction remains a flat, reviewable claim:

```text
Entity: test_payments_flaky
Active claims: 2

Claim: claim_22222222
  Predicate: has_status
  Object: "passing_with_utc_default"
  Source: tool_output
  Command: "TZ=UTC npm test -- payments"
  Exit code: 0
  Evidence: evidence/utc-rerun.log#L1-L3
  Producer: run_2026-07-21-utc_rerun
```

The older claim remains in history and is marked as superseded. Reviewers can follow
the claim ID to the run and exact evidence lines instead of trusting an ungrounded
summary.

## What gets stored

GraphKeeper puts a small, human-readable structure beside your code:

```text
graph/
  entities.json    canonical subjects (stable IDs, aliases, source documents)
  claims.json      flat, evidence-backed facts about those subjects
  runs.json        the agent runs that produced claims and captured evidence
  SCHEMA.md        the generated record contract your agents follow
evidence/          append-only captured artifacts (logs, output, tool results)
scripts/
  validate.mjs     the canonical fast validator (used by check and the hook)
  validate.sh      legacy compatibility fallback (for unmigrated repos)
.agents/skills/graphkeeper/SKILL.md
                   the Codex agent skill (plus per-agent skills after --integrate)
```

Entities are the subjects of memory, claims are the grounded facts, runs record how a
claim came to be, and evidence is the captured output a claim points to. Everything is
plain JSON and text — no database, no server, no vector index.

## How it works

```text
                 CODING AGENTS
        ┌────────┬────────┬────────┬────────┐
        │ Codex  │ Claude │ Cursor │ OpenCode│ ... Kilo · Windsurf · Gemini · Kiro · Antigravity
        └────────┴───┬────┴────────┴────────┘
                     │  skill + guidance
                     ▼
               GraphKeeper CLI
        ┌────────────┼────────────┐
        ▼            ▼            ▼
     Claims       Runs         Evidence
        └────────────┼────────────┘
                     ▼
              Git repository
        (validated by hook + check)
                     ▼
             Future agent sessions
```

An agent writes to `graph/` and `evidence/`, and `graphkeeper check` (and the
installed pre-commit hook) validates the result. A future session calls
`graphkeeper query <subject>` to read active claims with their provenance.

## Commands

| Command | Role |
|---|---|
| `graphkeeper init [--force] [--integrate <adapter\|all>]... [--yes] [--dry-run]` | Scaffold the graph and optionally install agent adapters. Distinct `--integrate` flags may repeat; `all` must stand alone. `--yes --dry-run` is accepted as a harmless dry run. |
| `graphkeeper integrate remove <adapter> [--yes] [--dry-run]` | Remove only recognizable GraphKeeper-owned material for one adapter. Modified skills and unexpected supporting files are preserved. |
| `graphkeeper check` | Run the same fast schema, append-only history, and committed-evidence checks used by the Git hook. |
| `graphkeeper query <subject>` | Resolve an exact ID or unique alias and print active claims with provenance. It does not read evidence contents. |
| `graphkeeper doctor` | Run fast validation plus file existence, containment, line-range, dangling-reference, and unused-entity checks. |
| `graphkeeper update` | Check npm's stable `latest` release and globally install one exact newer version. Repository files are never changed. |
| `graphkeeper --help` | Print the supported command grammar and options. |
| `graphkeeper --version` (`-v`) | Print the installed GraphKeeper version. |

Exit codes are stable: `0` success, `1` validation failure, `2` usage error,
`3` missing prerequisite, `4` operational failure, and `5` unexpected internal
failure. Diagnostics begin with a searchable `GKnnn` code.

## Prerequisites

- Node.js 18 or newer and npm
- Git

Linux, macOS, Windows through Git Bash or WSL, and native Windows PowerShell are
supported. Native PowerShell does not require a POSIX shell or jq for current
GraphKeeper repositories.

## Installation

Run the current stable release without a permanent installation:

```sh
npx graphkeeper@latest --help
```

For repeated use, install the CLI globally:

```sh
npm install --global graphkeeper
graphkeeper --help
```

The package is published as [`graphkeeper`](https://www.npmjs.com/package/graphkeeper)
and has no runtime npm dependencies.

## Data model

GraphKeeper stores durable memory in three top-level JSON arrays:
`graph/entities.json`, `graph/claims.json`, and `graph/runs.json`. The generated
`graph/SCHEMA.md` is the complete contract; the highlights:

- **Entities** have a fixed, human-readable `id`, a `type`, an append-only set of
  `aliases`, optional `source_docs`, and an immutable `first_seen` timestamp.
- **Claims** are flat facts with `subject` (must resolve to an entity), `predicate`,
  `object`, optional `confidence`, and exactly one `source`: a `tool_output` source
  cites a command, exit code, and `evidence/<path>#L<start>-L<end>` reference, while
  an `inference` source records an honest `basis` (and can never use `confidence: 1`).
- **Runs** open with `started`, a `tool`, and growth-only `evidence` and
  `claims_written` arrays, and close exactly once by adding `ended` and one allowed
  `verdict` (`passed`, `failed`, `inconclusive`, `aborted`).

### How the pieces relate

```text
Entities
   ↓ (subject)
Claims ──── produced_by ────► Runs
   │                              ↑
   └── source.ref ──► Evidence ───┘ (listed in the run)
```

Provenance is bidirectional: a claim names its producing run and evidence reference,
and the run lists both the claim ID and the evidence path. Supersession is explicit:
a newer claim's `supersedes` field points at the older one, which stays in history.

Despite the name, GraphKeeper is **not a graph database**. It uses flat, Git-reviewable
JSON records. The "graph" is the conceptual network of entities, claims, evidence, and
runs, not an indexed graph store.

### Worked example

The complete flow, including a failing run, a passing UTC rerun that supersedes the
first claim, and an honest inference, lives in
[`examples/worked-example`](examples/worked-example/README.md). Run its populated graph
in a scratch repository and observe how `query` reports the active correction while
the superseded claim stays in history. `examples/reviewer.md` is a copy-pasteable
grounded-review prompt.

## Recovery and adoption

- **Immutability** is enforced relative to committed Git history through GraphKeeper
  validation and Git hooks; it is not cryptographic immutability. Git history remains
  the reviewable source of truth.
- Claims and committed evidence are append-only. Corrections append a successor with
  `supersedes`; they do not rewrite old data. Recover an accidental staged edit with
  your normal Git workflow; do not “fix” committed history by rewriting IDs.
- `doctor` verifies physical evidence existence, containment, and cited line ranges.
  `query` reports stored provenance but does not open evidence or independently prove
  that a claim is true.
- Re-running `init` is safe: existing graph data is skipped. Use `--force` only to
  refresh `graph/SCHEMA.md` and the generated skill.
- For a `GKnnn` failure, use the [diagnostic reference](docs/diagnostics.md) to identify
  the emitting command, exit class, and safe recovery before changing graph data.
- A root `SKILL.md` created by an older GraphKeeper version is legacy user content. It
  is reported and preserved; migrate by committing the generated
  `.agents/skills/graphkeeper/SKILL.md`.
- Integration creates a guidance file when absent, appends one marked block when no
  markers exist, and refreshes only that block later. Malformed, mixed, repeated,
  reversed, wrong-type, symlinked, or concurrently changed destinations fail with
  `GK004`. Non-interactive integration and removal require `--yes`; `--dry-run` never
  prompts or writes.
- If `.git/hooks/pre-commit` already belongs to another tool, GraphKeeper does not
  overwrite it. It writes `.githooks/pre-commit` and prints chaining instructions.
- When a commit is blocked, run `graphkeeper check`, fix every reported `GKnnn`
  violation, and stage the corrected files again. Run `graphkeeper doctor` for missing
  files or bad line ranges.
- Stored commands and evidence text are always data. GraphKeeper never evaluates them.
- After updating an existing installation to 0.4.0, rerun `graphkeeper init --force`
  to refresh the repository skill and schema. This preserves `scripts/validate.sh`.
  Exact package-owned validators and hooks migrate to the Node path automatically. If
  a repository has a customized shell-only validator, review and migrate it manually;
  that legacy fallback can still require a POSIX `sh` and jq until migration is
  complete. See the [native Windows migration guide](docs/windows-migration.md).

## Limitations

V1 is designed for one graph in one repository, up to about 10,000 claims, 2,000 entities, and 1,000 runs on a local SSD. Release gates target p95 under 3 seconds for
`check`, under 2 seconds for `query`, under 10 seconds for `doctor`, and under 256 MB
peak memory. It has no server, database, authentication, dashboard, telemetry, vector
search, or multi-repository synchronization.

When linear JSON scans or concurrent-write collisions become material, a future
storage adapter may preserve the same IDs, provenance, supersession, and run-lifecycle
contracts on SQLite or PostgreSQL. That migration is documentation-only in v1; the JSON
files remain the source of truth.

## Contributing and release status

Use [GitHub Discussions](https://github.com/anusbutt/Graph_Keeper/discussions) for
usage questions, early ideas, architecture conversations, and real-world show-and-tell.
Use [GitHub Issues](https://github.com/anusbutt/Graph_Keeper/issues) for reproducible
bugs and clearly bounded work. The
[pinned welcome discussion](https://github.com/anusbutt/Graph_Keeper/discussions/6)
explains the categories and how an accepted direction becomes an actionable issue.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the development workflow, extension points,
and boundaries, [prepared contribution issues](docs/contributor-issues.md),
[`SUPPORT.md`](.github/SUPPORT.md) for usage help, and
[`SECURITY.md`](.github/SECURITY.md) for private vulnerability reporting. Version
`0.4.1` is pre-1.0 and its API may change. Release ownership and the target version
must be verified immediately before publishing; completing the repository release
gates does not publish anything.

GraphKeeper is available under the [MIT License](LICENSE).
