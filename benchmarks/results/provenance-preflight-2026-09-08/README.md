# Benchmark C — environment repair preflight

Status: **environment acceptance gates passed**. This is synthetic preflight,
not a fourth capture or an audit result. Previous attempts remain unchanged.

Acceptance gates registered in local SDD before correction: real hook-backed valid
commit, invalid graph rejection, operator read denial, read-only audit containment,
and the same command path exercised by a separate fresh agent session.

The baseline default piped-stdin spawnSync returned both status 0/correct output and
error EPERM under direct network denial. Ignoring stdin avoids that error; changing
Node 22.21.0 to the installed 24.16.0 does not. No product hook/runtime was changed.

Proposed correction uses the same filesystem grants and Node 22.21.0 with Codex's
active network proxy, no allowed destinations, no upstream proxy or local binding,
and no Unix-socket escape hatch. Direct traffic remains contained. Exact settings,
raw failures, acceptance/rejection results and agent argv are in checks/.

The trusted network-policy-absent comparison ran no network request and no agent.
It was diagnostic only. The broader Unix-socket comparison did not fix the error
and was discarded. Neither is used for the corrected agent configuration.

Official OpenAI Docs guided configuration verification:
[permissions](https://learn.chatgpt.com/docs/permissions) and
[configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).
Documentation is not a substitute for observed enforcement checks.

## Observed acceptance

| Check | Result |
|---|---|
| Baseline real valid commit | Exit 1, hook GK004 spawnSync git EPERM |
| Corrected real valid commit | Exit 0, original hook validates; commit 193b14b0dc5e790adf6a933d01fd893c00799405 |
| Corrected invalid graph commit | Exit 1, GK120/GK151; HEAD remains 193b14b0dc5e790adf6a933d01fd893c00799405 |
| Proxy destination denial | Explicit 403, reason not_allowed, example.com not allowlisted |
| Direct connection | Test-net address ENETUNREACH; network namespace isolated |
| Auditor worktree/.git writes | Both EROFS; before/after full file/mode/mtime manifests identical |
| Operator reads | Existing outside targets hidden (ENOENT) |
| Fresh agent valid/invalid commits | Same required outcomes; unchanged hook and restored clean graph |

Fresh preflight thread 01a080d0-cc90-7491-8817-d7cd0e15a9a2 completed with CLI exit 0.
Its valid synthetic commit is ec1a39ed9672cf1e9850ec59725f7a43b0bac6ec.
Raw checks/agent-preflight.jsonl item_12 proves hook-backed success; item_13 shows
actual invalid rejection. The agent's script wrongly expected GK001 instead of
GK120/GK151 and stopped an assertion; item_15 verified unchanged HEAD/hook and
restored the original empty graph. No second behavioral session or replacement
commit attempt occurred. Item_16's hidden evaluator read returned ENOENT. The agent
mistook that for a failed denial check; the operator independently verified the
outside file exists and the read boundary hides it. This is operator scoring, not
accepting an agent's self-declared PASS/FAIL.

The first explicit proxy request returned 400 because inherited Node automatic
proxy handling interfered with the explicit proxy request. A trusted diagnostic
with that automatic handling disabled returned the required policy-specific 403;
both outputs remain. Agent runtime settings were not changed to suppress warnings.
An initial permission review timed out before probe launch; the permitted retry
succeeded. These are setup diagnostics, not primary observation retries.

No claim about the exact blocked kernel syscall is made. The controlled comparisons
localize the problem to default piped child input under direct network denial;
switching to an active deny-all proxy fixes the observed workflow without modifying
GraphKeeper, bypassing its hook or opening destinations. A future runtime may behave
differently; rerun the preflight rather than assuming this is universally necessary.

Candidate and hook unchanged; synthetic preflight commits never enter capture.
Previous Benchmark C attempts remain preserved and retain their original outcomes.
