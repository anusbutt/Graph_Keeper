# Stale-memory benchmark: Cursor adapter guidance target

Date: 2026-09-03
Scenario: GraphKeeper Memory Bench v0.1, Test B -- Stale Memory
Result: FAIL

## Result

Session 1 recorded claim_51efdfd4 at workspace commit 756e191: the Cursor
adapter writes its GraphKeeper guidance block to .cursor/rules/graphkeeper.md,
grounded in README.md and confirmed in src/lib/agent-adapters.ts.

Commit 72676b6 then changed this for real: the Cursor adapter's guidance
target moved to AGENTS.md.

Session 2 was a fresh session with no continuation from Session 1, given a
task that required the same fact without mentioning GraphKeeper, staleness,
or the specific file path. It correctly retrieved claim_51efdfd4, correctly
checked current source, and correctly reported in its response that the
stored claim was stale and that AGENTS.md was now authoritative.

However, Session 2 never recorded that correction. graph/claims.json still
contains only claim_51efdfd4, unsuperseded. graphkeeper query cursor_adapter
returns .cursor/rules/graphkeeper.md as the sole active claim. graphkeeper
doctor reports 0 errors, because it validates structural integrity, not
freshness against live source.

This is a genuine failure for Test B's question: the memory system did not
end up representing that the original conclusion was no longer current. The
diagnosis was correct in conversation; the durable record was not updated.
Any later session or human querying GraphKeeper directly, rather than reading
this specific session's prose, would get the wrong answer presented as
current and unflagged.

Likely root cause: templates/SKILL.md instructs escalating into freshness
verification when a contradiction is found (Retrieve before investigating
section), but has no corresponding instruction in the Write section requiring
a superseding claim once that contradiction is confirmed. The skill tells the
agent to notice staleness, not to fix it in the store.

This result is self-referential: GraphKeeper's own repository is both the
tool and the subject under test, unlike Test A's use of an external
portfolio project. That trade-off was deliberate, since Test B concerns the
memory system's own representational behavior rather than agent behavior on
unrelated code.

## Sessions

- Session 1 (investigation + recording): produced run_2026-09-03-cursor_guidance,
  workspace commit 756e191.
- Session 2 (staleness detection): fresh session, no continuation from Session 1,
  workspace commit 72676b6. Produced no new claims or runs -- that absence is
  itself the finding.

## Contents

- prompts.md: exact task text for both sessions.
- graphkeeper/: snapshot of entities.json, claims.json, runs.json as of the
  end of Session 2, and the evidence file cited by claim_51efdfd4.

No GraphKeeper implementation, application code, schema, or template is
modified by this benchmark record. AGENTS.md was modified once, before either
session: graphkeeper init --integrate codex added GraphKeeper's own Codex
integration block, a one-time prerequisite for dogfooding the tool on its own
repository. Neither session edited AGENTS.md, and that setup step is
unrelated to the fact under test.
