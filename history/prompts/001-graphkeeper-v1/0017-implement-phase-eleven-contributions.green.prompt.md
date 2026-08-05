---
id: 0017
title: Implement Phase Eleven Contributions
stage: green
date: 2026-08-05
surface: agent
model: gpt-5
feature: 001-graphkeeper-v1
branch: 001-graphkeeper-v1
user: anusbutt
command: natural-language phase-eleven approval
labels: [implementation, phase-eleven, contributing, ci, governance]
links:
  spec: specs/001-graphkeeper-v1/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - CONTRIBUTING.md
 - .github/ISSUE_TEMPLATE/bug_report.yml
 - .github/ISSUE_TEMPLATE/feature_request.yml
 - .github/pull_request_template.md
 - .github/workflows/ci.yml
 - .github/repository-settings.md
 - tests/integration/contributor-docs.test.ts
 - tests/e2e/contributor-onboarding.test.ts
 - specs/001-graphkeeper-v1/tasks.md
 - history/prompts/001-graphkeeper-v1/0017-implement-phase-eleven-contributions.green.prompt.md
tests:
 - contributor contract red run: 0 passed and 7 expected missing-document failures
 - focused green run: 9 passed, 0 failed, 0 skipped
 - clean source snapshot onboarding: passed in 45.2 seconds during the full suite
 - npm test: 203 functional/security tests and 4 performance tests passed
 - npm run typecheck
 - npm run package:smoke
 - npm ls --all
 - sh -n scripts/validate.sh
 - sh -n templates/pre-commit
 - git diff --check
---

## Prompt

start phase 11

## Response snapshot

Implemented Phase 11 tasks T089 through T097. Contributors now have a test-first guide
with exact prerequisites, v1 boundaries, extension points, quality gates, recovery
runbooks, scale limits, and a future storage exploration. Structured issue/PR forms,
three-platform CI, repository settings, a clean-source onboarding journey, and
two-harness compatibility checks make contribution expectations mechanically visible.

## Outcome

- Impact: A new contributor can locate query, guidance, validation, doctor, and future
  storage boundaries; run a reproducible fast path; and submit changes against explicit
  governance without private maintainer context.
- Tests: Added 9 focused Phase 11 checks; all 203 project tests and 4 benchmarks pass
  with no failures or skips. Typecheck, package dry-run, dependency-tree, shell syntax,
  and whitespace checks also pass.
- Files: Added the contribution guide, bug and feature forms, PR checklist, Linux/macOS/
  Git-Bash CI, repository settings, and clean-snapshot/two-harness acceptance coverage.
- Next prompts: Architecture and validator verification of Phase 11 before Phase 12.
- Reflection: The onboarding test reuses the installed dependency tree without network
  access, but builds and exercises an isolated clean source snapshot and leaves the
  outer suite as the single full-regression authority.

## Evaluation notes (flywheel)

- Failure modes observed: Windows `.cmd` shims cannot be spawned by the fixed executable
  helper, so the test invokes npm's JavaScript entrypoint directly. Inheriting Node's
  recursive-test marker skipped child tests until it was removed inside the isolated
  clone. Running two full suites concurrently caused a valid timeout under artificial
  contention; the nested journey was corrected to the documented onboarding gates,
  while the outer suite remains the full release gate.
- Graders run and results (PASS/FAIL): PASS - 203 functional/security tests; PASS - 4
  performance tests; PASS - clean-source onboarding under 15 minutes; PASS - unchanged
  graph across two harness styles; PASS - strict typecheck; PASS - package dry-run;
  PASS - dependency tree; PASS - shell syntax; PASS - whitespace check.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): Begin Phase 12 only after explicit approval
  and finish release documentation, package-content enforcement, and verification evidence.
