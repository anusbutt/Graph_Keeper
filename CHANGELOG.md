# Changelog

All notable changes to GraphKeeper are documented here. GraphKeeper follows semantic
versioning; while the package is below 1.0, minor releases may change public behavior.

## Unreleased

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
