# Claude Code instructions

@AGENTS.md

- Invoke `/graphkeeper` when retrieving or recording durable repository knowledge.
- Claude Code's GraphKeeper adapter owns only its marked block in `CLAUDE.md` and the
  canonical skill at `.claude/skills/graphkeeper/SKILL.md`; preserve all other user
  content.
- Restart Claude Code if the current session began before the repository's
  `.claude/skills/` directory was created.

## Development workflow: follow the SDD cycle

Every feature or behavior change MUST proceed in this order, per the constitution
(`.specify/memory/constitution.md`) and the canonical `AGENTS.md`:

1. **Constitution** — amend only if a principle changes (documented rationale + impact
   report + version bump). Most features need no amendment.
2. **Spec** — write `specs/NNN-short-name/spec.md` (goal, prioritized user stories with
   acceptance scenarios, requirements, success criteria). Get it approved before planning.
3. **Plan** — write `specs/NNN-short-name/plan.md` (summary, technical context,
   constitution check, sequence, files changed, risks).
4. **Tasks** — write `specs/NNN-short-name/tasks.md` (test-first, phase-ordered, grouped
   by user story).
5. **Implementation** — write or update tests FIRST, observe them fail for the intended
   reason, then implement the smallest change to pass. Do not implement before the
   spec, plan, and tasks exist.

### Rules of the cycle

- Do NOT jump straight to implementation. Stop and produce each artifact in order; the
  user can approve or redirect at each step.
- Tests are mandatory and precede the code they govern (red → green). Cover both accepted
  behavior and its rejection boundary.
- Keep changes small, focused, and test-backed. Preserve stable `GKnnn` diagnostics, exit
  codes, schema fields, and append-only semantics.
- `specs/`, `.specify/`, `.codex/`, `history/`, and `PROGRESS.md` are git-ignored local SDD
  artifacts. They are handoff material, not commits or package content.
- Run the smallest relevant focused test while developing, then `npm run typecheck` and the
  complete suite before handoff.
