# Repeated-investigation benchmark: post-fix PASS result

Date: 2026-08-14  
Scenario: GraphKeeper Memory Bench v0.1, Test A — Repeated Investigation  
Result: **PASS — grounded memory reused with bounded current-state verification.**

## Result

GraphKeeper was consulted first. The session retrieved the directly relevant active
claims and inspected their provenance and cited evidence. It reused that evidence for
the historical reasoning and limited fresh verification to current files, working-tree
state, and current opacity references.

The session did not rerun `git log`, `git blame`, migration-history reconstruction,
historical diffs, broad repository searches, or unnecessary tests. Current state did
not contradict the grounded claims, so investigation stopped.

The conclusion remained the same: the homepage opacity poll remains in the test but
represents legacy behavior.

## Benchmark history

1. **FAIL** — the pre-fix session retrieved GraphKeeper memory but repeated the
   original source and historical investigation.
2. **fix** — retrieval-first guidance required grounded claims to become the starting
   point with minimum freshness verification.
3. **FAIL** — retrieval and provenance inspection improved, but the rerun still used
   broad searches, Git history, blame, migration diffs, and unnecessary validation.
4. **fix** — the guidance added a concrete current-state boundary and stopping rule.
5. **PASS** — this run reused grounded historical evidence, checked only relevant
   current state, found no contradiction, and stopped.

This records the required progression: **FAIL → fix → FAIL → fix → PASS**.

## Separate observation

The `graphkeeper` CLI was not directly available on `PATH`. The agent therefore
located and read the repository-local graph records manually. Retrieval still
succeeded. This is a non-benchmark operational observation, not a benchmark failure.

## Contents

- `prompts.md`: the exact repeated-investigation prompt.
- `graphkeeper-session.md`: relevant rerun transcript/output, actions, comparison, and
  concise PASS rationale.
- `graphkeeper/`: snapshots of the entity, claims, producing run, and evidence used.

No GraphKeeper implementation, application code, data model, or earlier benchmark
record is modified by this result.
