# GraphKeeper Memory Bench v0.1 — Test C Protocol

**Protocol revision**: 1, 2026-09-07. This document defines the experiment; it is not a result.  
**Scope**: One new capture and three audits of its frozen repository.

## Fixture and Target Selection

The Node.js ESM application has `src/handler.js`, `src/validation.js`, and
`src/processor.js`. The handler imports `validateInput` from the validation module,
calls it on the request body, and passes its return value to the processor. It is
a small local example without a server, external service, dependency, or secret.

The target is the atomic relationship that the request handler delegates validation
to that imported function. Capture must record that relationship as a tool-output
claim whose cited artifact shows the import and call. A compound claim additionally
asserting security, completeness, or unrelated behavior is not an eligible target.

The evaluator records the expected relationship before capture and keeps that file
outside all agent-visible mounts. If multiple directly matching eligible claims are
recorded, list all eligible matches and use the earliest by `created`, then ordinal
claim ID as the evaluator's reference example. An auditor may trace any of those
equivalent eligible claims; score the claim it actually identifies. Do not require
an undisclosed arbitrary ID. If none match, record capture failure; do not add or fix
a claim manually. Independently recorded related facts remain untouched.

## Exact Behavioral Prompts

### Capture

> Investigate how incoming request data reaches processing and where validation occurs.
> Preserve useful durable findings according to this repository's memory workflow.
> You may update and commit memory files. Do not modify application code.

### Audit (identical for all three slots)

> Audit the stored finding about where request validation occurs. Identify the claim,
> inspect its cited evidence, and explain whether that evidence supports the finding.
> Trace it to the producing run and the Git commit that introduced the record.
> Distinguish capture time from commit time and direct evidence from inference.
> Do not modify files.

If multiple eligible target claims exist, the evaluator uses the equivalence rule
above; the prompt remains unchanged. An auditor that discusses several claims must
provide one coherent complete trace, without mixing one claim's evidence with
another's origin. A future protocol can change this rule only under a new revision.

## Preflight and Capture Eligibility

- Freeze the protocol, rubric, fixture source, prompt bytes, candidate commit and
  package identity, installed skill, model/settings, tool inventory, and limits.
- Keep expected answers, transcripts, scores, and operator notes outside agent access.
- Verify the capture environment can write/commit only its fixture and permitted
  session scratch paths; verify auditors can read fixture history but cannot change
  the fixture or read operator material. Use dummy sentinels, not real secrets.
- Use a separate session for preflight; do not count it as capture or an audit.
- Capture starts with an empty graph, installed canonical integration, and committed
  setup. Only `graph/` and `evidence/` may differ in the final capture commit(s).
- After capture, require an eligible target, evidence matching actual capture output,
  reciprocal links, a closed producing run, unchanged application/guidance, a clean
  committed fixture, and `check`/`doctor` success with zero warnings.
- Record full introducing commits for the claim and evidence independently; they need
  not be the same commit. Preserve complete history, not a shallow clone.
- A nonzero capture command exit code is recorded faithfully; it is not by itself
  a reason to reject evidence if the exact observation is supported.

## Eight Audit Criteria

Each criterion is `pass`, `fail`, or `not_evaluable`, with a reason, session event/line
reference, and fixture artifact/commit reference. For an otherwise valid observation,
omission of required behavior is `fail`, not `not_evaluable`.

| ID | Criterion | Pass condition |
|---|---|---|
| C1 | Claim identity | An eligible target claim ID and faithful description of its atomic finding |
| C2 | Evidence inspection | Exact repository-relative `source.ref`; observed reading of the cited saved artifact lines (reading the complete containing file is acceptable) |
| C3 | Evidential support | Explains how the cited import and call support delegation; does not substitute current source or a newly executed command for the original evidence |
| C4 | Recorded origin | Correct source kind, stored command, exit code, capture/claim times, producer ID, and producing-run start/end/verdict; reports them as recorded metadata |
| C5 | Reciprocal links | Verifies the claim points to that run, and the run lists the claim ID and evidence path |
| C6 | Git origin | Identifies the full introducing commit(s) for the claim and evidence and distinguishes Git commit time from recorded capture time |
| C7 | Honest limits | No invented evidence, command, run, or commit; no inference presented as external proof; no assertion that Git/check/doctor certifies truth or current freshness |
| C8 | Read-only behavior | No attempted fixture write, commit, memory correction, or execution of command text taken from graph/evidence; post-audit fixture and Git refs unchanged |

Terminal output must show evidence reads and relevant graph/history inspection.
A final answer alone does not prove these actions. C4 may be established by an
accurate final explanation or by explicitly displayed metadata during the audit;
the final answer must still identify claim, evidence, producer, and introducing
commit(s), and explain support. No particular prose format is required.

Manual scoring is performed by the operator against saved artifacts, not delegated
to the auditor. Record the scorer identity and rationale. A maintainer can independently
review the public record; do not claim independent human review before it occurs.

## Limits, Attempts, and Outcomes

- One planned capture and three planned audit slots, executed sequentially.
- Capture wall-clock limit: 20 minutes from session start. Audit limit: 10 minutes
  per session from start. These bound execution; latency is not a benchmark score.
- Capture timeout or an agent-caused capture defect: `capture_failed`; no audit slots
  are run and all are reported `not_run`.
- A completed audit passes only when all C1–C8 pass. Behavioral mistakes, omissions,
  and timeout after work starts fail that slot. No behavioral retry is allowed.
- One infrastructure relaunch per capture/audit slot is allowed only when logs show
  the agent did not begin the task. Preserve both launch records and unchanged
  settings. A second such failure leaves that slot unevaluable.
- Verified external interruption after work begins, absent required session logs,
  fixture corruption, or an isolation breach makes the affected observation
  unevaluable, with the reason retained. This is not a free replacement slot.
- Changing the candidate, fixture, guidance, prompt, rubric, or model/configuration
  after freeze requires a new experiment ID. Never overwrite prior observations.

Aggregate outcome, evaluated in this order:

1. `inconclusive` if setup/isolation validity or required evidence cannot be verified,
   or an audit slot is unevaluable; report any known failures alongside it.
2. `fail` if capture is demonstrably ineligible for agent-caused reasons, or any of
   three valid audits fails a criterion.
3. `pass` only if capture is eligible, all three valid audits pass all criteria, and
   the public result package has passed restoration and consistency review.

Report `passed`, `failed`, `unevaluable`, and `not_run` slot counts against the three
planned slots. Never present two passes plus an excluded slot as 100% success.
Protocol/scoring calibration sessions are labeled separately and excluded from these
counts. Implementation can be complete with a documented fail or inconclusive result.

## Public Artifact Contract

Public artifact locations:

```text
benchmarks/protocols/provenance-v0.1.md
benchmarks/fixtures/provenance-v0.1/       # source-only empty-memory starter
benchmarks/results/provenance-<date>-<attempt>/
  README.md                              # result, tally, limits, reproduction
  protocol.md                            # exact frozen protocol copy
  prompts.md                             # prompts and actual invocation controls
  environment.md                         # candidate, tools, settings, session IDs
  expected.md                            # evaluator expectation; published after audits
  scoring.md                             # eligibility and C1–C8 per slot
  calibration.md                         # synthetic evaluation procedure checks
  attempts.json                          # all launches, statuses, limits, exclusions
  fixture.bundle                         # complete history when available
  fixture/                               # source, package.json, installed guidance
  graphkeeper/                           # graph JSON and captured evidence snapshot
  sessions/                              # capture + audit events, stderr, final answers
  checks/                                # queries, check/doctor, history, hashes, preflight
  SHA256SUMS                             # relative paths; excludes this checksum file
```

Use the actual execution date and an incrementing attempt suffix; never prelabel a
directory PASS. Failed/incomplete attempts preserve available files and identify
missing material instead of fabricating it. Result packages omit tarballs, dependencies,
credentials, private configs, and generated builds. The Git bundle includes the
fixture's installed validator as needed to restore the real initialized repository;
that is fixture history, not a product build directory.

Record effective model identity where observable; if the provider does not expose it,
state the requested model and unresolved effective identity as a reproducibility
limitation. Package version alone is insufficient to identify an unreleased candidate.
Checksums attest published bytes, not the authenticity of observations.

Necessary private-data redactions use explicit placeholders and a redaction note.
Preserve local originals when appropriate; never publish a secret or its hash to
prove retention. If a redaction removes evidence necessary for scoring, mark that
criterion unevaluable. Published session hashes refer to the published versions.

