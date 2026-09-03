# Stale-memory benchmark: explicit run closure

Date: 2026-09-04
Scenario: GraphKeeper Memory Bench v0.1, Test B -- Stale Memory
Result: **PASS, including the previously failing run lifecycle**

## Result

Session 1 started in a fresh isolated repository where authentication lived in
`src/auth.ts`. A fresh ephemeral Codex session recorded two grounded claims, closed
its producing run with `graphkeeper close run`, passed `graphkeeper check` and
`graphkeeper doctor`, and committed only memory files.

The fixture then moved that file unchanged to `src/security/auth.ts` and committed the
move without updating GraphKeeper memory. Immediately before Session 2, the active
`implemented_in` claim still returned `src/auth.ts`.

Session 2 was a separate ephemeral Codex invocation with the same neutral prompt. It
retrieved the existing memory first, confirmed the contradiction, captured fresh
evidence, and appended `claim_16332d0e` for `src/security/auth.ts` with
`supersedes: claim_c9cd4a1e`. It preserved the old location claim and the independently
valid token-comparison claim. It then closed its distinct producing run with
`graphkeeper close run` and committed only graph and evidence files.

The final query returns `src/security/auth.ts`, not the stale location. Both producing
runs contain `ended` and `verdict: passed`; final check and doctor results are clean
with zero warnings. This passes Test B and resolves the separate lifecycle defect
recorded by the prior benchmark.

## Scoring

- [x] Session 1 committed grounded memory for the original location.
- [x] The repository changed without updating the memory store.
- [x] Session 2 retrieved the stale active claim before current-state investigation.
- [x] Session 2 reported `src/security/auth.ts` as current.
- [x] Fresh line-addressable evidence was captured.
- [x] The replacement location claim explicitly supersedes the old location claim.
- [x] The old claim remains preserved in `graph/claims.json`.
- [x] The stale location is absent from active query results.
- [x] Session 1 and Session 2 used distinct runs and distinct Codex threads.
- [x] Both sessions closed their run through `graphkeeper close run` before commit.
- [x] Both memory commits exclude application files.
- [x] The final graph passes `check` and `doctor` with zero warnings.

## Secondary observation

Session 2 correctly began with retrieved memory and bounded its code inspection to the
authentication surface, but after finding `src/auth.ts` missing it also inspected Git
history. That was unnecessary for proving the current file move and is stricter than
Test B requires; it does not affect stale-claim correction or run closure. A future
prompt-efficiency benchmark can score this separately.

## Reproducibility

- Session 1 thread: `01a06944-59cd-74e3-b003-091bb11e4493`
- Session 2 thread: `01a06946-e152-7252-8bd9-149059cb9e54`
- Both were separate `codex exec --ephemeral --ignore-user-config --json` invocations.
- Both received the exact prompt in `prompts.md`.
- Candidate package SHA-256:
  `23a50807101ca76a04d488ebca092892f319674c4bdb2369b516f37bc5e88788`
- Candidate and installed skill SHA-256:
  `e94bd49275de040b8571fd9a0074553b18c7dca0ebcf8e9901eeaacad7130829`

`fixture.bundle` contains the complete inspectable Git history. `graphkeeper/` is the
final memory snapshot; `fixture/` contains the installed guidance and current source;
the two `session-*-final.md` files retain each agent's final report.
