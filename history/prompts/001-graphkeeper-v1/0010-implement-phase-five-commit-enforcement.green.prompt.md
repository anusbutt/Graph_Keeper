---
id: 0010
title: Implement Phase Five Commit Enforcement
stage: green
date: 2026-08-05
surface: agent
model: gpt-5
feature: 001-graphkeeper-v1
branch: 001-graphkeeper-v1
user: anusbutt
command: natural-language phase-five approval
labels: [implementation, phase-five, validation, pre-commit, security]
links:
  spec: specs/001-graphkeeper-v1/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - src/commands/check.ts
 - src/cli.ts
 - scripts/validate.sh
 - templates/pre-commit
 - tests/integration/check-command.test.ts
 - tests/integration/validator-diagnostics.test.ts
 - tests/e2e/pre-commit.test.ts
 - tests/e2e/check-and-hook.test.ts
 - tests/e2e/cli-help.test.ts
 - tests/security/validator-input.test.ts
 - specs/001-graphkeeper-v1/tasks.md
 - history/prompts/001-graphkeeper-v1/0010-implement-phase-five-commit-enforcement.green.prompt.md
tests:
 - npm test
 - npm run typecheck
 - npm run package:smoke
 - npm ls --all
 - sh -n scripts/validate.sh
 - sh -n templates/pre-commit
 - git diff --check
---

## Prompt

start phase 5

## Response snapshot

Implemented Phase 5 tasks T045 through T053. The check command is a thin wrapper
around the repository-local canonical validator, while the managed pre-commit hook
selects staged data through that same script. Diagnostics now name logical graph
paths, relevant record or conflicting IDs, and corrective guidance. Security tests
prove stored commands and evidence remain inert data.

## Outcome

- Impact: Invalid graph history and committed-evidence mutation are blocked before
  commit, and users can run the same rule set on demand with graphkeeper check.
- Tests: Added 20 Phase 5 tests; the complete suite passes 111 of 111 with no skips.
  Typecheck, package dry-run, dependency-tree, shell syntax, and whitespace checks pass.
- Files: Added the check wrapper, real-Git hook and parity coverage, diagnostic
  contracts, and hostile-input coverage; refined only validator messages, not rules.
- Next prompts: Architecture and validator verification of Phase 5 before Phase 6.
- Reflection: Keeping both entry points as subprocess wrappers around validate.sh
  provides testable parity without duplicating policy in TypeScript.

## Evaluation notes (flywheel)

- Failure modes observed: The first full regression run exposed two stale tests: one
  still treated check as unimplemented, and one required the hook to remain at most
  eight lines. Both contracts were updated or preserved, then the full suite passed.
- Graders run and results (PASS/FAIL): PASS - 111 of 111 tests; PASS - strict
  typecheck; PASS - package dry-run; PASS - dependency tree; PASS - validator and
  hook shell syntax; PASS - whitespace check.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): Begin Phase 6 only after explicit approval
  and implement read-only subject query behavior without weakening validation.
