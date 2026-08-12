# GraphKeeper Memory Bench v0.1

This document defines the first four scenarios for evaluating durable project memory in coding agents.

At this stage, the goal is only to define the tests. Scoring methodology and benchmark implementation will come later.

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

Scoring methodology, automated evaluation, datasets, and benchmark execution are intentionally left for later versions.
