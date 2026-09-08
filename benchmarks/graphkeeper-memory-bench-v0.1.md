# GraphKeeper Memory Bench v0.1

This document defines the first four scenarios for evaluating durable project memory in coding agents.

The benchmark defines the scenarios. Tests A and B have completed manual executions.
Test C has a protocol, starter fixture, three preserved inconclusive attempts, and a
completed revision-2 audit result and a completed revision-3 clean rerun. Revision 3
passes all three provenance audits after addressing the observed explanation and
read-only containment defects. Cross-scenario scoring methodology, automated
evaluation, and broader datasets remain future work.

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

Current execution is defined by the [Test C revision-3 protocol](protocols/provenance-v0.3.md), using
the [source fixture](fixtures/provenance-v0.1/README.md). The first
[attempt was inconclusive](results/provenance-2026-09-07-01/README.md): capture hit
an account usage limit before committing memory, so no provenance audits ran.
The [second attempt](results/provenance-2026-09-07-02/README.md) also hit the usage
limit, before writing memory. The [third attempt](results/provenance-2026-09-08-03/README.md)
completed but was ineligible: its handler claim was compound and its commit hook
failed inside the sandbox. Setup invalidity makes the aggregate inconclusive;
the known claim defect is retained. No audits ran and no capture was hand-repaired.
The [revision-2 result](results/provenance-2026-09-08-04/README.md) repaired the
capture environment, produced and committed an atomic claim, then ran all three
audits. It remains inconclusive: slots 1/2 fail C3 and slot 3 is unevaluable after
an audit Git-index metadata change. No audit is replaced. The separate
[revision-3 result passes](results/provenance-2026-09-08-05/README.md): it records
an eligible fresh capture and three passing read-only audits.

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
The separate open-run lifecycle defect observed in that pass has a subsequent
[close-command PASS](results/stale-memory-authentication-close-run-2026-09-04/README.md).
Test C's [latest result](results/provenance-2026-09-08-04/README.md) has a valid
committed atomic capture and all three audit slots accounted for, but is
inconclusive (two C3 failures and one isolation-unevaluable slot). The separate
[revision-3 experiment passes](results/provenance-2026-09-08-05/README.md) with an
eligible fresh capture and 3/3 passing audit slots. Test D
remains unexecuted. These are manual evidence records, not an automated benchmark
harness; cross-scenario scoring methodology, automated evaluation, and broader
datasets remain future work.
