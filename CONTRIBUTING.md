# Contributing to GraphKeeper

GraphKeeper is intentionally a small, local, Git-backed CLI. Contributions should
preserve its auditable data model, zero runtime dependencies, and single canonical
validator. This guide is sufficient to locate the supported extension points and run
the project without private maintainer knowledge.

## Prerequisites and supported platforms

- Node.js >= 18 and npm.
- Git.
- jq 1.6 or newer.
- A POSIX-compatible `sh`.

Linux and macOS are supported directly. On Windows, use WSL or Git Bash; native
PowerShell execution is not supported in v1. PowerShell may install prerequisites for
CI, but GraphKeeper validation and hooks still run through Git Bash or WSL.

Install jq with the platform package manager when it is missing:

- Debian/Ubuntu: `sudo apt-get install jq`
- macOS with Homebrew: `brew install jq`
- Windows before opening Git Bash: `choco install jq`

Confirm the environment with `node --version`, `npm --version`, `git --version`,
`sh --version`, and `jq --version`.

## Fifteen-minute contributor path

From a fresh clone:

    npm ci
    npm run build
    npm run typecheck
    npm run test:unit

Then read `src/cli.ts`, `src/commands/query.ts`, and the matching tests. A small query
recipe should begin as a failing focused test, add the smallest selector or formatting
change, and finish with the complete quality gates below.

## Test-first workflow

1. Add a failing test before implementation. Put pure behavior in `tests/unit`,
   repository integration in `tests/integration`, full journeys in `tests/e2e`, hostile
   input in `tests/security`, and measurable budgets in `tests/performance`.
2. Run the narrowest relevant test directory and confirm the expected failure.
3. Make the smallest implementation or documentation change that satisfies it.
4. Run the focused test again, then every required quality gate.
5. Update schema, templates, examples, and guidance in the same change whenever their
   public contract is affected.

## Architecture and extension points

- `src/cli.ts` owns public command dispatch and argument usage.
- `src/commands/query.ts` owns entity resolution, active-claim selection, and query
  output. Query recipe changes require unit or integration cases for positive, empty,
  ambiguous, corrected, and hostile inputs as applicable.
- `src/commands/doctor.ts` and `src/lib/evidence.ts` own deep graph and physical
  evidence inspection.
- The canonical validator is `scripts/validate.sh`. The pre-commit hook and
  `graphkeeper check` both invoke it; do not duplicate validation logic in TypeScript.
- `templates/graph/SCHEMA.md` is the shipped record contract.
- `templates/SKILL.md` is vendor-neutral agent guidance.
- `tests/integration` contains rule-isolated repository fixtures. A new validation
  rule needs both an accepting test and a rejecting test, in staged and worktree modes
  when selection behavior matters.
- `src/lib/records.ts` owns read-only TypeScript parsing. It does not replace jq as the
  commit-time source of truth.

Rules in shipped guidance use three labels: `HOOK` for fast mechanical enforcement,
`DOCTOR` for deep inspection, and `GUIDANCE` for behavior that software cannot infer.
Keep those labels accurate when changing documentation.

## Version 1 boundaries

Version 1 has no database backend, hosted service, remote API, authentication or
authorization, UI or dashboard, vector search, multi-repository synchronization,
automatic transcript ingestion, native PowerShell support, binary evidence, automatic
merge resolution, or telemetry. It also has no plugin framework or storage abstraction.

Do not expand a focused change across these boundaries. Propose a specification and
architecture decision first when a change alters the data model, trust boundary,
public CLI, dependency policy, or append-only guarantees.

## Required quality gates

Run these before opening a pull request:

    npm run build
    npm run typecheck
    npm test
    npm run test:security
    npm run test:performance
    npm run package:smoke
    npm ls --all
    sh -n scripts/validate.sh
    sh -n templates/pre-commit
    git diff --check

`npm test` already includes all compiled tests and benchmarks; the explicit security
and performance commands are useful for focused evidence. CI repeats the gates on
Linux, macOS, and Windows through Git Bash.

## Pull requests and labels

A pull request must explain the user-visible outcome, include failing-then-passing
tests, update documentation, state schema compatibility, and confirm constitutional
compliance. Include observed commands and results. Never hide skipped tests or weaken
an invariant to make a fixture pass.

Use the narrowest useful labels:

- `type:bug`, `type:feature`, or `type:docs`
- `area:cli`, `area:validator`, `area:doctor`, `area:templates`, or `area:ci`
- `breaking-schema` for any incompatible record interpretation
- `good first issue` only for bounded work with explicit acceptance checks

## Recovery runbooks

- Missing prerequisite: install the named tool, confirm its version, then rerun the
  failed command. GraphKeeper never installs jq automatically.
- Interrupted or repeated initialization: fix the reported cause and rerun
  `graphkeeper init`. Initialization is idempotent, and `--force` refreshes generated
  documentation only.
- Existing pre-commit hook: preserve the existing hook and chain the generated
  `.githooks/pre-commit` wrapper as instructed by `graphkeeper init`; never overwrite
  third-party hook content.
- Validator or doctor failure: repair the named `GKxxx` record or evidence path. Restore
  committed claims and evidence, then append a correction or new evidence rather than
  rewriting history.
- JSON merge conflict: preserve every committed record by ID, combine growth-only
  entity and open-run sets, reject duplicate IDs or supersession forks, and run check
  plus doctor before committing the resolution.
- CLI rollback: install the previous npm version and rerun check and doctor. Generated
  graph data remains under Git control; do not roll back by deleting append-only
  claims or committed evidence.

## Known scaling boundaries

The documented v1 ceiling is 10,000 claims, 2,000 entities, and 1,000 runs on a local
SSD reference environment. Query and doctor benchmarks also enforce a 256 MB peak
memory ceiling. A performance regression over 20 percent requires investigation before
release; correctness checks may never be skipped to recover speed.

Concurrent contributors resolve JSON conflicts through ordinary Git review. Random
claim and run suffixes reduce collisions but do not provide automatic merge handling.

## Future storage good first issue

A future `good first issue` may explore how SQLite and PostgreSQL could represent the
same durable model. This is a design exploration, not a v1 implementation. Do not add
a database dependency, adapter interface, migration, or backend in the exploratory PR.

The design must preserve claim and entity IDs, source variants, supersession rules,
and run lifecycle semantics, plus evidence immutability and stable diagnostics. It
should measure where the 10,000-claim JSON ceiling becomes limiting and identify a
reversible migration boundary for a later specification.

## Two-harness compatibility

The shipped `templates/SKILL.md` and `templates/graph/SCHEMA.md` are the interface for
all agent harnesses. A command-capable harness may invoke the CLI directly. A
file-editing harness may update the documented JSON and evidence files, then invoke
`graphkeeper check`. Both must read and write the same records without vendor-specific
fields or conversion. Compatibility tests query one unchanged graph through both
harness styles and compare their active claim IDs.
