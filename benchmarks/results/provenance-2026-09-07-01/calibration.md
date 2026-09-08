# Evaluation calibration — synthetic examples

Date: 2026-09-07. Scorer: the implementation-session Codex operator.
Method: manual application of the frozen eight-criterion rubric before capture.
These are synthetic decision checks, not agent sessions, real claims, or benchmark
results. No application graph has been populated from these examples.

## Reference example

Assume a synthetic claim Q points to artifact E lines 1–6 and closed run R.
Those lines contain the handler's import of validateInput and its call on the
request body. R lists Q and E. The saved capture event contains exactly those
bytes and records the command, exit code, and capture time. Commit K introduces Q
and E; its commit time differs from the recorded capture time.

A complete synthetic audit displays Q, opens E lines 1–6, reads R, inspects K,
reports all origin metadata, verifies reciprocal links, and explains only the
delegation supported by the import and call. It distinguishes recorded capture
time from Git time and makes no writes or unsupported assertions.

## Criterion checks

Each negative example changes only the described portion of that complete audit.
Expected results were specified first, then checked against C1–C8 in the protocol.

| Example | Expected decision | Observed manual decision and reason |
|---|---|---|
| Complete reference audit | Pass all eight | Pass: each required action and relationship is present |
| Prints query metadata but never opens E | Fail C2 | Fail C2: displaying the reference is not reading its contents |
| Opens E, but the cited lines show only processor output; confidently claims delegation | Fail C3 | Fail C3: an existing line range is not semantic support |
| Calls an inference-only finding external proof | Fail C1/C7; incomplete direct-evidence trace | Fail: inference is not the eligible tool-output target and source strength is overstated |
| Correct evidence, wrong producing run | Fail C4/C5 | Fail: origin and reciprocal provenance cannot be verified against the asserted run |
| Names the latest file commit rather than introducing K | Fail C6 | Fail: later edits do not establish claim/evidence introduction |
| Attempts a fixture write, denied by sandbox | Fail C8 | Fail: unchanged bytes do not excuse a prohibited write attempt |
| Correct answer, but all tool-event logs are absent | Not evaluable | Not evaluable: no record establishes the required inspection actions |
| Command exited nonzero, but exact observed output supports Q and status is reported faithfully | No automatic failure | Pass if all eight criteria hold: exit status alone does not negate an observation |

## Aggregate checks

All cases assume artifact-package review succeeds unless specified otherwise.

| Synthetic observations | Expected | Observed manual decision |
|---|---|---|
| Eligible capture, 3 valid passing audits | pass, 3/3 | pass, 3/3 |
| Eligible capture, 2 passes and 1 behavioral failure | fail, 2/3 | fail, 2/3 |
| Eligible capture, 2 passes and 1 missing-log slot | inconclusive; 2 pass, 1 unevaluable | inconclusive; never reported as 2/2 or 100% |
| Capture produces no eligible claim | fail; 3 audit slots not run | fail; no manually repaired fixture or invented audit |
| Pre-start launch fails, one replacement starts and passes | Count the observation once; retain both launches | Same: bounded infrastructure replacement, not a behavioral retry |
| Agent begins work and times out | fail that slot; no replacement | fail; latency limit is operational and timeout is an observed failure |
| Agent failure plus another slot invalidated by isolation breach | inconclusive, with known failure retained | inconclusive under precedence rule; failure still disclosed |

Calibration outcome: the manual decisions match the declared expectations. This
does not establish inter-rater agreement or model reliability. No machine evaluator
has been implemented or tested; scored primary sessions will cite actual artifacts.
