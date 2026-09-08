# Test C — revision 2 provenance result

Date: 2026-09-08. Protocol revision 2. Result: **INCONCLUSIVE**.

The environment repair worked for capture: the unchanged GraphKeeper hook committed
an eligible atomic claim, saved evidence, and closed producing runs at commit
292fc3620f7b197a15ff6a47e4fd0be016262a2e. Three independent auditors each found
the claim, read saved evidence, traced the producing run, and located that Git commit.
This is useful provenance behavior, but it is not a benchmark pass.

Audit 1 and audit 2 both failed C3: each left implicit how the saved import binds the
called validateInput to the validation module. Audit 3 has the same known omission,
but its Git index metadata changed during supposedly read-only activity. Its content,
worktree, reflogs, and refs are unchanged; still, the read-only containment cannot be
proved. The frozen protocol requires that slot to be unevaluable.

**Tally:** 0 passed, 2 failed, 1 unevaluable, 0 not run. The aggregate is
**INCONCLUSIVE** by the registered precedence rule. No behavior was retried, no claim
was repaired by the operator, and no failed audit was replaced.

## What the capture established

The eligible target is claim_85b5617c: handleRequest passes request.body to
validateInput. It is a tool-output claim with canonical reference
evidence/request-flow-source.txt#L5-L6, created at 2026-09-08T11:45:13Z by
run_2026-09-08-request_flow. The saved artifact’s L2 import and L6 call together
show delegation. Its separate companion claim records forwarding to processing; that
separation fixes the compound-claim defect in attempt 03.

The capture records source observation time 11:44:48Z, run end 11:45:14Z, and Git
commit time 11:45:34Z. Those are different kinds of metadata. Git introduces the
memory record at commit 292fc3620f7b197a15ff6a47e4fd0be016262a2e; artifact L1
records the earlier source setup commit beb383cf729b0863912bae23abcbb4abaf34bcca.
Neither timestamp proves source truth, current freshness, or broader application
behavior.

See [eligibility](checks/capture-eligibility.md), [scorecard](scoring.md),
[raw capture](sessions/capture.jsonl), [raw audits](sessions/audit-1.jsonl),
[claims](graphkeeper/claims.json), [runs](graphkeeper/runs.json), and
[saved source evidence](graphkeeper/evidence/request-flow-source.txt).

## Environment repair

Attempts 01 and 02 hit account limits. Attempt 03 revealed a compound claim and a
Node-hook Git subprocess error in the prior direct-network-denial sandbox. The
[separate preflight](../provenance-preflight-2026-09-08/README.md) reproduced that
error and verified a narrow correction: an active deny-all network proxy allowed the
local child-process pipe while explicitly blocking external destinations. A
fresh-agent preflight then made a valid hook-backed commit, rejected invalid graph
data, restored its empty graph, and confirmed evaluator-read and audit-write
boundaries.

The preflight was not a capture or audit, and its synthetic commits never enter this
fixture. Exact controls are recorded in [invocations](checks/invocations.json) and
[environment](environment.md). The correction still needs a metadata-safe read-only
audit setup before another experiment; audit 3’s index mtime is evidence that the
current control is insufficient for the protocol’s strict containment claim.

## Restore and inspect

Validate the public bytes with sha256sum -c SHA256SUMS, then clone fixture.bundle
into a fresh temporary directory and check out commit
292fc3620f7b197a15ff6a47e4fd0be016262a2e. Running node scripts/validate.mjs
--worktree inside that fixture verifies the stored graph. The operator independently
restored the full bundle and verified graph, evidence, source and guidance equality;
see [restoration](checks/restoration.txt) and
[restoration consistency](checks/restoration-consistency.txt).

The bundle includes complete capture history. Auditors used three separately cloned
copies of the same commit, confirmed before launch. For public CLI inspection, build
the exact candidate separately, then run check, doctor, and query request_handler in
the restored fixture. Capture and restoration passed these commands; doctor reported
zero graph errors and warnings. Proxy-runtime warnings are not GraphKeeper graph
warnings.

## Limits and integrity

This is one fixture, one requested model/configuration, and three planned audit
slots. It does not establish general reliability, inter-rater agreement, source
authenticity, security, performance, or current freshness. Effective immutable
provider model identity was not exposed. No independent human review is claimed.

Attempt 01, [attempt 02](../provenance-2026-09-07-02/README.md), and
[attempt 03](../provenance-2026-09-08-03/README.md) are preserved. The candidate’s
previous complete 387-test verification and focused checks are retained with attempt
01; no product source, template, schema, dependency, or hook changed for revision 2.
No package archive, dependencies, credentials, private configuration, or generated
build is included. Public artifacts were reviewed; no redaction was needed.
SHA256SUMS identifies published bytes, not observation authenticity.
