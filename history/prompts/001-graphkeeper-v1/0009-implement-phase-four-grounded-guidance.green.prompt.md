---
id: 0009
title: Implement Phase Four Grounded Guidance
stage: green
date: 2026-08-05
surface: agent
model: gpt-5
feature: 001-graphkeeper-v1
branch: 001-graphkeeper-v1
user: anusbutt
command: natural-language next-phase approval
labels: [implementation, phase-four, guidance, schema, agent-behavior]
links:
  spec: specs/001-graphkeeper-v1/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/001-graphkeeper-v1/tasks.md
 - templates/graph/SCHEMA.md
 - templates/SKILL.md
 - tests/integration/schema-doc.test.ts
 - tests/integration/skill-doc.test.ts
 - tests/e2e/agent-guidance.test.ts
 - tests/fixtures/agent-guidance/cases.json
 - tests/fixtures/agent-guidance/expected/graph/entities.json
 - tests/fixtures/agent-guidance/expected/graph/claims.json
 - tests/fixtures/agent-guidance/expected/graph/runs.json
 - tests/fixtures/agent-guidance/expected/evidence/agent-guidance.log
 - history/prompts/001-graphkeeper-v1/0009-implement-phase-four-grounded-guidance.green.prompt.md
tests:
 - npm test
 - npm run typecheck
 - npm run package:smoke
 - npm ls --omit=dev --json
 - sh -n scripts/validate.sh
 - sh -n templates/pre-commit
 - git diff --check
---

## Prompt

approved. move to next phase

## Response snapshot

Implemented Phase 4 tasks T039 through T044. The shipped schema now documents every
record field, exact source variants, evidence boundaries, lifecycle rule, enforcement
owner, and coherent example. The vendor-neutral skill now teaches identity reuse,
honest sourcing, flat claims, append-only correction, and exclusion of session chatter.
Generic behavior fixtures demonstrate all six required recording decisions.

## Outcome

- Impact: A supported agent or human can now produce an honest, schema-conforming
  grounded finding without requiring query or doctor implementation.
- Tests: Added 15 documentation and behavior tests; the complete suite passes 91 of 91
  with no skips. Typecheck, package dry-run, dependency audit, shell syntax, and
  whitespace checks also pass.
- Files: Completed both shipped guidance templates and added canonical-valid expected
  entity, claim, run, and evidence outputs for six behavior cases.
- Next prompts: Architecture and validator verification of Phase 4 before Phase 5.
- Reflection: Behavior fixtures separate input decisions from durable expected output,
  making chatter exclusion and flat-claim behavior testable without pretending to run
  a particular agent vendor.

## Evaluation notes (flywheel)

- Failure modes observed: All nine content contracts correctly failed against the
  baseline docs. One unsafe-segment assertion initially escaped its regular expression
  incorrectly and was corrected before the final gate.
- Graders run and results (PASS/FAIL): PASS - 91 of 91 tests; PASS - canonical validator
  on expected agent output; PASS - strict typecheck; PASS - package dry-run; PASS -
  zero runtime dependencies; PASS - shell syntax and whitespace checks.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): Begin Phase 5 only after explicit approval
  and prove hook/check parity without duplicating validator logic.
