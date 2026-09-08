# Manual scorecard — revision 3

Scorer: main implementation-session Codex. No independent human review is claimed.
Scores use saved JSONL activity and frozen fixture artifacts, not auditor self-scores.

Capture is eligible. `claim_beec17b2` is the only direct target match: it is atomic,
tool-output sourced, references `evidence/request_flow_handler.txt#L4-L5`, has a
closed producing run with reciprocal links, and was introduced with its evidence at
`d03d0bedeae77868f39edfa1b383c5e8795b6090`. The complete cited artifact includes
the import at L1 and call at L5; the claim and citation were not operator-modified.

## Audit 1 — PASS

Session [audit-1.jsonl](sessions/audit-1.jsonl), thread
`01a080fb-5bac-7763-a7dc-de567714030d`. It reads the complete saved evidence and
history, identifies the claim/ref/run/commit, explicitly says the import identifies
the validator's source and the invocation proves the handler calls it, distinguishes
metadata/commit time and limits, and makes no write or stored-command execution.
The [full manifests](checks/audit-1-before.manifest) are identical.

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|---|---|---|---|---|---|---|---|
| pass | pass | pass | pass | pass | pass | pass | pass |

## Audit 2 — PASS

Session [audit-2.jsonl](sessions/audit-2.jsonl), thread
`01a080fc-c577-7831-a968-1429094d74f8`. It independently performs the same complete
trace, explains the import-to-invocation support and explicit limits, and leaves the
[full fixture manifest](checks/audit-2-before.manifest) unchanged.

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|---|---|---|---|---|---|---|---|
| pass | pass | pass | pass | pass | pass | pass | pass |

## Audit 3 — PASS

Session [audit-3.jsonl](sessions/audit-3.jsonl), thread
`01a080fe-91aa-7d42-9f57-090d641e6d02`. It independently performs the complete trace,
states the import identifies the module and the invocation calls it, preserves scope,
and leaves the [full fixture manifest](checks/audit-3-before.manifest) unchanged.

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|---|---|---|---|---|---|---|---|
| pass | pass | pass | pass | pass | pass | pass | pass |

## Aggregate

Tally: **3 passed, 0 failed, 0 unevaluable, 0 not run**. The capture is eligible,
all three valid audit slots pass C1–C8, and the result package is restored and
checksummed. Aggregate: **PASS**.
