# Scoring — inconclusive interrupted capture

Scorer: implementation-session Codex operator. No independent human review claimed.
Rubric: [frozen protocol](protocol.md). Decisions use the saved event stream and
artifact checks; the capture agent's run verdict is not a benchmark verdict.

## Capture outcome

**Unevaluable as a completed capture; no eligible frozen audit fixture.**
The CLI emitted an account usage-limit error after execution began and exited 1.
The final two records of [capture.jsonl](sessions/capture.jsonl), lines 24–25,
are `error` and `turn.failed`. It did not produce a final answer or memory commit.
This is an external interruption under the protocol, not a pre-start launch error.
No replacement capture or audit session was launched.

| Eligibility check | Observed state | Evidence |
|---|---|---|
| Real evidence captured | Three files match observed command output byte for byte | Session item_10; graphkeeper/evidence/; checks/snapshot-consistency-outside-parent-sandbox.txt |
| Target atomic finding | Not satisfied by the interrupted state: claim_804ea1fb combines validation delegation and forwarding its result to processInput | graphkeeper/claims.json; session item_11 |
| Reciprocal claim/run/evidence links | Present for six claims and one run | graphkeeper/claims.json; graphkeeper/runs.json; snapshot-consistency check |
| Producing run closed | ended=2026-09-07T13:23:59Z, verdict=passed | graphkeeper/runs.json; session item_11 |
| check/doctor | Both exit 0; doctor has zero errors/warnings | checks/check-after-interruption.txt; checks/doctor-after-interruption.txt |
| Application/guidance unchanged | Only three graph files modified; three evidence files untracked | checks/capture-status.txt; capture-working-tree.patch |
| Clean committed memory | Not satisfied: HEAD remains the setup commit, memory is uncommitted | checks/fixture-history.txt; checks/capture-status.txt |
| Final answer | Not produced | Session ends with usage-limit error and turn.failed |

The compound intermediate target and missing commit are disclosed. The session was
interrupted before completing its review/commit workflow; the overall outcome follows
the external-interruption precedence rule and cannot establish completed agent behavior.
The operator did not split the claim, commit the memory, or invent a final answer.

## Audit slots

| Slot | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | Observation |
|---|---|---|---|---|---|---|---|---|---|
| audit_1 | — | — | — | — | — | — | — | — | Not run: capture prerequisite not reached |
| audit_2 | — | — | — | — | — | — | — | — | Not run: capture prerequisite not reached |
| audit_3 | — | — | — | — | — | — | — | — | Not run: capture prerequisite not reached |

No criterion is awarded a pass or behavioral failure to an unexecuted auditor.
Counts against three planned audit slots: **0 passed, 0 failed, 0 unevaluable
audit observations, 3 not run**. Capture itself is externally interrupted.

## Aggregate

**INCONCLUSIVE.** Complete capture evidence and the committed prerequisite state
were not produced because of the external interruption. This provides no Test C
audit success rate and must not be reported as 0/3 behavioral failures or as a PASS.

The separate real-agent sandbox preflight and synthetic scoring calibration are
explicitly excluded from the capture/audit denominator. Neither demonstrates Test C.

## Artifact review

The setup-history bundle is valid. Restoring it, applying the exact uncommitted
graph patch, and copying the saved evidence reproduces the interrupted state.
Graph, evidence, and installed skill are byte-identical to their snapshots. The
restored state passes check and doctor and returns the same query output.
See [restoration output](checks/restoration.txt). This verifies preservation, not
capture eligibility or the absent provenance audits.
