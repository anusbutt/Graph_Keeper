# Worked example: correcting a flaky-test finding

This populated example demonstrates a complete GraphKeeper flow with generic test
output. It contains two committed evidence captures protected from rewrite by the
validator, two closed runs, one corrected tool-output claim, and one explicit
inference.

## Setup

Use a clean scratch Git repository or an empty GraphKeeper scaffold. Do not overwrite
an existing populated graph. From the GraphKeeper source repository in Git Bash or
WSL:

    npm run build
    cp -R examples/worked-example/graph/. graph/
    cp -R examples/worked-example/evidence/. evidence/
    node dist/src/cli.js check
    node dist/src/cli.js doctor

From native Windows PowerShell:

```powershell
npm run build
New-Item -ItemType Directory -Force graph, evidence | Out-Null
Copy-Item -Path examples/worked-example/graph/* -Destination graph/ -Recurse -Force
Copy-Item -Path examples/worked-example/evidence/* -Destination evidence/ -Recurse -Force
node dist/src/cli.js check
node dist/src/cli.js doctor
```

Installed-package users can run `npx graphkeeper check` and
`npx graphkeeper doctor` instead. Both commands should succeed, and doctor should
report zero errors and zero warnings.

In a fresh installed-package repository, run `npx graphkeeper init` first. Codex
discovers the generated `.agents/skills/graphkeeper/SKILL.md`; repositories that want
a complete Codex or Claude Code integration can run
`npx graphkeeper init --integrate codex`,
`npx graphkeeper init --integrate claude`, or `--integrate all`. Review and confirm
the plan, or add `--yes` in a non-interactive environment. The default form leaves
`AGENTS.md` and `CLAUDE.md` untouched.

## Query the durable subject

Run:

    node dist/src/cli.js query test_payments_flaky

The result contains active `claim_22222222` and `claim_33333333`. It excludes
`claim_11111111` because the later tool-output claim supersedes it. Query reports the
inference because it is active durable memory; that does not make the inference proof.

## Trace the evidence

`claim_22222222` records `evidence/utc-rerun.log#L1-L3`. Inspect those exact inclusive
lines:

    sed -n '1,3p' evidence/utc-rerun.log

They preserve the command, passing result, and summary. The claim points to
`run_2026-07-21-utc_rerun`; that run lists both the evidence file and the claim ID.
This bidirectional link lets another session reconstruct provenance without a chat
transcript.

## Understand the correction

The first run captured a failing result in `claim_11111111`. The second run captured a
passing UTC result in `claim_22222222`, whose `supersedes` field points to the old
claim. The old claim remains stored for audit history, while only the correction is
active. `claim_33333333` records the possible timezone cause honestly as inference.

## Apply the grounded reviewer

Copy the prompt from `examples/reviewer.md` and provide it with the proposed factual
statement plus this example's graph and evidence. The canonical cases are:

| Case | Statement | Expected result |
|---|---|---|
| Supported | The payments test passes when TZ is UTC. | `APPROVE`, citing `claim_22222222` |
| Inference-only | The payments failure is caused by a timezone dependency. | `REVISE`, requesting external evidence |
| Unsupported | The payments test is owned by the reliability team. | `REVISE`, naming the statement |
| Superseded | The payments test currently fails. | `REVISE`, because `claim_11111111` is not current support |

The complete expected outputs live in `tests/fixtures/reviewer/cases.json`. An approval
must cite active tool-output claim IDs; an inference, missing claim, or superseded
claim cannot justify factual approval.
