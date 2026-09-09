# Benchmark D — Correction History

**Repository under test:** `anusbutt/Prospector`
**Execution date:** 2026-09-10
**GraphKeeper version:** 0.5.0
**Execution style:** Manual replay of real repository evolution using fresh Codex sessions
**Result:** PASS — correction-history behavior

## Goal

Test whether GraphKeeper preserves previous conclusions when knowledge changes repeatedly, and whether a fresh agent can later reconstruct the complete correction chain while correctly distinguishing historical claims from the current claim.

## Real repository evolution

The benchmark replayed a genuine Prospector product change from Git history.

### State A

Original repository state: `5b0e9c2`

Prospector could actually deliver outreach only through email using Gmail or authenticated SMTP. Messenger-channel notes were not sendable.

GraphKeeper recorded:

`claim_dcb9f1e4`

Benchmark memory commit:

`2ec910d`

### State B

Real source change replayed from original commit:

`ad31f40` — assisted-manual Messenger delivery (`prospector dm`)

Benchmark replay commit:

`6efb29e`

A fresh Codex session retrieved the existing GraphKeeper memory, inspected only the current repository state, determined that the previous claim was stale, and recorded assisted-manual Messenger delivery.

Correction claim:

`claim_17a733c1`

It explicitly superseded:

`claim_dcb9f1e4`

A parallel supporting email-delivery claim was also recorded:

`claim_1661437a`

Benchmark memory commit:

`6e0fac2`

### State C

The repository was advanced through its real subsequent commits until the original Facebook-removal change:

`4b43dea` — remove Facebook as a communication channel

Benchmark replay commit:

`58d7946`

A new fresh Codex session retrieved existing GraphKeeper memory and discovered from the current source that Messenger delivery had been removed and email was again the only supported delivery channel.

Correction claim:

`claim_d6274372`

It explicitly superseded:

`claim_17a733c1`

Benchmark memory commit:

`c6107f1`

## Final correction chain

`claim_dcb9f1e4`
→ `claim_17a733c1`
→ `claim_d6274372`

Meaning:

**Email-only**
→ **assisted-manual Messenger added**
→ **Messenger removed; email-only becomes current again**

The previous claims were preserved rather than rewritten or deleted.

## Fresh read-only audit

A completely fresh Codex session was instructed to:

* not inspect Git history or commits;
* not modify files;
* not create or update GraphKeeper records;
* use only existing GraphKeeper records and their referenced evidence;
* reconstruct the complete outreach delivery correction history;
* distinguish historical claims from the current claim;
* report uncertainty rather than guess if the records were insufficient.

The auditor reconstructed from the existing GraphKeeper records alone:

`claim_dcb9f1e4 → claim_17a733c1 → claim_d6274372`

It correctly identified:

* `claim_dcb9f1e4` as historical;
* `claim_17a733c1` as a historical correction;
* `claim_d6274372` as the current correction;
* `claim_1661437a` as a parallel supporting email-delivery claim.

The auditor concluded that the current state is email-only delivery through Gmail or SMTP.

## Read-only audit verification

GraphKeeper files were hashed before the final audit.

Before audit:

`64b2bd83daf13ed17f7176794cdff80ed1f4ee8c72f74eac516300304dabc541  graph/claims.json`

`fc485331d77d36e78443d4f46b560c219cdf559a065a4aabf5ec273ae1156a55  graph/entities.json`

`74cb7babac82b7ae26a5327d24632dac599475a26322abb5ed4bdd80ae1aa4c6  graph/runs.json`

After audit:

`64b2bd83daf13ed17f7176794cdff80ed1f4ee8c72f74eac516300304dabc541  graph/claims.json`

`fc485331d77d36e78443d4f46b560c219cdf559a065a4aabf5ec273ae1156a55  graph/entities.json`

`74cb7babac82b7ae26a5327d24632dac599475a26322abb5ed4bdd80ae1aa4c6  graph/runs.json`

The hashes matched exactly. The final audit did not mutate GraphKeeper state.

## Result

**PASS**

This run demonstrates that, in this real repository evolution scenario, GraphKeeper preserved a multi-generation correction history and allowed a fresh agent to reconstruct:

1. the original conclusion;
2. the first correction;
3. the later correction;
4. the explicit supersession relationships;
5. the current conclusion;
6. supporting evidence for each stage.

The auditor correctly distinguished historical knowledge from current knowledge without using Git history.

## Observed caveats

GraphKeeper 0.5.0 could not close the State B run through its available append interface. This was a previously known lifecycle issue and did not affect the correction-history assertion tested here.

The final auditor also found that `claim_dcb9f1e4` has a creation timestamp earlier than the recorded start of its producing run. The supersession chain and referenced evidence remained sufficient for this benchmark, but the anomaly indicates a separate temporal-integrity issue that should be investigated independently.

## Scope

This PASS demonstrates correction-history behavior for this specific Prospector replay.

It does not establish general reliability across repositories, models, or all forms of software evolution.
