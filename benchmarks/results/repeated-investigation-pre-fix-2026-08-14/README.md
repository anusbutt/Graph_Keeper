# Repeated-investigation benchmark: pre-fix result

Date: 2026-08-14  
Scenario: GraphKeeper Memory Bench v0.1, Test A — Repeated Investigation  
Result: **FAIL**

## Result

The control session independently investigated the homepage project-card opacity
question.

The GraphKeeper session retrieved the existing stored claims before investigating the
question. Those claims directly covered the current test, the current component, the
historical animation, and the inference that the opacity poll was legacy.

Despite that successful retrieval, the GraphKeeper session then repeated substantial
source and Git-history investigation. It also attempted a typecheck and made several
attempts to discover and run the GraphKeeper validator.

This is therefore a benchmark failure for the goal of reducing unnecessary repeated
investigation. Retrieval worked; behavior after retrieval did not materially avoid the
investigation already represented by the grounded memory.

This directory is evidence for the pre-fix baseline. It does not claim that GraphKeeper
failed to retrieve memory, and it does not reinterpret retrieval as benchmark success.

## Sessions

- Finding/capture session: `019fffe7-c5d0-72e1-84cb-db539c39f816`
- Control session: `019ffffb-77d7-7fc2-8ca0-ea2680e2d019`
- GraphKeeper session: `01a00000-9087-7922-beab-1f11bd7f5410`

The control workspace was at portfolio commit
`c45d9ae6571b918f0b081ca8efef458e93cd3073`. The GraphKeeper workspace session was at
`c8a73bd9cd86624a4d7549d1478f988c33dfa893` and contained the captured GraphKeeper
records reproduced here.

## Contents

- `prompts.md`: the finding, recording, and repeated-investigation prompts.
- `control-session.md`: control investigation steps, key outputs, and final answer.
- `graphkeeper-session.md`: retrieval, repeated investigation, key outputs, and final
  answer.
- `graphkeeper/`: exact snapshots of the entity, claims, producing run, and evidence
  available to the GraphKeeper session.

No GraphKeeper implementation, application code, schema, template, or agent guidance
is modified by this benchmark record.
