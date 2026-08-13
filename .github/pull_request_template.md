## Outcome

Describe the user-visible result and the smallest implementation boundary.

## Evidence

List the failing test observed before implementation and the passing commands afterward.

## Checklist

- [ ] Tests cover valid, invalid, and relevant security or performance paths.
- [ ] Documentation and examples reflect every changed public behavior.
- [ ] Schema compatibility is unchanged, additive and documented, or explicitly marked breaking.
- [ ] Constitution principles and append-only/evidence guarantees remain satisfied.
- [ ] `npm run build` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes with no hidden skips.
- [ ] `npm run package:smoke` passes and the tarball contains intended assets only.
- [ ] `sh -n scripts/validate.sh` passes when the legacy fallback changes, and `node --check templates/pre-commit` passes when the hook changes.
- [ ] No secrets, credentials, telemetry, generated archives, or unrelated edits are included.

## Compatibility and recovery

State supported platforms tested, rollback behavior, diagnostic changes, and any
manual recovery a repository owner would need.
