# Scoring — attempt 03

Scorer: main implementation-session Codex; manual evaluation, no independent human review. Frozen protocol revision 1.

## Capture eligibility

Capture thread `01a07f34-fa8d-75f0-ac7a-936e196374c5` completed normally with CLI exit 0 and a final answer. No usage error, timeout or behavioral retry occurred. Completion does not imply eligibility.

| Gate | Observation | Outcome |
|---|---|---|
| Empty committed setup | Three empty arrays before capture; HEAD beb383cf729b0863912bae23abcbb4abaf34bcca | Pass |
| Eligible atomic delegation target | Only handler claim is claim_fc81ad22, quoted below; other four claims concern validation/processing and do not assert handler delegation | Fail |
| Authentic saved observation | evidence/request-flow-source.txt bytes exactly match item_7 output before its separately printed timestamp | Pass for observed bytes |
| Supporting lines | Saved artifact L2 imports validateInput; L6 calls it on request.body; L7 forwards its result | Supports both clauses, but does not make the compound claim atomic |
| Reciprocal provenance | All five claims point to run_2026-09-08-request_flow, which lists every claim and the evidence path | Pass |
| Closed run | Recorded start 04:10:43Z, end 04:10:44Z on 2026-09-08, verdict passed | Pass for stored closure |
| Unchanged application/guidance | Diff from setup changes only three graph JSON files and evidence/request-flow-source.txt | Pass |
| Clean committed capture / introducing commits | Four staged files; HEAD remains setup. item_10's commit failed in hook with spawnSync git EPERM | Fail; no memory introducing commit exists |
| Public CLI health | Operator check and doctor succeed outside sandbox, doctor zero errors/warnings | Pass there; does not establish sandbox commit capability or semantic atomicity |
| Valid commit-capable capture setup | Post-capture read-only invocation of same hook exits 4 inside frozen sandbox and 0 outside | Fail; preflight was incomplete |

The sole handler claim is:

> claim_fc81ad22 — handleRequest passes request.body to validateInput and passes its returned value to processInput.

Its canonical ref is `evidence/request-flow-source.txt#L1-L8`. This combines two independently changeable facts: delegation to validation and forwarding to processing. Changing forwarding need not change delegation. The protocol requires an atomic delegation claim, so the eligible set is **empty**. No reference claim can be selected; the other claims are not equivalent candidates. This defect is retained, not repaired or excused by the infrastructure problem.

Evidence references: [raw session](sessions/capture.jsonl), JSONL line 15/item_7 (capture), line 17/item_8 (claims/run), line 19/item_9 (stored records), line 21/item_10 (failed commit), line 22/item_11 (final). [Claims](graphkeeper/claims.json), [run](graphkeeper/runs.json), [evidence](graphkeeper/evidence/request-flow-source.txt), [history](checks/fixture-history.txt), and [consistency assertions](checks/snapshot-consistency.txt) preserve the underlying state.

Recorded capture time is 2026-09-08T04:10:14Z; handler claim created 04:10:43Z. The recorded run starts 29 seconds after the source capture, a metadata limitation retained as-is. The tool wrapper returned 0; its inner subprocess return code was not separately printed. Source.command and source.exit_code are stored metadata, not independently certified command authenticity. Stored commands were never executed by the operator. No claim/evidence Git timestamp exists: setup commit time is not a substitute for an introducing memory commit.

## Setup defect and aggregate precedence

The native preflight verified source reads, evaluator denial and dummy worktree/.git writes. It **did not exercise an actual hook-backed commit**. The reused real-agent preflight only exercised check/doctor and denied operations. Therefore those checks were insufficient to satisfy the protocol's commit-capability gate. The later hook failure establishes a setup limitation, not a product regression by itself.

Post-capture diagnostics did not rerun the behavioral task or modify capture. The same unchanged hook was invoked read-only in the disposable preflight copy: [inside sandbox](checks/post-capture-hook-sandbox.txt), exit 4; [outside sandbox](checks/post-capture-hook-outside.txt), exit 0. These are diagnostic observations, excluded from audit counts. The exact cause below the Git subprocess EPERM boundary was not established.

Aggregate **INCONCLUSIVE** under precedence rule 1 because valid capture setup could not be established. The completed capture's atomicity failure is known and explicitly reported. It must not disappear from a future comparison. This is not PASS, nor evidence that all provenance behavior fails.

## Audit slots

| Slot | Status | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | not_run | not_evaluable | not_evaluable | not_evaluable | not_evaluable | not_evaluable | not_evaluable | not_evaluable | not_evaluable |
| 2 | not_run | not_evaluable | not_evaluable | not_evaluable | not_evaluable | not_evaluable | not_evaluable | not_evaluable | not_evaluable |
| 3 | not_run | not_evaluable | not_evaluable | not_evaluable | not_evaluable | not_evaluable | not_evaluable | not_evaluable | not_evaluable |

Every unavailable criterion has the same reason: no audit launched because capture eligibility failed. No auditor session/evidence/commit reference exists. Tally against three planned slots: **0 passed, 0 failed, 0 unevaluable audit observations, 3 not run**. The unevaluable setup/capture is not counted as an audit slot. No pre-start relaunch or replacement observation was used.
