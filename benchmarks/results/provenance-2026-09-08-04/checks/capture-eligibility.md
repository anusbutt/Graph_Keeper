# Capture eligibility — frozen before audits

Operator/manual scorer: main implementation-session Codex. Capture is **eligible**.

Eligible set/reference example: claim_85b5617c, request_handler / validates /
“handleRequest passes request.body to validateInput.” This is one delegation fact;
forwarding is independently recorded as claim_c4a5f82f and is not an equivalent
target. The other ten claims concern validator/processor behavior, not delegation.

Canonical reference: evidence/request-flow-source.txt#L5-L6. These lines show the
handler and the call on request.body. The **same cited artifact** includes the
validateInput import at L2. The frozen target rule requires the cited artifact to
show import and call; it does not require both to fall within the canonical range.
This narrower citation is disclosed rather than widened. C3 still requires auditors
to explain import/call support using saved evidence; reading only L5-L6 and omitting
the imported binding does not establish the full C3 explanation. No extra hint is
added to the audit prompt. This interpretation is recorded before any audit result.

Capture output item_12 (JSONL line 25) displays the saved source artifact with an
outer line-number column. Exact reconstruction of that displayed column matches
the saved bytes. Source metadata is consistent with the executed capture wrapper;
the wrapper used check=True and saved its returned exit code. See capture-consistency.txt.

Producer run_2026-09-08-request_flow: started/captured 2026-09-08T11:44:48Z;
target created 11:45:13Z; run ended 11:45:14Z, verdict passed. Reciprocal target/run/
evidence links verified. A second closed review run splits an unrelated body-shape
claim using a successor and additional claims; original records remain preserved.
There are 12 total claims, 11 active, and 2 closed runs.

Claim and evidence introducing commits independently resolve to
292fc3620f7b197a15ff6a47e4fd0be016262a2e, committed 2026-09-08T11:45:34Z.
This is later than capture; the setup commit recorded in evidence L1 is not the
introducing memory commit. Full history and clean status are retained. Only graph/
and evidence/ changed; source, schema, installed skill and hook are unchanged.

Public check/doctor succeed; doctor reports zero graph errors/warnings. Codex's
experimental proxy-runtime warnings are not GraphKeeper graph warnings. Verified
hook/network/filesystem preflight is linked in environment.md. These checks do not
certify truth, freshness, timestamp authenticity or general model reliability.
