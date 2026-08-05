---
id: 0013
title: Implement Phase Seven Doctor
stage: green
date: 2026-08-05
surface: agent
model: gpt-5
feature: 001-graphkeeper-v1
branch: 001-graphkeeper-v1
user: anusbutt
command: natural-language phase-seven approval
labels: [implementation, phase-seven, doctor, evidence, integrity]
links:
  spec: specs/001-graphkeeper-v1/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - src/lib/json-duplicates.ts
 - src/lib/evidence.ts
 - src/commands/doctor.ts
 - src/cli.ts
 - tests/unit/json-duplicates.test.ts
 - tests/unit/evidence.test.ts
 - tests/unit/doctor-graph.test.ts
 - tests/integration/doctor-command.test.ts
 - tests/security/doctor-input.test.ts
 - tests/e2e/doctor.test.ts
 - tests/e2e/cli-help.test.ts
 - tests/performance/doctor.bench.ts
 - tests/performance/query.bench.ts
 - specs/001-graphkeeper-v1/tasks.md
 - history/prompts/001-graphkeeper-v1/0013-implement-phase-seven-doctor.green.prompt.md
tests:
 - npm test
 - npm run test:performance
 - npm run typecheck
 - npm run package:smoke
 - npm ls --all
 - sh -n scripts/validate.sh
 - sh -n templates/pre-commit
 - git diff --check
---

## Prompt

start phase 7

## Response snapshot

Implemented Phase 7 tasks T061 through T072. Doctor now invokes canonical validation
first, scans raw JSON for duplicate keys, verifies contained UTF-8 evidence and exact
line ranges, reports deep graph-reference errors and orphan warnings separately, and
accumulates all safely discoverable findings without executing stored content.

## Outcome

- Impact: Developers can distinguish a healthy graph, warning-only graph, and corrupt
  graph while tracing every physical evidence failure to its owning claim or entity.
- Tests: Added 29 Phase 7 tests; all 157 project tests and benchmarks pass with no
  skips. Typecheck, package dry-run, dependency-tree, shell syntax, and whitespace
  checks also pass.
- Files: Added raw JSON scanning, cached evidence inspection, doctor orchestration and
  CLI dispatch, full security/acceptance matrices, and a 10,000-reference benchmark.
- Next prompts: Architecture and validator verification of Phase 7 before Phase 8.
- Reflection: Bounded 256-reference inspection batches preserve complete findings
  while satisfying both the ten-second p95 and 256 MB RSS budgets.

## Evaluation notes (flywheel)

- Failure modes observed: Windows denied file-symlink creation and did not honor POSIX
  unreadable bits, so containment uses directory junction fixtures and unreadability
  uses injected byte-read denial. An unbounded Promise fan-out exceeded memory, while
  fully serial inspection exceeded latency; bounded batches met both constraints.
- Graders run and results (PASS/FAIL): PASS - 157 of 157 tests and benchmarks; PASS -
  strict typecheck; PASS - package dry-run; PASS - dependency tree; PASS - doctor p95
  and RSS budgets; PASS - shell syntax; PASS - whitespace check.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): Begin Phase 8 only after explicit approval
  and refine correction diagnostics without changing append-only semantics.
