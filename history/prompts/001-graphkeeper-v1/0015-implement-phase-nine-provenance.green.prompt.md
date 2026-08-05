---
id: 0015
title: Implement Phase Nine Provenance
stage: green
date: 2026-08-05
surface: agent
model: gpt-5
feature: 001-graphkeeper-v1
branch: 001-graphkeeper-v1
user: anusbutt
command: natural-language phase-nine approval
labels: [implementation, phase-nine, runs, evidence, provenance]
links:
  spec: specs/001-graphkeeper-v1/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - scripts/validate.sh
 - templates/graph/SCHEMA.md
 - templates/SKILL.md
 - tests/integration/run-lifecycle.test.ts
 - tests/integration/schema-doc.test.ts
 - tests/integration/skill-doc.test.ts
 - tests/e2e/run-provenance.test.ts
 - tests/fixtures/runs/long-lived-open/graph/entities.json
 - tests/fixtures/runs/long-lived-open/graph/claims.json
 - tests/fixtures/runs/long-lived-open/graph/runs.json
 - tests/fixtures/runs/long-lived-open/evidence/initial-check.log
 - tests/fixtures/runs/concurrent-appends/graph/entities.json
 - tests/fixtures/runs/concurrent-appends/graph/claims.json
 - tests/fixtures/runs/concurrent-appends/graph/runs.json
 - tests/fixtures/runs/concurrent-appends/evidence/agent-a.log
 - tests/fixtures/runs/concurrent-appends/evidence/agent-b.log
 - tests/fixtures/evidence/immutable/captured.log
 - tests/fixtures/evidence/immutable/attempted-rewrite.log
 - tests/fixtures/evidence/overlapping-references/graph/entities.json
 - tests/fixtures/evidence/overlapping-references/graph/claims.json
 - tests/fixtures/evidence/overlapping-references/graph/runs.json
 - tests/fixtures/evidence/overlapping-references/evidence/test-output.log
 - specs/001-graphkeeper-v1/tasks.md
 - history/prompts/001-graphkeeper-v1/0015-implement-phase-nine-provenance.green.prompt.md
tests:
 - lifecycle red run: 9 passed and 3 expected GK153 context failures
 - documentation red run: 9 passed and 2 expected missing-contract failures
 - focused green run: 29 passed, 0 failed, 0 skipped
 - npm test: 185 functional/security tests and 4 performance tests passed
 - npm run typecheck
 - npm run package:smoke
 - npm ls --all
 - sh -n scripts/validate.sh
 - sh -n templates/pre-commit
 - git diff --check
---

## Prompt

start phase 9

## Response snapshot

Implemented Phase 9 tasks T077 through T082. Run lifecycle coverage now proves legal
open, growth, close, same-commit close, and interruption flows while rejecting time
reversal, removal, reopening, and every post-close mutation. Canonical run/evidence
fixtures, complete schema and agent guidance, and an end-to-end provenance workflow
show how to reconstruct each claim from its producing run and exact evidence lines.

## Outcome

- Impact: Operators can audit which run and immutable evidence produced every grounded
  claim, including long-lived and concurrent work, without relying on transcripts.
- Tests: Added 29 focused Phase 9 checks; all 185 project tests and 4 benchmarks pass
  with no failures or skips. Typecheck, package dry-run, dependency-tree, shell syntax,
  and whitespace checks also pass.
- Files: Added lifecycle and provenance acceptance suites; healthy long-lived,
  concurrent, and overlapping-reference repositories; immutable evidence pairs; and
  operational documentation for normal and interrupted runs.
- Next prompts: Architecture and validator verification of Phase 9 before Phase 10.
- Reflection: The existing state machine enforced the correct decisions, while the
  phase exposed and fixed GK153 diagnostic extraction so invalid transitions now name
  the exact run IDs instead of reporting unknown.

## Evaluation notes (flywheel)

- Failure modes observed: The initial lifecycle red run found correct rejection with
  an unusable `[unknown]` GK153 context. A single jq diagnostic expression was replaced
  with an indexed, field-equivalent transition check. A Markdown assertion was made
  whitespace-tolerant after line wrapping caused a false negative.
- Graders run and results (PASS/FAIL): PASS - 185 functional/security tests; PASS - 4
  performance tests; PASS - strict typecheck; PASS - package dry-run; PASS - dependency
  tree; PASS - shell syntax; PASS - whitespace check.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): Begin Phase 10 only after explicit approval
  and keep reviewer decisions derived from active, tool-output-grounded claim IDs.
