# Implementation Plan: Codex Skill Discovery

**Branch**: `001-codex-skill-discovery` | **Date**: 2026-08-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-codex-skill-discovery/spec.md`

## Summary

Replace the undiscoverable root guidance generated for new repositories with a
valid repository-scoped Codex skill, while preserving legacy guidance and every
existing agent file by default. Extend `init` with an explicit
`--integrate codex` option that atomically owns one small activation block in
`AGENTS.md`. Add a shell-free `graphkeeper update` path that checks npm's stable
release and installs an exact newer global version without touching repository
files. Keep GraphKeeper's JSON, evidence, validator, hook, platform, and package
boundaries unchanged.

## Technical Context

**Language/Version**: TypeScript 5.9 targeting Node.js 18+; POSIX shell validator
**Primary Dependencies**: Node.js built-ins at runtime; Git, `sh`, and `jq` 1.6+ as external prerequisites
**Storage**: Repository-local JSON and UTF-8 text files; no new storage system
**Testing**: Node built-in test runner across unit, integration, end-to-end, security, and isolated performance suites
**Target Platform**: Linux/macOS directly; Windows through WSL or Git Bash; Codex repository skill discovery
**Project Type**: Single ESM CLI package
**Performance Goals**: Preserve existing init p95 budget and package size discipline
**Constraints**: Atomic writes, idempotency, exact unowned-content preservation, no native PowerShell runtime support
**Scale/Scope**: One GraphKeeper graph and one Codex adapter per repository

## Constitution Check

### Pre-design gate

- **Repository-local source of truth**: PASS. No server, database, or remote state is added.
- **Append-only grounded memory**: PASS. Graph and evidence semantics are unchanged.
- **Stable CLI and diagnostics**: PASS. The new option is additive; invalid forms use existing `GK002`/exit 2 and filesystem conflicts use `GK004`/exit 4.
- **Test-first development**: PASS. Acceptance and rejection tests precede production edits.
- **Supported platforms**: PASS. Runtime remains POSIX shell based and Windows remains WSL/Git Bash only.
- **Vendor-neutral core**: PASS. Codex behavior is isolated to generated adapter files and init orchestration.

### Post-design gate

PASS. The design adds one packaged skill template, one managed-text planner, and
an additive CLI option. No core graph record, validator, query, or evidence
contract changes. Complexity is bounded and justified by safe ownership of
existing `AGENTS.md` content.

## Design

### Discoverable skill

- Keep `templates/SKILL.md` as the packaged source asset, but make it a valid
  skill with only `name` and `description` frontmatter.
- Generate it at `.agents/skills/graphkeeper/SKILL.md`.
- Stop creating root `SKILL.md` in clean repositories.
- Preserve any existing root `SKILL.md` and report it as legacy guidance.
- Treat the generated skill as refreshable under `--force`.

### Codex activation block

- Default init never reads or writes `AGENTS.md` or `CLAUDE.md` for mutation.
- `--integrate codex` plans exactly one managed block in root `AGENTS.md`.
- Missing file: atomically create a file containing the block.
- Existing file without markers: append the block, preserving every existing byte.
- Existing file with one valid marker pair: replace only the owned span.
- Missing, repeated, reversed, or nested markers: fail with `GK004` before any
  initialization write.
- Detect the existing newline convention for generated block lines.
- Never inspect or modify `CLAUDE.md`.

### CLI grammar

Parse init options with a small deterministic state machine. Accept `--force`
and the two-token `--integrate codex` pair in either order, at most once each.
Reject missing targets, unsupported targets, duplicates, and unknown tokens with
`GK002` and no mutation.

### Atomicity and concurrency

Prepare and validate the Codex guidance plan before scaffold writes. Reuse the
initializer's exclusive temporary-file/link creation and atomic rename path.
Immediately before applying a planned append or refresh, compare the current
`AGENTS.md` bytes with the planned input; if they changed concurrently, fail
without overwriting.

### Global npm update

- Parse `update` as a no-argument command.
- Query `npm view graphkeeper@latest version --json` through the fixed process runner.
- Accept only stable `major.minor.patch` versions and compare them numerically.
- If and only if the registry version is newer, invoke
  `npm install --global graphkeeper@<exact-version>` with an argument array and no shell.
- Treat native PowerShell or missing npm as `GK003`; treat registry, parse, timeout,
  permission, and install failures as `GK004`.
- Keep update independent of the current directory and verify repository bytes remain
  unchanged in integration coverage.

## Project Structure

### Feature documentation

```text
specs/001-codex-skill-discovery/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── init-cli.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source changes

```text
src/
├── cli.ts
└── commands/
    └── init.ts
templates/
└── SKILL.md
tests/
├── unit/init-plan.test.ts
├── integration/init-files.test.ts
├── integration/skill-doc.test.ts
├── integration/templates.test.ts
├── e2e/cli-help.test.ts
├── e2e/init.test.ts
└── e2e/package-contents.test.ts
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Managed block planner in init | Existing `AGENTS.md` content must be preserved while providing opt-in session-start awareness | Blind append duplicates blocks; whole-file replacement destroys user guidance; a root `SKILL.md` is not discoverable |
