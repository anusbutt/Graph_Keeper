# Prepared contributor issue drafts

These are launch-ready drafts, not committed roadmap promises. A maintainer should
confirm priority and create the GitHub issue before work starts. Each task stays
inside GraphKeeper's v1 boundaries.

## Add a second worked example for a durable architecture constraint

**Suggested labels:** `good first issue`, `type:docs`, `area:testing`

**Context:** The current example explains a flaky-test correction well, but a second
domain would show that GraphKeeper stores durable project knowledge rather than only
test results.

**Scope:** Add a small generic example in which an agent discovers an architecture or
configuration constraint, records exact tool-output evidence, retrieves it, and later
supersedes it. Keep all data fictional and vendor-neutral.

**Acceptance criteria:**

- The example includes valid entities, two closed runs, evidence, and a two-claim
  supersession chain.
- `graphkeeper check` and `graphkeeper doctor` accept the copied fixture.
- The walkthrough shows the active query result and how to inspect exact evidence
  lines.
- An end-to-end test verifies provenance in both directions.

## Add Claude Code newline-preservation parity cases

**Suggested labels:** `good first issue`, `area:testing`, `area:integration`

**Context:** The shared integration planner promises byte-for-byte preservation of
guidance outside its marked block. Codex has focused CRLF and no-final-newline
coverage; Claude Code should have explicit parity coverage.

**Scope:** Extend `tests/integration/agent-integrations.test.ts` with Claude-specific
LF, CRLF, and no-final-newline install/refresh cases. Do not duplicate planner logic.

**Acceptance criteria:**

- Tests cover creating and refreshing the Claude block for all three newline shapes.
- Content outside GraphKeeper markers remains byte-for-byte unchanged.
- Repeated integration stays idempotent.
- Malformed markers still fail before any write with `GK004`.

## Add machine-readable output to `graphkeeper query`

**Suggested labels:** `help wanted`, `type:feature`, `area:cli`

**Context:** Human-readable output is useful in terminals, but integrations currently
must parse presentation text to consume resolved active claims and provenance.

**Scope:** Specify and implement an opt-in `graphkeeper query <subject> --json` output
without changing default output, validation order, active-claim selection, or exit
codes. Use only the existing parsed record model and add no runtime dependency.

**Acceptance criteria:**

- The JSON shape is documented and covered as a public compatibility contract.
- Canonical ID, unique alias, empty, ambiguous, unknown, and superseded cases are
  tested.
- Validation runs before selection exactly as it does for text output.
- Default text output remains byte-for-byte compatible.

## Add adversarial evidence-reference tests for platform path variants

**Suggested labels:** `help wanted`, `area:testing`, `area:doctor`

**Context:** Evidence containment is security-sensitive across Unix and Windows/Git
Bash path semantics. Existing traversal and symlink tests can be expanded with a
table of platform-looking hostile references.

**Scope:** Add fixture-driven rejection cases for drive-letter forms, UNC-like paths,
mixed separators, encoded-looking traversal, repeated separators, and valid nested
POSIX paths. Keep evidence contents inert.

**Acceptance criteria:**

- Each hostile shape has a rejecting test with the expected stable diagnostic.
- Valid nested repository-relative evidence remains accepted.
- Tests run in the existing Linux, macOS, Windows/Git Bash, and native Windows PowerShell CI jobs as applicable.
- No test executes stored commands or follows an escaping symlink.

## Document and test a shared-hook chaining recipe

**Suggested labels:** `good first issue`, `type:docs`, `area:integration`

**Context:** GraphKeeper preserves an existing pre-commit hook and emits chaining
guidance, but first-time users would benefit from one copyable, tested recipe.

**Scope:** Add a generic POSIX `sh` example that invokes an existing hook and the
GraphKeeper wrapper while preserving both exit statuses. Keep the existing no-
overwrite policy.

**Acceptance criteria:**

- Documentation explains normal `.git/hooks`, `core.hooksPath`, and
  `.githooks/pre-commit` placement.
- An end-to-end fixture proves both hooks run and either failure blocks the commit.
- Paths containing spaces are covered.
- Existing third-party hook bytes are never replaced.

## Explore a future storage boundary without implementing a backend

**Suggested labels:** `help wanted`, `type:docs`, `area:architecture`

**Context:** Linear JSON is intentionally the v1 source of truth up to the documented
scale ceiling. Before considering SQLite or PostgreSQL, the project needs evidence
about where that representation becomes limiting and which contracts must survive.

**Scope:** Produce a design note and measurements only. Do not add a database,
dependency, adapter interface, migration command, or schema change.

**Acceptance criteria:**

- Measurements identify the workload and point at which current budgets are missed.
- The note preserves IDs, source variants, provenance, supersession, run lifecycle,
  committed-evidence protection, and stable diagnostics.
- SQLite and PostgreSQL mappings and rollback considerations are compared.
- Any implementation proposal is left for a separately approved architecture issue.
