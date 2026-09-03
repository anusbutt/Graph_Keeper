# Stale-memory benchmark: authentication relocation post-fix

Date: 2026-09-03
Scenario: GraphKeeper Memory Bench v0.1, Test B -- Stale Memory
Result: **PASS for stale-memory correction, with a separate run-lifecycle defect**

## Result

Session 1 started from a clean isolated repository where authentication lived in
`src/auth.ts`. A fresh ephemeral Codex session recorded and committed two grounded
claims: the implementation location and the unchanged token-validation rule.

The fixture then moved the file unchanged to `src/security/auth.ts` and committed the
change as `refactor module layout` without touching GraphKeeper memory. The captured
pre-Session-2 query still returned `src/auth.ts` as the active `implemented_in` claim.

Session 2 was a separate ephemeral Codex invocation with the same prompt and no
continuation from Session 1. It retrieved the existing memory, checked current source,
identified the location claim as stale, captured fresh evidence, and appended
`claim_317285cb` for `src/security/auth.ts` with
`supersedes: claim_8e7fe9d2`. It preserved the old claim and committed only GraphKeeper
memory files.

The final query no longer returns the old location claim as active. The original
`validates_by` claim remains active because the move did not change that independently
stored behavior. `graphkeeper check` and `graphkeeper doctor` both pass, and Session 2
made no application-code changes.

This answers Test B's question positively: after the skill change, the fresh session
represented the formerly correct location as superseded instead of merely reporting
the contradiction in conversation.

## Scoring

- [x] Session 1 committed grounded memory for the original location.
- [x] The repository changed without updating the memory store.
- [x] Session 2 retrieved the stale active claim before investigating current state.
- [x] Session 2 reported `src/security/auth.ts` as current.
- [x] Fresh line-addressable evidence was captured.
- [x] The replacement location claim explicitly supersedes the old location claim.
- [x] The old claim remains preserved in `graph/claims.json`.
- [x] The stale location is no longer returned as active current truth.
- [x] Session 2 used a distinct GraphKeeper run and a distinct Codex thread.
- [x] Session 2 committed only graph and evidence files.
- [x] The final graph passes `check` and `doctor` with zero warnings.

## Separate lifecycle finding

Both Codex sessions left their GraphKeeper runs open. Session 2 attempted to close its
run, but called `graphkeeper append run` with creation arguments and received `GK401`
because the run already existed. Session 1 did not attempt a close. This violates the
skill's close-when-work-ends guidance, but it does not change the Test B result: the
sessions still have distinct runs, and the stale claim is correctly superseded.

## Session isolation and candidate identity

- Session 1 thread: `01a0682a-37a6-79d0-af8f-94d58b2a5337`
- Session 2 thread: `01a0682d-4da0-7443-bafa-62be5d300038`
- Both used separate `codex exec --ephemeral --ignore-user-config --json` invocations.
- Both received the exact same prompt recorded in `prompts.md`.
- The tested skill and installed fixture skill share SHA-256
  `f9e538977ca35c9f727cef52e1600d0c62a213ca011e2a88b1b7d4bfa50a925a`.
- The local candidate package SHA-256 was
  `cc30e0ac053b79ef634e36232c506e5a067a51a73d16c24b41adab44f7db80f0`.

The first Session 1 launch failed before creating a Codex thread because CLI 0.153.0
rejects combining explicit `--sandbox` with `--approve-for-me`. Its stderr is retained;
the behavioral run was then launched once with the compatible flag set.

## Contents

- `prompts.md`: exact prompt and invocation controls.
- `environment.md`: candidate, CLI, package, thread, and fixture identities.
- `session-1.jsonl` and `session-2.jsonl`: raw Codex event streams.
- `query-*.txt`, `check-after-session-2.txt`, and `doctor-after-session-2.txt`:
  before-and-after CLI evidence.
- `fixture.bundle`, `fixture-history.txt`, and commit summaries: inspectable temporary
  repository history.
- `graphkeeper/`: final graph and evidence snapshot.
- `fixture/`: installed skill, agent guidance, and final application source.
- `candidate-source.diff`: the uncommitted skill and focused-test change under test.

No benchmark agent edited the GraphKeeper product repository. This benchmark record is
committed independently; the candidate skill and focused-test changes remain outside
the benchmark commit.
