# Claude Code instructions

@AGENTS.md

- Invoke `/graphkeeper` when retrieving or recording durable repository knowledge.
- Claude Code's GraphKeeper adapter owns only its marked block in `CLAUDE.md` and the
  canonical skill at `.claude/skills/graphkeeper/SKILL.md`; preserve all other user
  content.
- Restart Claude Code if the current session began before the repository's
  `.claude/skills/` directory was created.
