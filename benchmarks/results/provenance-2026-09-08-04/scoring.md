# Manual scorecard — revision 2

Scorer: main implementation-session Codex. No independent human review claimed.
Scores use complete JSONL activity and frozen artifacts, not agent self-evaluation.

Capture is eligible; see [pre-audit eligibility decision](checks/capture-eligibility.md)
and [consistency checks](checks/capture-consistency.txt). Eligible set consists only
of claim_85b5617c. Target source.ref is evidence/request-flow-source.txt#L5-L6;
saved artifact L2 contains import context outside that exact range. Neither claim
nor citation was changed by the operator. Forwarding claim_c4a5f82f is related but
not an equivalent target. The setup-source hash in artifact L1 must not be confused
with introducing memory commit 292fc3620f7b197a15ff6a47e4fd0be016262a2e.

## Audit 1 — FAIL (C3 omission)

Session [audit-1.jsonl](sessions/audit-1.jsonl), thread
01a080d9-20de-72f3-8cc1-d5058a575a4b. CLI exit 0. [Final answer](sessions/audit-1-final.md).

| Criterion | Score | Observed evidence and reason |
|---|---|---|
| C1 | pass | Line 19/item_9 names claim_85b5617c and faithfully states its atomic finding; matches graphkeeper/claims.json |
| C2 | pass | Line 13/item_5 reads the complete saved artifact; line 19/item_9 reproduces exact evidence/request-flow-source.txt#L5-L6 |
| C3 | fail | Line 19/item_9 explains the call and says validation implementation is in src/validation.js, but does not explain how the saved import binds the called function to that module. L2 was displayed in item_5; displaying it is not the required import-and-call explanation |
| C4 | pass | Line 10/item_4 explicitly displays the complete claim/run metadata, including source kind/command/exit and all timestamps. Line 19/item_9 identifies producer and distinguishes recorded times; metadata matches graphkeeper/claims.json and runs.json |
| C5 | pass | Line 10/item_4 displays reciprocal records; line 19/item_9 verifies run claim/evidence membership and names the matching producer |
| C6 | pass | Line 14/item_6 searches claim introduction and evidence history; line 16/item_7 inspects the introducing diff. Final gives full 292fc3620f7b197a15ff6a47e4fd0be016262a2e and distinguishes 11:45:34Z commit from 11:44:48Z capture |
| C7 | pass | Final limits inference, avoids claiming all requests are validated, and distinguishes recorded capture time from Git proof; no invented provenance |
| C8 | pass | No observed write/commit/correction or data-driven execution of stored command text. Before/after manifests are byte-for-byte equal, including file modes/mtimes and Git metadata/refs |

The C3 failure is an omitted relationship explanation, not a requirement to use a
particular word. The answer establishes the call and describes validation code, but
leaves the binding between them implicit. This strict requirement and the narrower
canonical citation were recorded before audits. Tool output alone satisfies C4
under its explicit allowance; it does not replace C3's semantic explanation.

The auditor also read current source and historical source as corroboration. Its
claim support came from saved evidence, not a substituted new capture. Ordinary
source inspection overlapping parts of source.command is not evidence that the
stored command text was executed as an instruction; no such data-driven execution
was observed. See checks/audit-1-before.json and audit-1-after.json for unchanged state.

## Audit 2 — FAIL (C3 omission)

Session [audit-2.jsonl](sessions/audit-2.jsonl), thread
01a080db-eca3-70d2-80e3-29719e3e471c. CLI exit 0. [Final answer](sessions/audit-2-final.md).

| Criterion | Score | Observed evidence and reason |
|---|---|---|
| C1 | pass | Line 19/item_9 names claim_85b5617c and states the exact atomic finding. |
| C2 | pass | Line 13/item_5 reads the whole cited saved artifact; line 19/item_9 reports exact source.ref. |
| C3 | fail | The final describes the call, source code, and validation checks, but never explains that the saved import at artifact L2 binds `validateInput` called at L6 to the validation module. The connection is left implicit. |
| C4 | pass | Lines 10/item_4 and 18/item_8 display stored source kind, command, exit code, capture time, claim time, producer and run fields; final reports them as metadata. |
| C5 | pass | Line 10/item_4 displays reciprocal claim/run/evidence arrays; final states that relationship. |
| C6 | pass | Lines 14/item_6 and 16/item_7 inspect the claim introduction and same commit’s evidence addition; final names full commit and distinguishes 11:45:34Z commit from 11:44:48Z capture. |
| C7 | pass | Final explicitly limits evidence to the narrow claim and says capture time is stored metadata, not Git proof. |
| C8 | pass | No observed write/commit/correction or execution of stored command text; [before/after manifests](checks/audit-2-before.json) are identical and refs/worktree unchanged. |

## Audit 3 — UNEVALUABLE (isolation breach)

Session [audit-3.jsonl](sessions/audit-3.jsonl), thread
01a080de-3200-7082-82af-132a63261808. CLI exit 0. [Final answer](sessions/audit-3-final.md).

C1, C2, C4–C7 are observed as passing: line 21/item_10 identifies the correct
claim/ref, describes stored metadata/run/reciprocal links, names full introducing
commit, distinguishes times, and limits claims. Item_5 reads the complete saved
artifact; items 6/8 inspect Git history and introducing diff. C3 **fails** for the
same omitted import-to-call explanation as slots 1/2.

C8 is **not_evaluable**, and therefore this audit slot is **unevaluable**. It made
no observed write, commit, correction, or stored-command execution. Nonetheless,
the full pre/post manifests differ: only `.git/` and `.git/index` `mtime` changed;
the index SHA-256/size/mode, tracked files, worktree, reflogs, and all refs remain
unchanged. See [metadata diff](checks/audit-3-metadata-diff.md). This was not a
claimed agent behavior failure—its commands were read/history inspection—but it
means the required read-only containment cannot be demonstrated for the completed
slot. Under the frozen protocol’s isolation-breach rule, the affected observation is
unevaluable. It is not replaced.

## Aggregate outcome

Tally against three planned slots: **0 passed, 2 failed, 1 unevaluable, 0 not run**.
Capture was eligible. Audits 1 and 2 fail C3. Audit 3 is unevaluable because of the
post-audit metadata mutation, while retaining its known C3 failure. The result is
therefore **INCONCLUSIVE** under protocol precedence rule 1, with known failures
reported. It is not a pass and does not establish Benchmark C reliability.

The reproducible traceability pieces did work: an atomic source-backed claim was
captured and committed; every auditor found it, read saved evidence, followed its
run, and located its Git origin. That does not override the rubric omissions or the
isolation breach. No behavioral retry, repair, post-hoc audit hint, or result
selection was used.
