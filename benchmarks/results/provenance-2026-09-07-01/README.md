# Test C — Provenance: interrupted capture

Date: 2026-09-07. Protocol revision: 1. Result: **INCONCLUSIVE**.

The capture session reached the Codex account usage limit after saving evidence,
appending six claims, and closing its run. It stopped before committing memory or
producing its final answer. The three planned provenance audits were not run.

This record preserves that attempt. It does not demonstrate that Benchmark C passes
or fails, and the agent's stored run verdict `passed` is not the benchmark outcome.

## What happened

The experiment used the exact GraphKeeper candidate and canonical skill recorded in
[environment.md](environment.md), a new three-module request-processing fixture, and
the [frozen prompts](prompts.md). A separate real-agent preflight plus operator
sandbox probes verified fixture access and denied writes/evaluator reads before
the capture session began.

Capture thread `01a07c09-03e7-7560-933a-4709fd65eda0` read the existing empty graph,
inspected source, captured three numbered source artifacts, created six claims,
and closed `run_2026-09-07-request_flow`. Its event stream then ended with an account
usage-limit error and `turn.failed`; the process returned exit 1.

The stored graph has reciprocal provenance and passes check/doctor, but is
uncommitted. The intermediate `routes_input` claim also combines delegation and
forwarding into one statement, rather than the atomic target required by the
protocol. The operator preserved this state without repairing it. Full eligibility
and audit judgments are in [scoring.md](scoring.md).

| Phase | Outcome |
|---|---|
| SDD review | Implementation authorized |
| Protocol/calibration | Completed before capture |
| Candidate/fixture/isolation | Completed; exact settings and preflight retained |
| Capture | Externally interrupted; no committed audit fixture |
| Audit 1 / 2 / 3 | Not run / not run / not run |
| Artifact restoration | Interrupted state reproduced and verified |

Audit tally: **0 passed, 0 failed, 0 unevaluable audit observations, 3 not run**.
There was one capture launch and no behavioral retry. Start/end values in
[attempts.json](attempts.json) are operator launch/completion observations; they are
not model-generated timestamps or a precise execution-time measurement.

## Inspect the evidence

- [Protocol](protocol.md), [prompts](prompts.md), and
  [literal invocation arguments](checks/invocations.json) were fixed before capture;
  [pre-capture hashes](checks/pre-capture-freeze.txt) identify those exact files.
- [Capture event stream](sessions/capture.jsonl) records the observed actions and
  terminal usage error. No capture final-answer file exists because none was produced.
- [Claims](graphkeeper/claims.json), [runs](graphkeeper/runs.json), and
  [evidence](graphkeeper/evidence/request-handler.txt) preserve the interrupted state.
- [Fixture history](checks/fixture-history.txt) and [status](checks/capture-status.txt)
  show that HEAD remained `af35db3a9a1e9f7d322cb06ab62a254a52d1158c`.
- `fixture.bundle` contains the complete **setup history only**. The memory never
  entered Git history; `capture-working-tree.patch` holds the exact modified graph
  files, and `graphkeeper/evidence/` holds the untracked captured evidence.
- [Snapshot checks](checks/snapshot-consistency-outside-parent-sandbox.txt) verify
  evidence bytes against session item_10 and the reciprocal links.
- [Calibration](calibration.md) contains synthetic evaluator checks, not model runs.

## Reproduce the interrupted repository

Run from the GraphKeeper repository root on Linux with Git and Node.js 18+:

```sh
bench_c_result="$PWD/benchmarks/results/provenance-2026-09-07-01"
bench_c_restore="$(mktemp -d /tmp/graphkeeper-c-restore.XXXXXX)"
(cd "$bench_c_result" && sha256sum -c SHA256SUMS)
git clone "$bench_c_result/fixture.bundle" "$bench_c_restore/fixture"
git -C "$bench_c_restore/fixture" checkout --detach af35db3a9a1e9f7d322cb06ab62a254a52d1158c
git -C "$bench_c_restore/fixture" apply --check "$bench_c_result/capture-working-tree.patch"
git -C "$bench_c_restore/fixture" apply "$bench_c_result/capture-working-tree.patch"
cp -R "$bench_c_result/graphkeeper/evidence" "$bench_c_restore/fixture/evidence"
git -C "$bench_c_restore/fixture" status --short
```

Expected status: modified `graph/claims.json`, `graph/entities.json`, and
`graph/runs.json`, plus untracked `evidence/`. Do not commit this restored state and
represent it as a memory commit made by the capture agent.

The bundled standalone validator can inspect the reconstructed graph without a model:

```sh
(cd "$bench_c_restore/fixture" && node scripts/validate.mjs --worktree)
```

For the complete public CLI checks, build the pinned source candidate in a separate
temporary directory (a local clone works when that commit exists in your checkout):

```sh
git clone --no-local . "$bench_c_restore/tool-source"
git -C "$bench_c_restore/tool-source" checkout --detach 9bec33efb11dfa4c4664f39d467bd2d02b66690d
(cd "$bench_c_restore/tool-source" && npm ci && npm run build)
(cd "$bench_c_restore/fixture" && node "$bench_c_restore/tool-source/dist/src/cli.js" check)
(cd "$bench_c_restore/fixture" && node "$bench_c_restore/tool-source/dist/src/cli.js" doctor)
(cd "$bench_c_restore/fixture" && node "$bench_c_restore/tool-source/dist/src/cli.js" query request_handler)
```

The operator performed bundle restoration and installed-candidate CLI checks in a
clean temporary directory; [restoration.txt](checks/restoration.txt) contains their
output. Snapshot equality was also checked. The bundle does not preserve `.git/hooks`;
no commit/hook behavior is claimed by this read-only restoration.

## Repository verification

The unchanged candidate's focused provenance/query/example tests passed 17 checks.
The complete `npm test` rerun passed **387 checks**: 378 regular, 2 package journeys,
1 onboarding, and 6 performance. See
[full-suite-clean-scratch.txt](checks/full-suite-clean-scratch.txt).
Typecheck, validator parity, package smoke, dependency inspection, and syntax checks
also passed; [repository-verification.txt](checks/repository-verification.txt)
summarizes the gates and their limits.

Initial verification failed because the parent execution sandbox blocked Git
subprocesses and a read-only `/tmp/.git` marker misled non-Git-directory fixtures.
The complete rerun used a dedicated `/var/tmp` scratch directory outside that parent
restriction, with no candidate changes. Original failures remain in `checks/`.
Performance ran after packaging/onboarding, following the existing test runner.

## Limits and next attempt

This attempt produced no independent provenance audits, so it cannot answer Test C.
It covers one fixture and one requested model/configuration, and cannot establish
general reliability, current freshness, authenticity, security, or efficiency.
An immutable effective provider model snapshot was not exposed.

After account capacity is available, start a **new experiment ID from empty memory**
under the reviewed protocol. Do not resume or repair this interrupted capture and
count it as the original run. Preserve this record alongside any later result.
Do not buy credits, change accounts, or silently switch models as part of the benchmark.

No credentials, private configuration, installed dependencies, or package archive
are included. Text artifacts were reviewed for credential patterns; no redactions
were required. The two-commit bundle contains only application/setup files. Hashes
in `SHA256SUMS` cover published bytes, not the truth or authenticity of observations.
