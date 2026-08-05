# GraphKeeper — SDD Kickoff Prompt (for Codex)

> Paste this whole file into Codex as the opening prompt for the project.
> It follows Spec-Driven Development: **Constitution → Spec → Plan → Tasks → Implementation.**
> Codex must produce and get sign-off on each stage BEFORE writing implementation code.
> Stop after `tasks.md` and wait for explicit approval before starting Stage 5.

---

## Stage 0 — Role & Operating Rules

You are acting as the lead engineer building an open-source developer tool. You must
follow spec-driven development strictly:

1. Write `constitution.md` first. Wait for approval.
2. Write `spec.md` next, consistent with the constitution. Wait for approval.
3. Write `plan.md` next, consistent with the spec. Wait for approval.
4. Write `tasks.md` next — a numbered, dependency-ordered task list, each task small
   enough to implement and verify independently. Wait for approval.
5. Only after explicit approval of `tasks.md`, begin implementation, one task at a time,
   in order. After each task: run it, show the output/result, and pause for a go/no-go
   before moving to the next task.

Do not skip ahead. Do not write implementation code before `tasks.md` is approved.
If anything below is ambiguous, state your assumption explicitly in the relevant
document rather than guessing silently.

---

## Stage 1 — Constitution (write to `constitution.md`)

Capture the non-negotiable principles this project must never violate, regardless of
implementation details that may change later:

- **Grounded, not vibes.** Every fact ("claim") written to memory must carry a real,
  verifiable source (a command, its exit code, and a reference into a captured log) —
  or be explicitly marked `"source": {"kind": "inference"}` if it's the agent's own
  reasoning with no external evidence. An agent's own prose is never evidence for its
  own claim.
- **Append-only, always.** Nothing in the claims store is ever edited or deleted after
  commit. Corrections happen by appending a new claim that `supersedes` the old one.
  Whether a claim is "still active" is derived at read time (no claim it's superseded
  by exists yet) — never stored as a mutable status field.
- **Harness-agnostic, framework-free.** No SDK, no vendor lock, no required database.
  Works with Claude Code, Codex, OpenCode, or any agent capable of reading files and
  running bash. Plain JSON + `jq` + a `SKILL.md` instruction file + a git hook, nothing
  else required for v1.
- **Guardrails live in the harness, not the prompt.** Every rule that CAN be
  mechanically checked (required fields, unique IDs, resolvable `supersedes`,
  append-only history) MUST be enforced by an automated pre-commit hook — not just
  requested in a markdown instruction file. Be explicit in every doc about which rules
  are enforced (hook) vs. which are only guidance (`SCHEMA.md`).
- **Small first, honest about scale.** Ship the JSON-file version first. Document the
  known scaling ceiling (JSON starts straining around ~10k claims) and the upgrade
  path (SQLite/Postgres, same schema) as a documented future task — do not build it now.
- **Built for any dev, not just this project's author.** No project-specific logic.
  Every example, schema field, and default must be generic and useful to any
  repo/team adopting this tool.
- **Two memories, two truth standards.** Session chatter/dead ends stay in the agent's
  normal progress notes. The graph is only for what was actually established with
  evidence. Never conflate the two.

---

## Stage 2 — Spec (write to `spec.md`)

Define WHAT is being built and WHY, in user-facing terms — no implementation detail yet.

Must cover:
- **Problem statement**: coding agents (Claude Code, Codex, etc.) lose all memory
  between sessions except what they can reconstruct by re-reading old logs/transcripts —
  which is slow, unverifiable, and error-prone. There's no small, framework-free, git-
  native way to give an agent grounded, auditable memory.
- **Target users**: any developer using an AI coding agent (Claude Code, Codex,
  OpenCode, Aider, Cursor, etc.) who wants persistent, provable memory across sessions
  and across tools.
- **User stories** (write at least these, in "As a ___, I want ___, so that ___" form):
  1. As a developer, I want to run one command to scaffold grounded memory into my repo.
  2. As an agent, I want clear written rules for how to write a claim with a real source.
  3. As a developer, I want a commit blocked automatically if an agent writes a claim
     without a real source or with a broken reference.
  4. As a developer, I want to ask "why/how do we know X" and get an instant, sourced
     answer instead of re-reading old sessions.
  5. As a contributor, I want a clear, small, well-documented codebase I can extend
     (new query recipes, new agent-harness adapters, a database backend later).
- **Out of scope for v1**: no database backend, no hosted service, no UI/dashboard, no
  vector search, no multi-repo sync. State these explicitly so scope doesn't creep.
- **Success criteria**: a new user can go from `npx graphkeeper init` to a working,
  hook-enforced, queryable memory store in under 2 minutes, in any repo, without
  installing a database.

---

## Stage 3 — Plan (write to `plan.md`)

Define HOW, technically. Must cover:

- **Repo layout to scaffold into a target project:**
  ```
  graph/
    SCHEMA.md        # field contract + write rules, for humans and agents
    entities.json     # canonical nouns: things claims are about
    claims.json        # append-only array of sourced facts
    runs.json           # one entry per agent session/beat
  evidence/
    (raw captured tool output claims can cite — never edited)
  SKILL.md            # instructions any agent reads to know how to write claims
  .githooks/pre-commit  # or installed into .git/hooks/pre-commit
  ```
- **Claim schema** (canonical fields): `id`, `subject`, `predicate`, `object`,
  `confidence` (optional), `source` (`kind`: `tool_output` | `inference`, plus
  `command`, `exit_code`, `ref`, `captured` for tool_output), `produced_by` (run id),
  `supersedes` (optional), `created`.
- **Entity schema**: `id`, `type`, `aliases[]`, `first_seen`.
- **Run schema**: `id`, `beat`/`task` label, `started`, `tool` (e.g. `claude-code`,
  `codex`), `evidence[]`, `claims_written[]`, `verdict`.
- **CLI tool** (`graphkeeper`, published as an npm package invocable via `npx`):
  - `graphkeeper init` — scaffolds the files above into the current repo, installs the
    git hook.
  - `graphkeeper check` — runs the same validation the hook runs, on demand.
  - `graphkeeper query <subject>` — wraps the common `jq` "active claims for X" lookup
    so users don't have to hand-write jq.
  - `graphkeeper doctor` — sanity-checks an existing graph/ directory (dangling
    supersedes references, missing entities, etc.).
- **Pre-commit hook logic** (jq-only, no framework — base it on this reference
  implementation, adapt as needed):
  1. Every claim has all required fields.
  2. All claim IDs are unique.
  3. Every `supersedes` target actually exists in the file.
  4. No previously committed claim was modified or removed (true append-only).
- **SKILL.md content** — the instruction file any agent (Claude Code, Codex, etc.)
  loads, teaching it: write a claim for every durable finding with a real source; never
  edit/delete a claim, append a superseding one instead; check `entities.json` aliases
  before creating a duplicate entity; keep session chatter out of the graph.
- **Reviewer/grounded-checker pattern** — a second skill/prompt template, shippable as
  an example, that requires citing a claim ID for every factual statement it approves,
  and returns `REVISE` with the missing evidence named if no claim supports the
  statement. Must explicitly refuse to let an `"inference"`-sourced claim alone ground
  a factual assertion.
- **Tech choices**: Node.js/TypeScript for the CLI (broad dev reach, easy `npx`
  distribution), `jq` as the query engine (already documented, zero install-heavy
  dependency for the shell parts), plain POSIX sh for the hook so it works without
  Node at commit time.
- **Non-goals for this plan**: no server component, no auth, no telemetry.
- **Documented (not built) future path**: SQLite/Postgres backend swap once a repo
  exceeds ~10k claims or has concurrent-write collisions — same schema, different
  storage. Flag as a "good first issue" candidate, not part of v1.

---

## Stage 4 — Tasks (write to `tasks.md`)

Break the plan into small, independently verifiable tasks, ordered by dependency.
Roughly this shape (adjust granularity as needed, but keep each task small):

1. Repo scaffolding: package.json, TypeScript config, basic CLI entrypoint.
2. `graphkeeper init` — file/folder scaffolding logic + starter empty JSON files.
3. `SCHEMA.md` template content generation.
4. `SKILL.md` template content generation.
5. Pre-commit hook script (the 4 checks) + install step in `init`.
6. `graphkeeper check` — reuse hook logic as a standalone command.
7. `graphkeeper query <subject>` — jq wrapper for "active claims" lookup.
8. `graphkeeper doctor` — dangling-reference / orphan-entity checks.
9. Example reviewer/grounded-checker prompt template, shipped in `/examples`.
10. End-to-end example walkthrough (worked "flaky test" example from the constitution's
    spirit — but generic, not tied to any specific company's codebase).
11. README.md — hero pitch, quickstart, before/after example.
12. CONTRIBUTING.md — issue labels, good-first-issue list (incl. the future DB backend
    task), PR expectations.
13. Basic test suite: hook rejects a claim missing a field, rejects a broken
    `supersedes`, rejects an edit to a committed claim; `init` produces valid schema-
    conformant starter files.
14. GitHub Actions CI: run the test suite on PRs.
15. License (MIT), issue templates, initial GitHub repo settings (topics, description).

Stop here. Wait for explicit approval before implementing any task.

---

## Notes for Codex

- Every doc you write (`constitution.md`, `spec.md`, `plan.md`, `tasks.md`) should be
  saved as its own file at the repo root, not just printed inline.
- Flag any place where you had to make an assumption instead of asking, directly in
  the relevant doc, so it's easy to spot and correct during review.
- Keep the tone of all generated docs (README especially) practical and plain —
  no marketing fluff, no AI-sounding language.
