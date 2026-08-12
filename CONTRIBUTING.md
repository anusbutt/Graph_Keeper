# Contributing to GraphKeeper

GraphKeeper is intentionally a small, local, Git-backed CLI. Contributions should
preserve its auditable data model, zero runtime dependencies, and single canonical
validator. This guide is sufficient to locate the supported extension points and run
the project without private maintainer knowledge.

Participation in project spaces is governed by the
[Code of Conduct](CODE_OF_CONDUCT.md).

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

For bounded starter work, review the
[prepared contributor issue drafts](docs/contributor-issues.md). They identify useful
documentation, testing, CLI, and design tasks with acceptance criteria; maintainers
should triage a draft into a GitHub issue before implementation begins.

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

The public commands share one repository-local data model but take deliberately
different paths through it:

```text
init   -> prerequisite probes -> immutable plan -> templates and graph files -> Git hook -> optional agent adapters
integrate remove -> ownership preflight -> immutable plan -> conservative adapter cleanup
check  -> scripts/validate.sh --worktree
query  -> check -> exact entity resolution -> jq active-claim selection
doctor -> check -> graph-reference checks -> physical evidence inspection
update -> npm registry lookup -> exact global install (no repository changes)
```

The shell validator is the commit-time authority: both the pre-commit hook and
`graphkeeper check` execute `scripts/validate.sh`. The TypeScript record parsers are
read-only consumers used after validation and by deeper inspection; they do not
replace the shell validator. `graphkeeper doctor` adds physical evidence and graph
integrity checks that intentionally do not run in the fast hook path.

The graph, schema, and CLI remain vendor-neutral. Codex and Claude Code are explicit
internal adapters. They generate skills under `.agents/skills/graphkeeper/` and
`.claude/skills/graphkeeper/`, while `--integrate codex` and
`--integrate claude` manage independent marked blocks in `AGENTS.md` and
`CLAUDE.md`. Both consume the same canonical `templates/SKILL.md`; this registry is
not a public plugin framework. Linux and macOS run GraphKeeper directly. Windows runs
it through WSL or Git Bash; native PowerShell remains outside the v1 runtime boundary.

- `src/cli.ts` owns public command dispatch and argument usage.
- `src/commands/query.ts` owns entity resolution, active-claim selection, and query
  output. Query recipe changes require unit or integration cases for positive, empty,
  ambiguous, corrected, and hostile inputs as applicable.
- `src/commands/doctor.ts` and `src/lib/evidence.ts` own deep graph and physical
  evidence inspection.
- `src/commands/update.ts` owns stable-version comparison and the fixed npm registry
  and exact global-install argument arrays. It must remain independent of repository
  data and must never use a shell.
- The canonical validator is `scripts/validate.sh`. The pre-commit hook and
  `graphkeeper check` both invoke it; do not duplicate validation logic in TypeScript.
- `templates/graph/SCHEMA.md` is the shipped record contract.
- `templates/SKILL.md` is vendor-neutral agent guidance packaged to both registered
  skill destinations. Its YAML frontmatter contains only `name` and a
  trigger-focused `description`.
- `src/lib/agent-adapters.ts` defines the closed internal adapter registry and
  generic marked-block planner. `src/commands/integrate.ts` owns safe installation
  and conservative removal. `src/commands/init.ts` owns scaffold planning and
  application. Default and forced initialization preserve `AGENTS.md`, `CLAUDE.md`,
  and legacy root `SKILL.md` content. Never manage text outside matching GraphKeeper
  markers.
- `tests/integration` contains rule-isolated repository fixtures. A new validation
  rule needs both an accepting test and a rejecting test, in staged and worktree modes
  when selection behavior matters.
- `src/lib/records.ts` owns read-only TypeScript parsing. It does not replace jq as the
  commit-time source of truth.

Rules in shipped guidance use three labels: `HOOK` for fast mechanical enforcement,
`DOCTOR` for deep inspection, and `GUIDANCE` for behavior that software cannot infer.
Keep those labels accurate when changing documentation.

Changes to skill discovery or integration require both accepted and rejected tests:
validate generated frontmatter and package contents; preserve existing guidance
byte-for-byte; cover LF, CRLF, and no-final-newline files; reject malformed markers,
wrong destination types, duplicate flags, unsupported integration targets, and
concurrent edits before replacement.

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
    npm run test:functional
    npm test
    npm run test:security
    npm run test:performance
    npm run package:smoke
    npm ls --all
    sh -n scripts/validate.sh
    sh -n templates/pre-commit
    git diff --check

`npm test` includes all compiled tests and benchmarks for a complete local check.
`npm run release:verify` deliberately runs the deterministic functional, security,
and package gates; performance budgets run separately in dedicated Ubuntu and
Windows/Git Bash CI jobs. This keeps performance regressions visible without making
publication depend on temporary workstation load.

## Pull requests and labels

A question, early idea, or unresolved architecture tradeoff belongs in
[GitHub Discussions](https://github.com/anusbutt/Graph_Keeper/discussions). Discussion
does not authorize implementation or commit the project to a roadmap change. Once the
maintainer accepts a direction, summarize the actionable scope in an issue before
opening a pull request. Link the pull request with `Closes #<issue>` when it fully
resolves that work.

A pull request must explain the user-visible outcome, include failing-then-passing
tests, update documentation, state schema compatibility, and confirm constitutional
compliance. Include observed commands and results. Never hide skipped tests or weaken
an invariant to make a fixture pass.

Use the narrowest useful labels:

- `type:bug`, `type:feature`, or `type:docs`
- `area:cli`, `area:validator`, `area:doctor`, `area:templates`, `area:ci`,
  `area:testing`, `area:integration`, or `area:architecture`
- `breaking-schema` for any incompatible record interpretation
- `good first issue` only for bounded work with explicit acceptance checks
- `help wanted` for maintainer-approved work seeking community ownership

## Recovery runbooks

- Missing prerequisite: install the named tool, confirm its version, then rerun the
  failed command. GraphKeeper never installs jq automatically.
- Interrupted or repeated initialization: fix the reported cause and rerun
  `graphkeeper init`. Initialization is idempotent, and `--force` refreshes generated
  documentation only.
- Agent adoption: use `graphkeeper init --integrate codex`,
  `graphkeeper init --integrate claude`, repeated distinct flags, or
  `--integrate all`. Review the disclosed plan and confirm it, or pass `--yes` only
  in non-interactive automation. A malformed, mixed, or repeated marker pair fails
  with `GK004`; repair it deliberately instead of replacing the file.
- Agent removal: use `graphkeeper integrate remove <codex|claude>`. GraphKeeper
  removes only an exact canonical skill and matching marked block. Review preserved
  modified skills or unexpected supporting files manually.
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
- Update failure: confirm WSL or Git Bash, npm availability, registry access, and a
  user-writable global npm prefix. The command never falls back to local dependency
  installation or another package manager.

## Known scaling boundaries

The documented v1 ceiling is 10,000 claims, 2,000 entities, and 1,000 runs on a local
SSD reference environment. Query and doctor benchmarks also enforce a 256 MB peak
memory ceiling. A performance regression over 20 percent requires investigation before
release; correctness checks may never be skipped to recover speed.
The Unix reference budgets remain 10 seconds for initialization and doctor and 2
seconds for a 10,000-claim query. Windows/Git Bash budgets are 15 seconds for
initialization and doctor and 3 seconds for that query, reflecting process and
filesystem overhead rather than a different correctness standard.


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

## Agent-harness compatibility

The shipped `templates/SKILL.md` and `templates/graph/SCHEMA.md` are the interface for
agent harnesses. GraphKeeper has explicit Codex and Claude Code adapters, and both
install the same canonical skill in their repository skill paths. Any additional
harness adapter is a future, explicit change. A command-capable harness may invoke the
CLI directly. A file-editing harness may update the documented JSON and evidence
files, then invoke `graphkeeper check`. Both harness styles use the same records without vendor-specific
fields or conversion. Compatibility tests query one unchanged
graph through both harness styles and compare their active claim IDs.
