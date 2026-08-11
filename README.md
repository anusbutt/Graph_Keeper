# GraphKeeper

[![CI](https://github.com/anusbutt/Graph_Keeper/actions/workflows/ci.yml/badge.svg)](https://github.com/anusbutt/Graph_Keeper/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/graphkeeper.svg)](https://www.npmjs.com/package/graphkeeper)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Grounded, auditable memory for coding agents—stored beside the code, protected by Git, and traceable to evidence.

Agents forget context and can repeat stale conclusions. GraphKeeper gives every durable finding a stable subject, provenance, and history. The store is plain JSON plus immutable evidence files, so humans can diff it, `jq` can query it, and a pre-commit hook can stop accidental rewrites.

![How GraphKeeper gives coding agents durable project memory](https://raw.githubusercontent.com/anusbutt/Graph_Keeper/main/docs/assets/graphkeeper-overview.png)

## Prerequisites

- Node.js 18 or newer and npm
- Git
- a POSIX `sh`
- jq 1.6 or newer ([install jq](https://jqlang.github.io/jq/download/))

Linux and macOS are supported directly. On Windows, run GraphKeeper in WSL or Git Bash, with `jq` available on `PATH`. Native PowerShell is not supported in v1.

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

The package is published as [`graphkeeper`](https://www.npmjs.com/package/graphkeeper).
GraphKeeper has no runtime npm dependencies; Git, a POSIX `sh`, and jq remain required
system prerequisites.

## Two-minute quickstart

Run this at the root of the repository whose memory you want to protect:

```sh
npx graphkeeper init
npx graphkeeper check
git add graph .agents/skills/graphkeeper scripts/validate.sh
git add .githooks/pre-commit 2>/dev/null || true
git commit -m "Initialize GraphKeeper memory"
```

`init` creates an empty `graph/`, an `evidence/` directory, the repository-scoped
Codex skill at `.agents/skills/graphkeeper/SKILL.md`, the canonical validator, and a
pre-commit hook. Codex discovers that skill from its standard repository skill path
and loads its full instructions when `$graphkeeper` is invoked or the request clearly
matches its description. The hook normally lives under `.git` and is not committed;
`.githooks/pre-commit` exists only when GraphKeeper must preserve and chain another
hook. An empty `evidence/` directory becomes tracked when the first evidence file is
added.

For always-visible Codex guidance, opt in explicitly:

```sh
npx graphkeeper init --integrate codex
```

This creates or updates only GraphKeeper's marked block in root `AGENTS.md`. Existing
guidance outside that block is preserved. Default init and `--force` do not create or
change `AGENTS.md` or `CLAUDE.md`.

When an agent records a finding, retrieve it by canonical entity ID or an exact unique alias:

```sh
npx graphkeeper query test_payments_flaky
npx graphkeeper doctor
```

To try populated data from a source checkout, copy `examples/worked-example/graph` and `examples/worked-example/evidence` into a temporary Git repository and query `test_payments_flaky`.

## Before and after

Without durable memory, a later session may only remember: “the payments test was flaky.” It cannot tell whether that conclusion is current or where it came from.

With GraphKeeper, the active correction remains a flat, reviewable claim:

```text
Entity: test_payments_flaky
Claim: claim_22222222
  Predicate: has_root_cause
  Object: "timezone_default"
  Source: tool_output
  Evidence: evidence/utc-rerun.log#L1-L3
  Producer: run_2026-07-21-utc_fix
```

The older claim remains in history and is marked as superseded. Reviewers can follow the claim ID to the run and exact evidence lines instead of trusting an ungrounded summary.

## Commands

| Command | Role |
|---|---|
| `graphkeeper init [--force] [--integrate codex]` | Scaffold safely. `--force` refreshes generated schema and skill templates; Codex integration explicitly manages one marked `AGENTS.md` block. |
| `graphkeeper check` | Run the same fast schema, history, and evidence-immutability validation used by the Git hook. |
| `graphkeeper query <subject>` | Resolve an exact ID or unique alias and print active claims with provenance. It does not read evidence contents. |
| `graphkeeper doctor` | Run fast validation plus file existence, containment, line-range, dangling-reference, and unused-entity checks. |
| `graphkeeper update` | Check npm's stable `latest` release and globally install one exact newer version. Repository files are never changed. |

Exit codes are stable: `0` success, `1` validation failure, `2` usage error, `3` missing prerequisite, `4` operational failure, and `5` unexpected internal failure. Diagnostics begin with a searchable `GKnnn` code.

## Data and safety model

- `graph/entities.json` holds human-readable canonical identities. Identity fields cannot change; aliases and source documents may only grow.
- `graph/claims.json` holds flat claims. Existing claims are immutable; corrections append a new claim with `supersedes`.
- `graph/runs.json` opens a run, allows evidence and claim references to grow, closes it once, then makes it immutable.
- `evidence/` holds captured artifacts. A committed evidence file cannot be edited, removed, or renamed.
- Stored commands and evidence text are always data. GraphKeeper never evaluates them.

See the generated `graph/SCHEMA.md` and
`.agents/skills/graphkeeper/SKILL.md` for the complete writing contract.
[`examples/reviewer.md`](examples/reviewer.md) is a copy-pasteable grounded-review
prompt.

## Recovery and adoption

- Re-running `init` is safe: existing graph data is skipped. Use `--force` only to refresh `graph/SCHEMA.md` and `.agents/skills/graphkeeper/SKILL.md`.
- A root `SKILL.md` created by an older GraphKeeper version is legacy user content. It is reported and preserved; migrate by committing the generated `.agents/skills/graphkeeper/SKILL.md`.
- `--integrate codex` creates `AGENTS.md` when absent, appends one marked block when no markers exist, and refreshes only that block on later runs. Malformed, repeated, or concurrently changed markers fail with `GK004` instead of risking existing guidance.
- GraphKeeper does not create or edit `CLAUDE.md` in this Codex-only launch.
- Run `graphkeeper update` from WSL or Git Bash to update a global npm installation.
  It first resolves the stable published version, installs only when that version is
  newer, and does not install prereleases. If the registry is offline, no update is
  attempted; retry when npm registry access returns.
- A global npm permission error returns `GK004` without changing the repository.
  Configure npm through a Node version manager or a user-writable npm prefix, then
  retry. See npm's
  [global installation guidance](https://docs.npmjs.com/downloading-and-installing-packages-globally/).
- In a non-Git directory, files are scaffolded but hook enforcement is disabled until `git init` and another `graphkeeper init`.
- If `.git/hooks/pre-commit` already belongs to another tool, GraphKeeper does not overwrite it. It writes `.githooks/pre-commit` and prints chaining instructions.
- If `core.hooksPath` is set, GraphKeeper installs there. Resolve any existing non-GraphKeeper hook explicitly rather than deleting it.
- When a commit is blocked, run `graphkeeper check`, fix every reported `GKnnn` violation, and stage the corrected files again. Run `graphkeeper doctor` for missing files or bad line ranges.
- Graph records are append-only by semantics. Recover an accidental staged edit with your normal Git workflow; do not “fix” committed history by rewriting IDs.

## V1 limits and future path

V1 is designed for one graph in one repository, up to about 10,000 claims, 2,000 entities, and 1,000 runs on a local SSD. Release gates target p95 under 3 seconds for `check`, under 2 seconds for `query`, under 10 seconds for `doctor`, and under 256 MB peak memory. It has no server, database, authentication, dashboard, telemetry, vector search, or multi-repository synchronization.

When linear JSON scans or concurrent-write collisions become material, a future storage adapter may preserve the same IDs, provenance, supersession, and run-lifecycle contracts on SQLite or PostgreSQL. That migration is documentation-only in v1; the JSON files remain the source of truth.

## Contributing and release status

Use [GitHub Discussions](https://github.com/anusbutt/Graph_Keeper/discussions) for
usage questions, early ideas, architecture conversations, and real-world show-and-tell.
Use [GitHub Issues](https://github.com/anusbutt/Graph_Keeper/issues) for reproducible
bugs and clearly bounded work. The
[pinned welcome discussion](https://github.com/anusbutt/Graph_Keeper/discussions/6)
explains the categories and how an accepted direction becomes an actionable issue.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the development workflow, extension points,
and boundaries, [`SUPPORT.md`](.github/SUPPORT.md) for usage help, and
[`SECURITY.md`](.github/SECURITY.md) for private vulnerability reporting. Version
`0.1.3` is pre-1.0 and its API may change. Release ownership and the target version
must be verified immediately before publishing; completing the repository release
gates does not publish anything.

GraphKeeper is available under the [MIT License](LICENSE).
