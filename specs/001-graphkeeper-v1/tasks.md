# Tasks: GraphKeeper v1

**Input**: 'specs/001-graphkeeper-v1/spec.md' and
'specs/001-graphkeeper-v1/plan.md'  
**Prerequisites**: Ratified constitution, approved specification, approved technical
plan  
**Status**: Approved for phased implementation  
**Execution rule**: Complete tasks in numeric order and run focused verification after
every task. At the end of each phase, show the combined observed results and wait for a
go/no-go decision before starting the next phase.

## Format

- '[P]' means the task can be prepared in parallel with adjacent tasks because it
  changes a different file and has no dependency on unfinished work.
- '[USn]' maps the task to the corresponding user story in the specification.
- Test tasks precede the implementation they verify and must demonstrate the expected
  failure before implementation begins.
- Every task names the exact primary file or directory it changes.

## Phase 1: Setup

**Purpose**: Establish the smallest compilable and testable npm CLI package.

- [x] T001 Create the npm package metadata, Node 18 engine, ESM mode, public 0.1.0 version, bin entry, and zero runtime dependencies in package.json
- [x] T002 [P] Configure strict TypeScript compilation to dist/ for Node 18 ESM in tsconfig.json
- [x] T003 Add the minimal command dispatcher and help/usage exit behavior in src/cli.ts
- [x] T004 [P] Add isolated temporary-repository and Git fixture helpers in tests/helpers/repository.ts
- [x] T005 Add build, test, typecheck, package-smoke, and performance scripts in package.json
- [x] T006 Add the baseline help, unknown-command, and exit-code smoke tests in tests/e2e/cli-help.test.ts

**Checkpoint**: The empty package builds, its CLI help runs, and the test runner is
usable before shared behavior is added.

---

## Phase 2: Foundational Invariants

**Purpose**: Implement shared contracts and the canonical validator that every user
story relies on.

**CRITICAL**: No user-story implementation starts until this phase passes.

- [x] T007 Add failing tests for claim, entity, run, source-variant, ID, timestamp, confidence, and verdict contracts in tests/unit/records.test.ts
- [x] T008 Implement the TypeScript record types and read-only parsing helpers used by query and doctor in src/lib/records.ts
- [x] T009 [P] Add failing tests for stable GK error codes, exit-code mapping, and stdout/stderr separation in tests/unit/errors.test.ts
- [x] T010 Implement the error taxonomy and result formatting primitives in src/lib/errors.ts
- [x] T011 [P] Add failing tests for repository-root discovery, safe path resolution, traversal rejection, and symlink containment in tests/unit/paths.test.ts
- [x] T012 Implement repository and evidence path normalization helpers in src/lib/paths.ts
- [x] T013 [P] Add failing tests for fixed-argument subprocess execution, timeout handling, missing tools, and non-execution of stored command text in tests/unit/process.test.ts
- [x] T014 Implement the safe subprocess and prerequisite-probe wrapper in src/lib/process.ts
- [x] T015 Add failing tests for HEAD detection, staged blob reads, custom hooksPath resolution, and Git error translation in tests/unit/git.test.ts
- [x] T016 Implement read-only Git operations and hook-path discovery in src/lib/git.ts
- [x] T017 Add failing jq fixtures for top-level arrays, exact fields, IDs, timestamps, source variants, confidence, and unique IDs in tests/integration/validator-schema.test.ts
- [x] T018 Implement the schema and unique-ID portions of the normative validator from the plan in scripts/validate.sh
- [x] T019 Add failing fixtures for subject, run, claim, evidence-path, bidirectional provenance, fork, and cycle relationships in tests/integration/validator-relations.test.ts
- [x] T020 Implement cross-record provenance, supersession target, single-successor, and acyclic-chain checks in scripts/validate.sh
- [x] T021 Add failing fixtures for semantic claim immutability, entity growth, run transitions, first commit, and committed-evidence changes in tests/integration/validator-history.test.ts
- [x] T022 Implement HEAD comparison, semantic append-only records, first-commit behavior, and committed-evidence protection in scripts/validate.sh
- [x] T023 Add staged/worktree parity, stable diagnostic-code, multi-error, and jq-version tests in tests/integration/validator-modes.test.ts
- [x] T024 Complete --staged and --worktree selection, safe error accumulation, prerequisite failures, and final summaries in scripts/validate.sh
- [x] T025 Add failing conformance tests for empty graph arrays, placeholder-free documentation, and the minimal hook wrapper in tests/integration/templates.test.ts
- [x] T026 Create conforming empty arrays in templates/graph/entities.json, templates/graph/claims.json, and templates/graph/runs.json plus baseline templates/graph/SCHEMA.md and templates/SKILL.md
- [x] T027 Create the marked, executable pre-commit wrapper that invokes the repository-local validator in templates/pre-commit

**Checkpoint**: The canonical validator passes shell syntax checks and its complete
fixture matrix in both modes. Starter records pass validation.

---

## Phase 3: User Story 1 - Initialize Grounded Memory (Priority: P1) MVP

**Goal**: A developer can safely scaffold a usable GraphKeeper store with one command.

**Requirements**: FR-001 through FR-009; SC-001 and SC-002.

**Independent Test**: Run 'npx graphkeeper init' in clean Git, empty Git, non-Git,
repeat-init, force-refresh, custom-hook, and hook-collision fixtures; verify expected
files, messages, preservation, and exit codes.

- [x] T028 [US1] Add failing prerequisite and unsupported-environment init tests in tests/integration/init-prerequisites.test.ts
- [x] T029 [US1] Implement pre-mutation Node, Git, sh, jq, and platform checks in src/commands/init.ts
- [x] T030 [US1] Add failing scaffold-plan tests for new, partial, existing, and non-Git repositories in tests/unit/init-plan.test.ts
- [x] T031 [US1] Implement deterministic created, skipped, refreshed, and warned action planning in src/commands/init.ts
- [x] T032 [US1] Add failing tests for idempotency, --force limits, atomic writes, permissions, and interrupted recovery in tests/integration/init-files.test.ts
- [x] T033 [US1] Implement data-preserving scaffold writes and documentation-only force refresh in src/commands/init.ts
- [x] T034 [US1] Add failing tests for default, absolute-custom, relative-custom, missing, existing-GraphKeeper, and third-party hook destinations in tests/integration/init-hooks.test.ts
- [x] T035 [US1] Implement no-overwrite hook installation, marker detection, executable mode, and chaining guidance in src/commands/init.ts
- [x] T036 [US1] Wire init and --force argument handling into src/cli.ts
- [x] T037 [US1] Add the full onboarding acceptance matrix, including non-Git warnings and recoverable failures, in tests/e2e/init.test.ts
- [x] T038 [US1] Add the under-ten-second init benchmark and under-two-minute documented walkthrough measurement in tests/performance/init.bench.ts

**Checkpoint**: User Story 1 is independently demonstrable as the v1 onboarding MVP.

---

## Phase 4: User Story 2 - Record a Grounded Finding (Priority: P1)

**Goal**: Any supported agent can follow vendor-neutral rules to record an honest,
schema-conforming durable finding.

**Requirements**: FR-010 through FR-020, FR-026, FR-051, and FR-052.

**Independent Test**: Give the templates and evidence to a test agent fixture; verify
tool-output and inference claims, entity reuse, flat objects, and exclusion of chatter.

- [x] T039 [P] [US2] Add failing content-contract tests for every claim/entity field and HOOK, DOCTOR, or GUIDANCE label in tests/integration/schema-doc.test.ts
- [x] T040 [US2] Write the complete human-and-agent field contract, examples, and enforcement labels in templates/graph/SCHEMA.md
- [x] T041 [P] [US2] Add failing content-contract tests for sourcing, inference, alias reuse, correction, and chatter exclusion in tests/integration/skill-doc.test.ts
- [x] T042 [US2] Write the vendor-neutral durable-memory workflow and boundaries in templates/SKILL.md
- [x] T043 [US2] Add failing agent-behavior fixtures for existing alias, new entity, tool output, inference, structured evidence, and session chatter in tests/e2e/agent-guidance.test.ts
- [x] T044 [US2] Add generic expected graph and evidence outputs for the agent-behavior cases in tests/fixtures/agent-guidance/

**Checkpoint**: User Story 2 can be tested without the query or doctor commands by
validating agent-produced files against the canonical contract.

---

## Phase 5: User Story 3 - Block Invalid History at Commit (Priority: P1)

**Goal**: The installed hook and on-demand check reject invalid selected history with
the same decisions and actionable errors.

**Requirements**: FR-027 through FR-040; SC-003 and SC-004.

**Independent Test**: Stage every valid and invalid invariant fixture, run the hook
and check against equivalent states, and compare status plus GK error codes.

- [x] T045 [US3] Add failing CLI tests for validator discovery, --worktree invocation, output forwarding, timeout, and exit-code mapping in tests/integration/check-command.test.ts
- [x] T046 [US3] Implement graphkeeper check as a thin canonical-validator subprocess wrapper in src/commands/check.ts
- [x] T047 [US3] Wire check argument validation and dispatch into src/cli.ts
- [x] T048 [US3] Add failing real-Git pre-commit tests for valid commits, first commit, malformed graph, and hook blocking in tests/e2e/pre-commit.test.ts
- [x] T049 [US3] Finalize hook marker, repository-root lookup, and staged-mode invocation in templates/pre-commit
- [x] T050 [US3] Add record-ID, path, conflicting-ID, and corrective-guidance assertions for all validator failures in tests/integration/validator-diagnostics.test.ts
- [x] T051 [US3] Refine stable GK diagnostics without changing rule decisions in scripts/validate.sh
- [x] T052 [US3] Add malicious command strings, unsafe refs, spaces-in-repository-path, and no-evidence-dereference cases in tests/security/validator-input.test.ts
- [x] T053 [US3] Add the complete hook/check parity acceptance matrix to tests/e2e/check-and-hook.test.ts

**Checkpoint**: User Story 3 independently proves that invalid memory cannot enter
history through a normal commit and that check reports the same rule outcomes.

---

## Phase 6: User Story 4 - Ask Why We Know Something (Priority: P1)

**Goal**: A developer can retrieve deterministic active claims and provenance by
canonical entity ID or exact alias.

**Requirements**: FR-041 through FR-046; SC-005.

**Independent Test**: Query canonical, unique-alias, ambiguous-alias, unknown,
no-active-claim, correction-chain, and mixed-source fixtures and compare exact output
and exit behavior.

- [x] T054 [US4] Add failing canonical-ID, exact-alias, ambiguity, unknown, and empty-result resolution tests in tests/unit/query-resolution.test.ts
- [x] T055 [US4] Implement deterministic entity and alias resolution without fuzzy matching in src/commands/query.ts
- [x] T056 [US4] Add failing active-claim, superseded-claim, stable-sort, and provenance-output tests in tests/integration/query-command.test.ts
- [x] T057 [US4] Implement the jq-backed active-claim selection and human-readable provenance output in src/commands/query.ts
- [x] T058 [US4] Wire query argument validation, timeout, and exit behavior into src/cli.ts
- [x] T059 [US4] Add the complete query acceptance matrix against a populated repository in tests/e2e/query.test.ts
- [x] T060 [US4] Add the 10,000-claim p95 query benchmark and two-second budget assertion in tests/performance/query.bench.ts

**Checkpoint**: User Story 4 independently answers why a subject is believed without
reading session transcripts.

---

## Phase 7: User Story 5 - Diagnose Graph Health (Priority: P1)

**Goal**: Doctor verifies raw JSON and physical evidence integrity while reporting all
safe findings as errors or warnings.

**Requirements**: FR-047 through FR-050; SC-006.

**Independent Test**: Run doctor against valid, duplicate-key, missing-file,
out-of-tree, symlink, binary, zero-line, reversed, out-of-bounds, dangling, orphan, and
multi-finding fixtures.

- [x] T061 [P] [US5] Add failing nested, adjacent, scalar, container, and escaped-name duplicate-key tests in tests/unit/json-duplicates.test.ts
- [x] T062 [US5] Implement a non-executing raw JSON duplicate-key scanner in src/lib/json-duplicates.ts
- [x] T063 [P] [US5] Add failing UTF-8, binary, LF, CRLF, empty-file, positive-range, reversed-range, and bounds tests in tests/unit/evidence.test.ts
- [x] T064 [US5] Implement contained evidence resolution, text validation, logical line counting, and inclusive range checks in src/lib/evidence.ts
- [x] T065 [P] [US5] Add failing dangling claim/run/entity/source-doc and orphan-entity tests in tests/unit/doctor-graph.test.ts
- [x] T066 [US5] Implement deep graph-reference errors and orphan warnings in src/commands/doctor.ts
- [x] T067 [US5] Add failing multi-error, warning-only, validator-failure, timeout, and summary tests in tests/integration/doctor-command.test.ts
- [x] T068 [US5] Implement validator-first doctor orchestration, safe finding accumulation, summaries, and exit codes in src/commands/doctor.ts
- [x] T069 [US5] Wire doctor argument validation and timeout behavior into src/cli.ts
- [x] T070 [US5] Add traversal, out-of-tree symlink, unreadable-file, and malicious-content cases in tests/security/doctor-input.test.ts
- [x] T071 [US5] Add the full healthy, warning-only, error, and mixed-finding acceptance matrix in tests/e2e/doctor.test.ts
- [x] T072 [US5] Add the 10,000-reference p95 doctor benchmark, 10-second target, and 256-MB ceiling measurement in tests/performance/doctor.bench.ts

**Checkpoint**: User Story 5 independently proves that every referenced evidence range
is physically verifiable and that warnings do not masquerade as errors.

---

## Phase 8: User Story 6 - Correct a Durable Claim (Priority: P1)

**Goal**: A correction appends one non-branching, acyclic successor while preserving
the old claim and making only the chain tip active.

**Requirements**: FR-032, FR-033, FR-036, and FR-037.

**Independent Test**: Apply a valid correction, extend its chain, attempt a fork and
cycles, and verify stored history plus default query results.

- [x] T073 [US6] Add failing end-to-end tests for first correction, chain extension, direct fork, self-cycle, multi-node cycle, and old-claim mutation in tests/e2e/corrections.test.ts
- [x] T074 [US6] Add valid and invalid multi-generation correction repositories in tests/fixtures/corrections/
- [x] T075 [US6] Refine supersession diagnostics to name every fork or cycle member in scripts/validate.sh
- [x] T076 [US6] Add query assertions proving that only each correction chain tip is active in tests/integration/query-corrections.test.ts

**Checkpoint**: User Story 6 is independently demonstrable without any history edit or
mutable active-status field.

---

## Phase 9: User Story 7 - Track Runs and Evidence (Priority: P2)

**Goal**: Agent work is traceable through a valid open-to-closed run and its immutable
evidence.

**Requirements**: FR-021 through FR-027.

**Independent Test**: Open, grow, and close runs with each verdict, then attempt
removal, reopening, post-close growth, timestamp reversal, and provenance mismatch.

- [x] T077 [US7] Add failing open, growth, close, same-commit-close, aborted, inconclusive, reversed-time, reopen, and closed-mutation tests in tests/integration/run-lifecycle.test.ts
- [x] T078 [US7] Add canonical open-run, closed-run, verdict, and evidence-provenance examples in templates/graph/SCHEMA.md
- [x] T079 [US7] Add long-lived open-run and concurrent append fixtures in tests/fixtures/runs/
- [x] T080 [P] [US7] Add immutable text evidence and overlapping-reference provenance fixtures in tests/fixtures/evidence/
- [x] T081 [US7] Add run opening, evidence capture, closing, and interrupted-run guidance in templates/SKILL.md
- [x] T082 [US7] Add a complete agent-run provenance acceptance workflow in tests/e2e/run-provenance.test.ts

**Checkpoint**: User Story 7 independently reconstructs which run and evidence produced
each claim.

---

## Phase 10: User Story 8 - Review Only Grounded Statements (Priority: P2)

**Goal**: A reusable reviewer approves factual statements only with active,
tool-output-grounded claim IDs.

**Requirements**: FR-053 through FR-056; SC-007 and SC-008.

**Independent Test**: Evaluate supported, inference-only, unsupported, and superseded
statements and compare exact approval or REVISE behavior.

- [x] T083 [US8] Add failing content-contract tests for claim citations, active-state checks, inference refusal, and REVISE output in tests/integration/reviewer-prompt.test.ts
- [x] T084 [US8] Write the copy-pasteable vendor-neutral grounded reviewer prompt in examples/reviewer.md
- [x] T085 [P] [US8] Create the populated generic flaky-test graph and evidence data in examples/worked-example/graph/ and examples/worked-example/evidence/
- [x] T086 [US8] Add supported, inference-only, unsupported, and superseded reviewer cases in tests/fixtures/reviewer/
- [x] T087 [US8] Write the worked example's setup, query, evidence-tracing, correction, and reviewer walkthrough in examples/worked-example/README.md
- [x] T088 [US8] Add check, doctor, query, traceability, and expected-reviewer assertions for the worked example in tests/e2e/worked-example.test.ts

**Checkpoint**: User Story 8 independently demonstrates grounded approval and explicit
revision requests.

---

## Phase 11: User Story 9 - Extend a Small Codebase (Priority: P2)

**Goal**: A new contributor can understand boundaries, run checks, and add a safe
extension without private project knowledge.

**Requirements**: FR-057; SC-009 and SC-010.

**Independent Test**: Follow the contributor guide in a clean clone, run every
documented command, locate extension points, and complete a small query-recipe change
within 15 minutes.

- [x] T089 [US9] Add failing documentation-contract tests for prerequisites, platforms, scope, extension points, quality gates, recovery, and scale limits in tests/integration/contributor-docs.test.ts
- [x] T090 [US9] Write contribution setup, test-first workflow, PR expectations, labels, and extension boundaries in CONTRIBUTING.md
- [x] T091 [US9] Document SQLite/PostgreSQL exploration as a future good-first-issue without adding a backend in CONTRIBUTING.md
- [x] T092 [P] [US9] Create a structured bug report form with reproduction and GraphKeeper diagnostic fields in .github/ISSUE_TEMPLATE/bug_report.yml
- [x] T093 [P] [US9] Create a feature request form with scope, evidence, alternatives, and constitutional-impact fields in .github/ISSUE_TEMPLATE/feature_request.yml
- [x] T094 [P] [US9] Create the pull-request checklist for tests, docs, schema compatibility, and constitutional compliance in .github/pull_request_template.md
- [x] T095 [US9] Configure Linux, macOS, and Git Bash build, test, check, doctor, and package-smoke jobs in .github/workflows/ci.yml
- [x] T096 [US9] Document repository description, topics, labels, default branch, and protection settings in .github/repository-settings.md
- [x] T097 [US9] Add the clean-clone 15-minute contributor onboarding and two-agent-harness compatibility test in tests/e2e/contributor-onboarding.test.ts

**Checkpoint**: User Story 9 independently proves contribution readiness and generic
cross-harness use.

---

## Phase 12: Polish, Release Safety, and Cross-Cutting Verification

**Purpose**: Finish user-facing documentation, packaging, security, performance, and
release evidence after all selected user stories pass independently.

- [x] T098 [P] Write the practical hero, prerequisites, two-minute quickstart, before/after example, commands, platform limits, recovery, 10k ceiling, and future path in README.md
- [x] T099 [P] Add the MIT license for GraphKeeper contributors in LICENSE
- [x] T100 Add failing tarball-content tests for CLI output, validator, templates, examples, license, and excluded development files in tests/e2e/package-contents.test.ts
- [x] T101 Configure npm files, exports, bin, executable assets, and prepublish checks in package.json
- [x] T102 Add a clean-directory npm-pack installation smoke journey for init, check, query, and doctor in tests/e2e/package-install.test.ts
- [x] T103 Add the aggregate traversal, symlink, shell-injection, malicious-command, path-space, and secret-redaction regression suite in tests/security/security-regression.test.ts
- [x] T104 Add aggregate init, check, query, doctor, and peak-memory budget reporting with 20-percent regression gates in tests/performance/budgets.test.ts
- [x] T105 Document versioning, package-name recheck, tarball inspection, CI gates, publish, and rollback steps in .github/RELEASE_CHECKLIST.md
- [x] T106 Add a scope guard test that rejects runtime telemetry, server, database, auth, dashboard, vector-search, or multi-repository modules in tests/integration/v1-scope.test.ts
- [x] T107 Create the FR-001 through FR-057 and SC-001 through SC-010 verification matrix with test evidence slots in specs/001-graphkeeper-v1/verification.md
- [x] T108 Run the complete clean-clone release-candidate workflow and record observed versions, commands, durations, results, and remaining exceptions in specs/001-graphkeeper-v1/verification.md

**Final checkpoint**: Every required story, invariant, security boundary, platform
contract, package asset, and success criterion has recorded evidence. Version 0.1.0 is
eligible for a publish decision but is not published automatically.

---

## Dependencies and Execution Order

### Phase Dependencies

| Phase | Tasks | Depends on | Completion gate |
|---|---:|---|---|
| Setup | T001-T006 | None | Build, help, and baseline tests pass |
| Foundation | T007-T027 | Setup | Canonical validator and starter templates pass |
| US1 Init | T028-T038 | Foundation | Onboarding matrix passes |
| US2 Grounded writing | T039-T044 | Foundation | Agent guidance contract passes |
| US3 Commit protection | T045-T053 | Foundation | Hook/check parity matrix passes |
| US4 Query | T054-T060 | Foundation | Query acceptance and budget pass |
| US5 Doctor | T061-T072 | Foundation | Deep-integrity matrix and budget pass |
| US6 Corrections | T073-T076 | Foundation; US4 for final query assertion | Correction workflow passes |
| US7 Runs/evidence | T077-T082 | Foundation; US2 documentation templates | Provenance workflow passes |
| US8 Reviewer/example | T083-T088 | US4, US5, and US6 | Worked example and reviewer cases pass |
| US9 Contribution | T089-T097 | All shipped commands and docs | Clean-clone onboarding passes |
| Polish/release | T098-T108 | All selected stories | Complete verification matrix passes |

The mandated execution policy is numeric even where '[P]' marks technical parallelism.
Each task is verified before the next begins. Architecture/validator go-ahead is
required at every phase boundary.

### User Story Independence

- **US1** can be demonstrated after Foundation by initializing fixture repositories.
- **US2** can be demonstrated after Foundation by validating agent-produced files.
- **US3** can be demonstrated after Foundation through real staged commits.
- **US4** can be demonstrated after Foundation against a pre-populated valid graph.
- **US5** can be demonstrated after Foundation against deep-integrity fixtures.
- **US6** uses Foundation for correction enforcement; its final query assertion uses
  US4 but the correction invariant remains independently testable.
- **US7** uses Foundation for lifecycle enforcement; its documentation extends US2.
- **US8** deliberately integrates query, doctor, and correction behavior in one
  user-facing example.
- **US9** is the final contribution story and exercises the completed project.

### Parallel Opportunities

- Setup: T002 and T004 affect different files after T001 is understood.
- Foundation: T009, T011, and T013 are independent failing-test preparations; their
  implementations still follow numeric approval order.
- US2: T039 and T041 prepare independent documentation contracts.
- US5: T061, T063, and T065 prepare independent doctor-unit contracts.
- US7: T079 and T080 create different fixture groups.
- US8: T083 and T085 affect reviewer tests and example data separately.
- US9: T092, T093, and T094 create independent GitHub contribution templates.
- Polish: T098 and T099 affect independent repository artifacts.

## Parallel Examples

These examples describe technical independence only. The project's one-task,
go/no-go execution rule still controls actual work.

- **US1**: Prepare tests in tests/unit/init-plan.test.ts while separately preparing
  tests/integration/init-hooks.test.ts.
- **US2**: Prepare tests/integration/schema-doc.test.ts and
  tests/integration/skill-doc.test.ts independently.
- **US3**: Prepare tests/integration/validator-diagnostics.test.ts and
  tests/security/validator-input.test.ts independently after Foundation.
- **US4**: Prepare tests/unit/query-resolution.test.ts and the populated query fixture
  used by tests/e2e/query.test.ts independently.
- **US5**: Prepare tests/unit/json-duplicates.test.ts,
  tests/unit/evidence.test.ts, and tests/unit/doctor-graph.test.ts independently.
- **US6**: Prepare tests/fixtures/corrections/ while writing the initial failing
  tests/e2e/corrections.test.ts.
- **US7**: Prepare tests/fixtures/runs/ and tests/fixtures/evidence/ independently.
- **US8**: Prepare examples/reviewer.md contract tests and
  examples/worked-example/ data independently.
- **US9**: Prepare the bug, feature, and pull-request templates independently.

## Implementation Strategy

### MVP First

1. Complete Setup T001-T006.
2. Complete Foundation T007-T027.
3. Complete US1 T028-T038.
4. Stop and demonstrate safe initialization in every US1 fixture.
5. Continue only after architecture and validator approval.

This MVP proves adoption safety. Grounded writing and enforcement become the first
usable product increment after US2 and US3.

### Incremental Delivery

1. **Onboard**: US1 scaffolds without data loss.
2. **Write and protect**: US2 and US3 establish grounded records and commit guardrails.
3. **Retrieve and diagnose**: US4 and US5 make memory useful and auditable.
4. **Correct and trace**: US6 and US7 preserve learning and provenance.
5. **Review and contribute**: US8 and US9 demonstrate grounded approval and
   extension readiness.
6. **Release hardening**: T098-T108 prove package, security, performance, and
   documentation readiness.

## Requirement Coverage

| Specification coverage | Task coverage |
|---|---|
| FR-001-FR-009 | T028-T038 |
| FR-010-FR-020 and FR-026 | T007-T020, T039-T044 |
| FR-021-FR-027 | T021-T027, T077-T082 |
| FR-028-FR-040 | T017-T024, T045-T053, T073-T076 |
| FR-041-FR-046 | T054-T060 |
| FR-047-FR-050 | T061-T072 |
| FR-051-FR-052 | T039-T044, T077-T081 |
| FR-053-FR-056 | T083-T088 |
| FR-057 | T089-T098 |
| SC-001-SC-002 | T037-T038 |
| SC-003-SC-004 | T048-T053 |
| SC-005 | T059-T060 |
| SC-006 | T070-T072 |
| SC-007-SC-008 | T083-T088 |
| SC-009-SC-010 | T095-T097 |
| Cross-cutting release proof | T098-T108 |

## Task-List Acceptance Checklist

- [x] All nine user stories have dedicated phases, goals, requirements, and independent
  tests.
- [x] All 57 functional requirements and 10 success criteria map to task ranges.
- [x] Tests precede their corresponding implementation where behavior is introduced.
- [x] Every task has a sequential ID, correct story label policy, and exact path.
- [x] Dependencies and technically parallel work are explicit.
- [x] Setup, foundation, user-story, and release checkpoints are independently
  verifiable.
- [x] The initial 15-task outline is fully represented at smaller granularity.
- [x] No implementation work is included in this artifact.

## Notes

- The local planning environment does not currently provide jq. Validator runtime
  tasks MUST install or provide jq 1.6 or newer before T017 is executed.
- The npm package name remains provisional until T105 repeats the registry ownership
  check.
- SQLite/PostgreSQL remains documentation-only future work.
- T001 is authorized by the architecture/validator instruction dated 2026-08-04.
