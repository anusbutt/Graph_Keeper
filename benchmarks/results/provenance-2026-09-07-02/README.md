# Test C — attempt 02: interrupted capture

Result: **INCONCLUSIVE**. Started 2026-09-07; interruption confirmed 2026-09-08.

Capture read repository guidance, CLI help and the empty graph/schema, then hit the account usage limit (raw [session](sessions/capture.jsonl), final two events). Exit code 1 was recovered from the execution session. No memory was written or committed. No final answer was produced. The exact completion time was not recorded; attempts.json distinguishes confirmation time from execution end.

Audit tally: **0 passed, 0 failed, 0 unevaluable audits, 3 not run**. One capture launch, no retries. This is not a Benchmark C pass or agent-caused failure.

[Environment](environment.md), [protocol](protocol.md), [prompts](prompts.md), [scoring](scoring.md), and [ledger](attempts.json) preserve setup and outcomes. The bundle contains only the two original setup commits; HEAD is beb383cf729b0863912bae23abcbb4abaf34bcca, and all three graph arrays remain empty. The graphkeeper snapshot has no evidence files because none were created. No operator memory edits or commits occurred.

Restore with `git clone fixture.bundle <new-directory>`; the bundled `node scripts/validate.mjs --worktree` checks the empty graph. Attempt 03's fresh empty capture repository was restored from this bundle and checked before launch; it does not resume this interrupted session. Check [checks/restoration.txt](checks/restoration.txt). Canonical fixture guidance and source remain unchanged.

The unchanged candidate's 387-test verification remains in [attempt 01](../provenance-2026-09-07-01/README.md). No product implementation changed. Public text and bundle contents reviewed; no credentials or private configuration included, no redactions needed. SHA256SUMS attests published bytes, not authenticity. No independent human review or immutable provider snapshot is claimed. This interrupted observation cannot establish provenance reliability.
