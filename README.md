# GraphKeeper

[![CI](https://github.com/anusbutt/Graph_Keeper/actions/workflows/ci.yml/badge.svg)](https://github.com/anusbutt/Graph_Keeper/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/graphkeeper.svg)](https://www.npmjs.com/package/graphkeeper)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Coding agents shouldn't just remember. They should be able to prove why they
remember.**

GraphKeeper gives coding agents grounded, auditable memory—stored beside the code,
reviewable in Git, and traceable to exact evidence.

GraphKeeper is not a transcript store or a generic memory wrapper. It records durable
project findings as flat claims linked to the run and evidence that produced them.
When a finding becomes outdated, a new claim explicitly supersedes it; the old claim
stays in Git history for review. The result is memory that Codex, Claude Code, and
humans can inspect without trusting an opaque summary or hosted service.

The core flow is deliberately small:

1. An agent discovers a stable project fact and captures the relevant output under
   `evidence/`.
2. It appends an entity, run, and evidence-backed claim to `graph/`.
3. `graphkeeper check` validates schema, provenance, and append-only history against
   the committed Git state.
4. A future session retrieves the active claim with `graphkeeper query <subject>`.
5. If the fact changes, the agent appends a new claim with `supersedes`; both
   generations remain auditable.

GraphKeeper does not ingest conversations or decide what should become memory. The
shipped Codex and Claude Code skills give agents the same explicit writing contract.

![How GraphKeeper gives coding agents durable project memory](https://raw.githubusercontent.com/anusbutt/Graph_Keeper/main/docs/assets/graphkeeper-overview.png)

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

The package is published as [`graphkeeper`](https://www.npmjs.com/package/graphkeeper).
GraphKeeper has no runtime npm dependencies. Node.js, npm, and Git are the normal
system prerequisites.

## Two-minute quickstart

Run this at the root of the repository whose memory you want to protect:

```sh
npx graphkeeper@latest init --integrate codex
# Or: npx graphkeeper@latest init --integrate claude
# Or: npx graphkeeper@latest init --integrate all
npx graphkeeper@latest check
```

Review the displayed plan and confirm it. `init` creates the JSON graph, `evidence/`,
the canonical validator, a pre-commit hook, and the repository-scoped Codex skill.
`--integrate codex` adds the Codex reminder to `AGENTS.md`; `--integrate claude` adds
the Claude skill and reminder; `--integrate all` does both. Codex uses
`.agents/skills/graphkeeper/SKILL.md`, `AGENTS.md`, and
`$graphkeeper`. Claude Code uses `.claude/skills/graphkeeper/SKILL.md`,
`CLAUDE.md`, and `/graphkeeper`. Both skills are generated from the same
`templates/SKILL.md`. Existing guidance outside the matching marked block is
preserved. Integration plans are shown before writing; answer the prompt, or pass
`--yes` in non-interactive automation. Use `--dry-run` for a complete read-only
preflight. Default init and `--force` do not create or change `AGENTS.md` or
`CLAUDE.md`.

Ask the selected agent to record a verified finding with `$graphkeeper` in Codex or
`/graphkeeper` in Claude Code. After it writes the claim and evidence, validate and
retrieve the result:

```sh
npx graphkeeper check
npx graphkeeper query test_payments_flaky
npx graphkeeper doctor
```

Commit the generated graph, validator, agent skills, and guidance files. The hook
normally lives under `.git` and is not committed;
`.githooks/pre-commit` is created only when GraphKeeper must preserve and chain another
hook. An empty `evidence/` directory becomes tracked with the first captured artifact.

To try the full discovery-to-supersession flow with populated data, copy
`examples/worked-example/graph` and `examples/worked-example/evidence` into a temporary
Git repository, then query `test_payments_flaky`.

## Before and after

Without grounded memory, a later session may only remember: “the payments test was
flaky.” It cannot tell whether that conclusion is current or where it came from. The
worked example records the initial failure as `claim_11111111`, captures a passing UTC
rerun, and appends `claim_22222222` with `supersedes: "claim_11111111"`.

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
| `graphkeeper init [--force] [--integrate <codex\|claude\|all>]... [--yes] [--dry-run]` | Scaffold safely and optionally install explicit Codex and/or Claude adapters. Distinct `--integrate` flags may repeat; `all` must stand alone. `--yes --dry-run` is accepted as a harmless dry run. |
| `graphkeeper integrate remove <codex\|claude> [--yes] [--dry-run]` | Remove only recognizable GraphKeeper-owned material for one adapter. Modified skills and unexpected supporting files are preserved for manual review. |
| `graphkeeper check` | Run the same fast schema, append-only history, and committed-evidence protection checks used by the Git hook. |
| `graphkeeper query <subject>` | Resolve an exact ID or unique alias and print active claims with provenance. It does not read evidence contents. |
| `graphkeeper doctor` | Run fast validation plus file existence, containment, line-range, dangling-reference, and unused-entity checks. |
| `graphkeeper update` | Check npm's stable `latest` release and globally install one exact newer version. Repository files are never changed. |

Exit codes are stable: `0` success, `1` validation failure, `2` usage error, `3` missing prerequisite, `4` operational failure, and `5` unexpected internal failure. Diagnostics begin with a searchable `GKnnn` code.

## Data and safety model

- `graph/entities.json` holds human-readable canonical identities. Identity fields cannot change; aliases and source documents may only grow.
- `graph/claims.json` holds flat claims. The validator rejects changes to committed claims; corrections append a new claim with `supersedes`.
- `graph/runs.json` opens a run, allows evidence and claim references to grow, and closes it once. The validator rejects later changes to a committed closed run.
- `evidence/` holds append-only captured artifacts. The validator and Git hook reject
  editing, removing, or renaming evidence that exists in committed Git history.
- Stored commands and evidence text are always data. GraphKeeper never evaluates them.

Immutability is enforced relative to committed Git history through GraphKeeper
validation and Git hooks; it is not cryptographic immutability. Git history remains
the reviewable source of truth. `doctor` additionally verifies physical evidence
existence, containment, and cited line ranges. `query` reports stored provenance but
does not open evidence or independently prove that a claim is true.

See the generated `graph/SCHEMA.md` and the GraphKeeper skill under
`.agents/skills/graphkeeper/` or `.claude/skills/graphkeeper/` for the complete
writing contract.
[`examples/reviewer.md`](examples/reviewer.md) is a copy-pasteable grounded-review
prompt.

## Recovery and adoption

- Re-running `init` is safe: existing graph data is skipped. Use `--force` only to refresh `graph/SCHEMA.md` and `.agents/skills/graphkeeper/SKILL.md`.
- A root `SKILL.md` created by an older GraphKeeper version is legacy user content. It is reported and preserved; migrate by committing the generated `.agents/skills/graphkeeper/SKILL.md`.
- `--integrate codex` manages the Codex skill plus one marked block in `AGENTS.md`;
  `--integrate claude` does the same for the Claude skill and `CLAUDE.md`. Multiple
  distinct flags and `--integrate all` use one plan and one confirmation.
- Integration creates a guidance file when absent, appends one block when no markers
  exist, and refreshes only that block later. Malformed, mixed, repeated, reversed,
  wrong-type, symlinked, or concurrently changed destinations fail with `GK004`.
- Non-interactive integration and removal require `--yes`; declined prompts and EOF
  leave the repository unchanged. `--dry-run` never prompts or writes.
- `graphkeeper integrate remove <agent>` removes an exact canonical skill and its
  matching block. User-modified skills and directories with unexpected files are
  preserved with manual-cleanup instructions.
- Restart Claude Code once if the current session began before the repository's
  top-level `.claude/skills/` directory was created.
- Run `graphkeeper update` from any supported shell, including native PowerShell, to
  update a global npm installation. It resolves the stable published version, installs only when that version is
  newer, and does not install prereleases. If the registry is offline, no update is
  attempted; retry when npm registry access returns.
- After updating an existing installation to 0.4.0, rerun `graphkeeper init --force`
  to refresh the repository skill and schema. This preserves `scripts/validate.sh`.
  Exact package-owned validators and hooks migrate to the Node path automatically.
  If a repository has a customized shell-only
  validator, review and migrate it manually; that legacy fallback can still require
  a POSIX `sh` and jq until migration is complete. Commit refreshed guidance and
  validators together so every contributor uses the same contract.
  See the [native Windows migration guide](docs/windows-migration.md) for package-owned
  and customized repository paths.
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
and boundaries, [prepared contribution issues](docs/contributor-issues.md),
[`SUPPORT.md`](.github/SUPPORT.md) for usage help, and
[`SECURITY.md`](.github/SECURITY.md) for private vulnerability reporting. Version
`0.4.0` is pre-1.0 and its API may change. Release ownership and the target version
must be verified immediately before publishing; completing the repository release
gates does not publish anything.

GraphKeeper is available under the [MIT License](LICENSE).
