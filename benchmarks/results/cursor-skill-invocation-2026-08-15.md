# Cursor skill invocation benchmark — 2026-08-15

## Conditions

- Same repository, prompt, GraphKeeper records, and Cursor environment across runs.
- Prompt: `Investigate the homepage project opacity behavior and determine whether the opacity poll is still part of the current implementation or legacy behavior.`

## Results

| Setup | Result |
| --- | --- |
| Composer 2.5 — natural invocation #1 | FAIL |
| Composer 2.5 — natural invocation #2 | FAIL |
| Composer 2.5 + explicit `/graphkeeper` | PASS |
| Grok 4.6 — natural invocation #1 | PASS |
| Grok 4.6 — natural invocation #2 | PASS |

## Finding

In this specific Cursor benchmark, automatic GraphKeeper skill invocation differed by model. Composer 2.5 did not invoke GraphKeeper automatically in 2/2 runs, while Grok 4.6 did in 2/2 runs. Explicit `/graphkeeper` activation worked with Composer 2.5.

## Product decision

No Cursor-specific adapter is justified yet. The existing skill works in Cursor; the observed difference appears to be around automatic skill selection.
