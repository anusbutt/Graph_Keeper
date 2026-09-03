# Relevant prompts

## Session 1 — investigation and recording prompt
Workspace at commit 756e191 (Cursor guidance target still .cursor/rules/graphkeeper.md).

Investigate this repository and determine what file the Cursor adapter
(--integrate cursor) writes its GraphKeeper guidance block to. Verify it from
the source (src/lib/agent-adapters.ts) and/or README, not from assumption.

Once verified, use $graphkeeper to record this as a grounded claim with
evidence citing where you found it. Do not change any application code.

## Session 2 — staleness-detection prompt
New session, no continuation from Session 1. Workspace moved to commit 72676b6
(the commit that actually changes the Cursor adapter's guidance target to
AGENTS.md), same graph/ store carried forward untouched.

We're writing a migration script that needs to know every file path
GraphKeeper reads or writes for the Cursor integration -- both the skill file
and the guidance file it manages. List them out.

No mention of GraphKeeper, staleness, or the specific fact was made in Session
2's prompt -- whether and how to use stored memory was left entirely to the
agent's own skill instructions (AGENTS.md / templates/SKILL.md), not prompted.
