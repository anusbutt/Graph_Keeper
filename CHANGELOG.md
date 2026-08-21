# Changelog

All notable changes to GraphKeeper are documented here. GraphKeeper follows semantic
versioning; while the package is below 1.0, minor releases may change public behavior.

## [Unreleased]

### Added

- A Cursor adapter registered as `--integrate cursor` with the canonical skill at
  `.cursor/skills/graphkeeper/SKILL.md`, the marked reminder at
  `.cursor/rules/graphkeeper.md`, and the `@graphkeeper` invocation. It participates in
  `--integrate all`, `--dry-run`, and conservative `integrate remove`.
- An OpenCode adapter registered as `--integrate opencode` with the canonical skill at
  `.opencode/skills/graphkeeper/SKILL.md`, the marked reminder in `AGENTS.md`, and the
  `graphkeeper` invocation. It participates in `--integrate all`, `--dry-run`, and
  conservative `integrate remove`.
- A Kilo Code adapter registered as `--integrate kilo` with the canonical skill at
  `.kilo/skills/graphkeeper/SKILL.md`, the marked reminder at
  `.kilo/rules/graphkeeper.md`, and the `@graphkeeper` invocation. It participates in
  `--integrate all`, `--dry-run`, and conservative `integrate remove`.
- A Windsurf adapter registered as `--integrate windsurf` with the canonical skill at
  `.windsurf/skills/graphkeeper/SKILL.md`, the marked reminder at
  `.windsurf/rules/graphkeeper.md`, and the `@graphkeeper` invocation. It participates in
  `--integrate all`, `--dry-run`, and conservative `integrate remove`.
- A Gemini CLI adapter registered as `--integrate geminicli` with the canonical skill at
  `.gemini/skills/graphkeeper/SKILL.md`, the marked reminder in `GEMINI.md`, and the
  `@graphkeeper` invocation. It participates in `--integrate all`, `--dry-run`, and
  conservative `integrate remove`.
- A Kiro adapter registered as `--integrate kiro` with the canonical skill at
  `.kiro/skills/graphkeeper/SKILL.md`, the marked reminder at `.kiro/steering/graphkeeper.md`,
  and the `/graphkeeper` invocation. It participates in `--integrate all`, `--dry-run`, and
  conservative `integrate remove`.
- An Antigravity adapter registered as `--integrate antigravity` with the canonical skill at
  `.agents/skills/graphkeeper/SKILL.md` (shared with Codex), the marked reminder at
  `.agents/rules/graphkeeper.md`, and the `graphkeeper` invocation. It participates in
  `--integrate all`, `--dry-run`, and conservative `integrate remove`; because the skill path
  is shared with Codex, removal is owner-scoped so removing Antigravity preserves the
  Codex-owned skill directory.

### Changed

- Agent adapters are now a closed, data-driven registry. Adding an adapter is a single
  entry in `src/lib/agent-adapters.ts`; the CLI `--integrate` grammar, the
  `--integrate all` expansion, and removal machinery all derive from it, and `AgentId`
  is derived from the registry instead of a hardcoded union.
- The `init` skill-scaffolding special case is expressed as adapter data
  (`scaffoldSkillByInit`) instead of a hardcoded agent id.
- Multiple registered adapters may now share one guidance file. Codex and OpenCode both
  use `AGENTS.md`; each owns one marked block, sibling blocks are allowed when properly
  paired, and unknown or malformed markers are still rejected with `GK004`. Installing
  adapters that share a file in one plan (for example `--integrate all`) appends each
  block sequentially.

## [0.4.1] - 2026-08-14

### Added

- The post-fix GraphKeeper Memory Bench #1 result, recording a PASS for grounded
  memory reuse with bounded current-state verification and the progression
  FAIL → fix → FAIL → fix → PASS.

### Changed

- Canonical agent guidance now requires querying active GraphKeeper claims and
  inspecting their provenance before repeating repository investigation, while
  preserving explicit evidence checks instead of treating memory as automatically
  true.
- Minimum freshness verification now has a concrete stopping rule: reuse grounded
  historical evidence, inspect only relevant current state by default, avoid
  reconfirming it through Git history, broad searches, or unnecessary tests, and
  stop once current state is consistent and no contradiction is found.

## [0.4.0] - 2026-08-14

### Added

- Native Windows PowerShell support for init, check, query, doctor, update, and the
  Node pre-commit hook without normal sh or jq prerequisites.
- A native PowerShell CI acceptance lane covering the installed Windows command shim,
  package journeys, and real valid/invalid Git commits.

### Changed

- Query active-claim selection and stable ordering now run in TypeScript instead of
  jq. Initialization requires only Node.js 18+ and Git; update launches npm's
  JavaScript CLI directly through Node on Windows.
- The generated Node validator and rule-free Node hook are the normal cross-platform
  path. The shell validator remains a conservative compatibility fallback for
  customized or unmigrated repositories.

### Migration

- Existing repositories should rerun `graphkeeper init --force` after upgrading so
  package-owned guidance, validators, and hooks can refresh or migrate to Node.
  Customized `validate.sh` or hook files are preserved for manual review and can
  still require a POSIX shell and jq until migrated.

## [0.3.0] - 2026-08-13

### Added

- GraphKeeper Memory Bench v0.1 definitions for repeated investigation, stale memory,
  provenance, and correction history.
- Public contributor guidance, governance documentation, and clearer proof-oriented
  product positioning.

### Changed

- Claims now represent one independently changeable fact. Agent guidance splits
  compound findings and records directly observed facts separately from interpretations.
- Inference sources require a non-empty `basis`, and inference claims cannot use
  `confidence: 1`. The TypeScript parser and canonical shell validator enforce the
  same boundary with the existing `GK120` diagnostic.
- `confidence: 1` is documented for directly evidenced, non-inference claims only
  when the evidence fully supports the exact claim.

### Migration

- Before adopting the new validator, inspect existing committed inference claims.
  Claims without a basis or with `confidence: 1` are rejected by 0.3.0, and committed
  claims must not be edited in place; repositories containing those legacy shapes
  require an explicit migration decision.
- After updating the npm installation, existing repositories should run
  `graphkeeper init --force` to refresh generated skill and schema documentation.
  Review and replace the repository-local `scripts/validate.sh` separately because
  initialization intentionally preserves that enforcement file.

## [0.2.0] - 2026-08-12

### Added

- Explicit internal Codex and Claude Code adapters generated from one canonical skill
  template, including independent marked guidance blocks.
- Multi-adapter `init --integrate`, `--integrate all`, confirmed and non-interactive
  `--yes` operation, complete `--dry-run` preflight, and conservative
  `integrate remove`.

### Changed

- `init --integrate codex` now discloses an immutable plan and requires confirmation;
  non-interactive callers must pass `--yes`. `--yes --dry-run` is accepted and
  remains read-only.

### Security

- Agent integration rejects malformed or mixed markers, wrong-type and symlinked
  destinations, and post-approval concurrent changes. Removal preserves modified
  skills and unexpected files rather than deleting contributor work.

## [0.1.3] - 2026-08-11

### Added

- Canonical npm repository, homepage, issue-tracker, and discovery metadata.
- README installation guidance, package/CI status badges, and public support and
  security-reporting paths.
- Contributor architecture guidance covering command flow, extension points,
  platform boundaries, recovery, and release governance.
- Parser-parity and documentation-contract tests that keep the TypeScript readers,
  shell validator, and contributor guidance aligned.

### Fixed

- Preserve LF line endings for shell assets packaged from Windows so they remain
  executable in supported POSIX shells.
- Canonicalize temporary repository paths in cross-platform tests.
- Run documented contributor onboarding from a clean npm installation in WSL instead
  of linking Windows-installed dependencies.
- Serialize package end-to-end tests so concurrent `npm pack` builds cannot rewrite
  shared output during verification.

### Changed

- The canonical default branch is `main`, protected by required Linux, macOS, and
  Windows/Git Bash quality checks plus isolated performance checks.
- Repository-local planning artifacts and development-only `.codex` state are excluded
  from version control and npm packages.
- Solo-maintainer pull requests require passing checks and manual merge but no separate
  approval; the policy calls for peer approval when another trusted maintainer gains
  write access.
