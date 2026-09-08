# Test C — completed capture, ineligible fixture

Date: 2026-09-08. Protocol revision 1. Result: **INCONCLUSIVE**, with a known atomic-claim failure.

The fresh capture completed without a usage interruption. It saved real source evidence, appended five claims, and closed its run. It did not produce an eligible audit fixture:

- The only handler claim combines validation delegation and forwarding to the processor. The frozen protocol requires the delegation fact to be atomic.
- The installed commit hook failed to spawn Git inside the sandbox, so memory remains staged, not committed. A read-only diagnostic reproduced the failure inside the sandbox and succeeded outside it. Preflight had tested dummy writes but missed actual hook capability.

The operator did not fix the claim, bypass the hook, commit memory, or launch replacement observations. All three audits are **not run**. Audit tally: **0 passed / 0 failed / 0 unevaluable audit observations / 3 not run**. Setup invalidity takes aggregate precedence; the claim defect remains documented in [scoring.md](scoring.md).

## Evidence record

- [Raw capture session](sessions/capture.jsonl) and [verbatim final answer](sessions/capture-final.md); CLI exit 0, thread `01a07f34-fa8d-75f0-ac7a-936e196374c5`.
- [Claims](graphkeeper/claims.json), [run](graphkeeper/runs.json), and [saved evidence](graphkeeper/evidence/request-flow-source.txt).
- [Ledger](attempts.json), [environment](environment.md), [prompts](prompts.md), [exact invocation](checks/invocations.json), and [frozen protocol](protocol.md).
- [Consistency checks](checks/snapshot-consistency.txt), [restoration](checks/restoration.txt), [history](checks/fixture-history.txt), and [staged status](checks/capture-status.txt).
- [Synthetic calibration](calibration.md), excluded from observed session counts.

`fixture.bundle` contains the complete **two-commit setup history only**, ending at `beb383cf729b0863912bae23abcbb4abaf34bcca`. There is no introducing memory commit. `capture-staged.patch` preserves all four staged files, including evidence. The source/installed-guidance snapshot is under fixture/; graph and evidence snapshots are under graphkeeper/.

The setup hook failure is observed in raw line 21/item_10, with final disclosure at line 22/item_11. The command block's final git status succeeded, so its outer exit 0 does not mean git commit succeeded. The agent's stored run verdict `passed` and its CLI-health claims are not the benchmark outcome.

## Restore and inspect without a model

From the GraphKeeper repository root, with Git and Node.js 18+:

```sh
bench_c_result="$PWD/benchmarks/results/provenance-2026-09-08-03"
bench_c_restore="$(mktemp -d /tmp/graphkeeper-c-restore.XXXXXX)"
(cd "$bench_c_result" && sha256sum -c SHA256SUMS)
git clone "$bench_c_result/fixture.bundle" "$bench_c_restore/fixture"
git -C "$bench_c_restore/fixture" checkout --detach beb383cf729b0863912bae23abcbb4abaf34bcca
git -C "$bench_c_restore/fixture" apply --check --index "$bench_c_result/capture-staged.patch"
git -C "$bench_c_restore/fixture" apply --index "$bench_c_result/capture-staged.patch"
git -C "$bench_c_restore/fixture" status --short
(cd "$bench_c_restore/fixture" && node scripts/validate.mjs --worktree)
```

Expected: evidence/request-flow-source.txt added and graph/claims.json, entities.json, runs.json modified, all staged. Git may warn about whitespace in a numbered blank source line; those captured bytes are intentionally preserved. Do not commit this restored state and describe it as an agent-produced memory commit. Bundles do not include .git/hooks.

For public CLI inspection, build the exact candidate separately:

```sh
git clone --no-local . "$bench_c_restore/tool-source"
git -C "$bench_c_restore/tool-source" checkout --detach 9bec33efb11dfa4c4664f39d467bd2d02b66690d
(cd "$bench_c_restore/tool-source" && npm ci && npm run build)
(cd "$bench_c_restore/fixture" && node "$bench_c_restore/tool-source/dist/src/cli.js" check)
(cd "$bench_c_restore/fixture" && node "$bench_c_restore/tool-source/dist/src/cli.js" doctor)
(cd "$bench_c_restore/fixture" && node "$bench_c_restore/tool-source/dist/src/cli.js" query request_handler)
```

The operator restored the actual bundle and staged patch and verified snapshot, staged diff and status equality. Check/doctor/query succeeded outside the restricted command sandbox. These checks establish structural consistency, not atomicity, truth, freshness, timestamp authenticity or application security.

## Verification and limits

Candidate, protocol, fixture and installed skill are unchanged. The pinned candidate's focused 17 checks and complete 387-test suite, plus typecheck and packaging checks, are retained in [attempt 01](../provenance-2026-09-07-01/README.md); they were not rerun or represented as new tests here. This continuation changes benchmark records only. [Attempt 02](../provenance-2026-09-07-02/README.md) preserves the additional usage-interrupted empty capture.

This record does not demonstrate three-audit provenance reliability. It covers one fixture and one requested model/configuration; the effective immutable provider snapshot is unavailable. No independent human review is claimed. Result text/bundle content was inspected for credentials and private configuration; no redactions were required. Generated product builds, installed dependencies and package archives are excluded. SHA256SUMS identifies published bytes, not observation authenticity.

Before another experiment, review the hook-capability preflight gap and the atomic-claim failure. Any changed environment, guidance or prompt requires a new experiment ID and fresh empty memory. Do not repair or relabel this observation. The three independent audits and Test D remain outstanding.
