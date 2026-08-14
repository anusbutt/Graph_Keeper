# GraphKeeper post-fix session

## Relevant session transcript/output

The benchmark rerun reported:

> GraphKeeper was consulted first.
>
> It retrieved the directly relevant grounded claim and provenance.
>
> The agent limited verification to current-state freshness checks.
>
> It checked current files / working-tree state / current opacity references.
>
> It did not repeat the previous historical investigation with `git log`, `git blame`,
> migration-history reconstruction, historical diffs, or unnecessary tests.
>
> It reused the existing GraphKeeper evidence for the historical reasoning.

The resulting conclusion was:

> The homepage opacity poll remains in the test but represents legacy behavior.

Final benchmark result:

> **PASS — grounded memory reused with bounded current-state verification.**

## Commands and actions

1. Attempted to invoke the `graphkeeper` CLI first; it was not directly available on
   `PATH`.
2. Located the repository-local GraphKeeper records manually.
3. Inspected the active claims, their source kinds, producing run, source references,
   and captured evidence.
4. Reused the existing evidence for the historical scroll-reveal reasoning.
5. Limited freshness checks to the relevant current files, working-tree state, and
   current opacity references.
6. Found no current contradiction and stopped investigating.

The session did **not** run `git log`, `git blame`, historical diffs, migration-history
reconstruction, broad repository searches, or unnecessary tests.

The missing CLI-on-`PATH` condition is recorded as a separate operational observation.
It did not prevent grounded retrieval and is not counted as a benchmark failure.

## GraphKeeper claims and evidence used

The session used the active entity `homepage_project_card_opacity_check`, produced by
`run_2026-08-14-opacity-a1`, including:

- `claim_b8d4e2a6`: the current test polls computed opacity above `0.99`, grounded at
  `evidence/homepage-project-opacity-2026-08-14.txt#L8-L11`.
- `claim_c19e5f73`: the historical card used an opacity scroll reveal, grounded at
  `evidence/homepage-project-opacity-2026-08-14.txt#L23-L26`.
- `claim_d2f6a804`: the current card is a plain article without opacity or viewport
  animation props, grounded at
  `evidence/homepage-project-opacity-2026-08-14.txt#L12-L21`.
- `claim_e5b7c391`: the opacity poll appears redundant because the current card has no
  opacity animation; this is explicitly an inference based on the grounded current and
  historical claims.

Exact snapshots are preserved under `graphkeeper/`.

## Comparison with earlier failures

The pre-fix FAIL retrieved the same relevant memory but repeated broad source search,
Git-history reconstruction, migration diffs, and validation. The first post-fix rerun
also retrieved memory and announced a minimal check, but still repeated broad searches,
multiple history queries, migration diff inspection, blame, and historical tracing.

This post-fix run differs factually: it reused the stored historical evidence, checked
only changeable current state, found no contradiction, and stopped. That bounded
behavior is why the result is PASS.

## PASS rationale

Retrieval happened first, provenance was inspected, historical evidence was reused,
freshness verification stayed bounded to current state, prohibited reinvestigation did
not occur, and the correct conclusion was reached. Therefore the benchmark passes.
