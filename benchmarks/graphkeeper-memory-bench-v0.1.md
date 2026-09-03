# GraphKeeper Memory Bench v0.1

This document defines the first four scenarios for evaluating durable project memory in coding agents.

The benchmark defines the scenarios. Tests A and B have manually recorded executions;
reusable scoring methodology, automated evaluation, and datasets remain future work.

## Test A — Repeated Investigation

### Scenario

Session 1 discovers an architectural fact about the project.

The session ends.

Session 2 receives a related task that requires the same architectural knowledge.

### Question

**Does the agent investigate the same thing again?**

---

## Test B — Stale Memory

### Scenario

An agent records:

> Authentication lives in module A.

Later, the architecture changes and authentication moves to module B.

### Question

**Can the memory system represent that the original conclusion is no longer current?**

---

## Test C — Provenance

### Scenario

An agent retrieves a remembered architectural fact from project memory.

### Question

**Can the developer trace where that conclusion came from?**

---

## Test D — Correction History

### Scenario

A previous claim stored in project memory becomes wrong or outdated.

A newer conclusion replaces it.

### Question

**Can we see both the old conclusion and what superseded it?**

---

## Current Scope

GraphKeeper Memory Bench v0.1 currently defines only these four scenarios:

1. Repeated investigation
2. Stale memory
3. Provenance
4. Correction history

Test A has recorded [pre-fix FAIL](results/repeated-investigation-pre-fix-2026-08-14/README.md)
and [post-fix PASS](results/repeated-investigation-post-fix-pass-2026-08-14/README.md)
results. Test B has recorded a
[pre-fix FAIL](results/stale-memory-cursor-adapter-2026-09-03/README.md) and a
[post-fix PASS](results/stale-memory-authentication-post-fix-2026-09-03/README.md).
These are manual evidence records, not an automated benchmark harness. Tests C-D,
reusable scoring methodology, automated evaluation, and datasets remain future work.
