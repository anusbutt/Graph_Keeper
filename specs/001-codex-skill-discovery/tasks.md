# Tasks: Codex Skill Discovery

**Input**: Design documents from `specs/001-codex-skill-discovery/`
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/init-cli.md`, `quickstart.md`

**Tests**: Mandatory. Every story begins with tests that must fail for the intended
missing behavior before production files change.

## Format

`- [ ] TaskID [P?] [Story?] Description with file path`

## Phase 1: Specification and setup

**Purpose**: Confirm all governing artifacts and the existing worktree before red tests.

- [x] T001 Validate completed specification, checklist, constitution, plan, research, data model, contract, and quickstart under `specs/001-codex-skill-discovery/`
- [x] T002 Record the pre-existing dirty worktree and restrict implementation edits to feature files plus already-overlapping documentation and tests

---

## Phase 2: User Story 1 - Discover GraphKeeper in Codex (Priority: P1) MVP

**Goal**: Clean initialization produces one valid repository-scoped Codex skill and no root `SKILL.md`.

**Independent Test**: Initialize a clean fixture and validate generated path,
frontmatter, trigger description, body, and package asset.

### Red tests

- [x] T003 [P] [US1] Add skill frontmatter and progressive-disclosure assertions in `tests/integration/skill-doc.test.ts` and `tests/integration/templates.test.ts`
- [x] T004 [P] [US1] Add clean-init path and no-root-skill assertions in `tests/integration/init-files.test.ts` and `tests/e2e/init.test.ts`
- [x] T005 [P] [US1] Add packaged skill asset assertions in `tests/e2e/package-contents.test.ts`
- [x] T006 [US1] Run the focused US1 tests and record their intended failures before implementation

### Green implementation

- [x] T007 [US1] Add required `name` and trigger-focused `description` frontmatter to `templates/SKILL.md`
- [x] T008 [US1] Generate `.agents/skills/graphkeeper/SKILL.md` instead of root `SKILL.md` through `src/commands/init.ts`
- [x] T009 [US1] Run the focused US1 tests until they pass

**Checkpoint**: The repository skill is independently discoverable and packageable.

---

## Phase 3: User Story 2 - Adopt Without Damaging Existing Guidance (Priority: P2)

**Goal**: Default and forced initialization preserve existing graph data,
evidence, `AGENTS.md`, `CLAUDE.md`, hooks, and legacy root guidance.

**Independent Test**: Compare protected fixture bytes before and after normal,
forced, repeated, conflict, and concurrent initialization.

### Red tests

- [x] T010 [P] [US2] Add default and force preservation tests for `AGENTS.md`, `CLAUDE.md`, and legacy `SKILL.md` in `tests/integration/init-files.test.ts`
- [x] T011 [P] [US2] Add scaffold planning and wrong-type destination coverage in `tests/unit/init-plan.test.ts` and `tests/e2e/init.test.ts`
- [x] T012 [US2] Run the focused US2 tests and record their intended failures before implementation

### Green implementation

- [x] T013 [US2] Add legacy guidance reporting and discoverable-skill destination validation in `src/commands/init.ts`
- [x] T014 [US2] Preserve existing atomic create/refresh race behavior for nested skill paths in `src/commands/init.ts`
- [x] T015 [US2] Run the focused US2 tests until they pass

**Checkpoint**: Existing repositories migrate without protected-file changes.

---

## Phase 4: User Story 3 - Opt Into Always-On Codex Awareness (Priority: P3)

**Goal**: Explicit Codex integration safely owns exactly one activation block in
`AGENTS.md`.

**Independent Test**: Exercise missing, unmarked, valid, malformed, duplicated,
CRLF, no-final-newline, and concurrently changed guidance files.

### Red tests

- [x] T016 [P] [US3] Add accepted and rejected init grammar tests in `tests/e2e/cli-help.test.ts` and `tests/e2e/init.test.ts`
- [x] T017 [P] [US3] Add managed-block planning tests in `tests/unit/init-plan.test.ts`
- [x] T018 [P] [US3] Add preservation, idempotency, malformed-marker, newline, and concurrency tests in `tests/integration/init-files.test.ts`
- [x] T019 [US3] Run the focused US3 tests and record their intended failures before implementation

### Green implementation

- [x] T020 [US3] Implement deterministic init argument parsing and help text in `src/cli.ts`
- [x] T021 [US3] Implement Codex managed-block planning and validation in `src/commands/init.ts`
- [x] T022 [US3] Implement atomic create, append, refresh, skip, and concurrency rejection for `AGENTS.md` in `src/commands/init.ts`
- [x] T023 [US3] Run the focused US3 tests until they pass

**Checkpoint**: Codex session awareness is explicit, owned, idempotent, and safe.

---

## Phase 5: Documentation and release verification

- [x] T024 [P] Update initialization, migration, platform, skill discovery, and explicit integration guidance in `README.md`
- [x] T025 [P] Update contributor extension boundaries and tests in `CONTRIBUTING.md`
- [x] T026 [P] Update worked setup references where needed in `examples/worked-example/README.md`
- [x] T027 Validate the generated skill with the skill creator's `quick_validate.py`
- [x] T028 Run `npm run typecheck`, focused functional/security suites, and `npm test`
- [x] T029 Run isolated `npm run test:performance` after other work completes
- [x] T030 Run `npm run package:smoke` and verify no generated `dist/`, tarball, secret, or unrelated file is staged

---

## Phase 6: User Story 4 - Update the Global CLI Safely (Priority: P2)

**Goal**: `graphkeeper update` installs one exact newer stable npm release globally
without shell execution or repository mutation.

**Independent Test**: Use a fake runner to cover newer, current, ahead, malformed,
missing-npm, unsupported-platform, registry-failure, install-failure, and hostile
version output while asserting exact command arrays.

### Red tests

- [x] T031 [P] [US4] Add stable semantic-version parse and comparison tests in `tests/unit/update.test.ts`
- [x] T032 [P] [US4] Add update process, failure, and no-repository-mutation tests in `tests/integration/update-command.test.ts`
- [x] T033 [P] [US4] Add update grammar and help assertions in `tests/e2e/cli-help.test.ts`
- [x] T034 [US4] Run focused US4 tests and record their intended failures before implementation

### Green implementation

- [x] T035 [US4] Implement the fixed npm lookup and exact global install workflow in `src/commands/update.ts`
- [x] T036 [US4] Wire the no-argument update command and stable diagnostics through `src/cli.ts`
- [x] T037 [US4] Run focused US4 tests until they pass

### Documentation and verification

- [x] T038 [P] Document update behavior, permissions, offline recovery, and supported platforms in `README.md` and `CONTRIBUTING.md`
- [x] T039 Run typecheck, functional, security, and complete tests in WSL
- [x] T040 Run isolated performance and package smoke gates, then audit the worktree

## Dependencies and execution order

- Phase 1 gates all implementation work.
- US1 establishes the new canonical skill target and blocks US2 migration tests.
- US2 preservation behavior blocks US3 managed-file mutation.
- Each story's red tests must fail before its production tasks begin.
- Documentation may run only after public behavior stabilizes.
- Performance tests run alone after functional work; package smoke runs last.

## MVP

User Story 1 is the minimum viable release slice: a valid repository-scoped Codex
skill that replaces new root guidance generation. User Stories 2 and 3 are required
for safe adoption and the complete specified release.
