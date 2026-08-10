# GraphKeeper contributor guide

This file is the canonical repository guidance for coding agents and human
contributors. `CLAUDE.md` is a short Claude-specific entry point; keep both files
consistent when contributor-facing rules change.

## Project shape

GraphKeeper is a repository-local, JSON-backed memory tool for coding agents. The
runtime is a Node.js ESM CLI in `src/`, with the canonical shell validator in
`scripts/validate.sh`. Templates live in `templates/`, generic demonstrations live
in `examples/`, and automated coverage lives in `tests/`.

The v1 product deliberately has no server, database, authentication, telemetry,
dashboard, vector search, or multi-repository synchronization. Do not add those
boundaries without an explicit architecture decision.

## Prerequisites and platform

- Node.js 18 or newer and npm
- Git
- POSIX-compatible `sh`
- jq 1.6 or newer

Linux and macOS are supported directly. Windows contributors must use WSL or Git
Bash. Native PowerShell is not a supported runtime for GraphKeeper v1.

## Development workflow

From the repository root:

```sh
npm ci
npm run typecheck
npm test
```

Useful focused gates are:

```sh
npm run test:functional
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:security
npm run test:performance
npm run package:smoke
```

Run the smallest relevant focused test while developing, then run the complete
suite before submitting. Tests must cover both the accepted behavior and the
rejection boundary for a new invariant. Keep performance tests isolated from
concurrent packaging/build work.

## Data and safety rules

GraphKeeper stores entities, claims, and runs under `graph/`, with captured artifacts
under `evidence/`. Claims and committed evidence are append-only. Corrections append
a new claim using `supersedes`; they do not rewrite an old claim. Tool commands and
evidence contents are data only and must never be executed.

Use the public CLI to exercise behavior:

```sh
node dist/src/cli.js init
node dist/src/cli.js check
node dist/src/cli.js query <subject>
node dist/src/cli.js doctor
```

The fast validator and `graphkeeper check` must remain aligned with the hook. Deep
file and line-range checks belong in `graphkeeper doctor`. Preserve stable `GKnnn`
diagnostics and exit-code behavior when changing validation.

## Change boundaries

- Prefer small, focused changes with tests and documentation.
- Keep claims flat, generic, diffable, and vendor-neutral.
- Do not add secrets, credentials, generated `dist/` output, `node_modules/`, or
  package tarballs to Git.
- Do not silently change package identity, public commands, schema fields, or
  append-only semantics.
- Do not recreate removed Spec-Kit planning/history directories in the product tree.
- Update `README.md`, `CONTRIBUTING.md`, and examples when user-facing behavior
  changes.

## Packaging and release

The package is ESM, uses npm, targets Node.js >=18, and starts at version 0.1.0.
`npm run package:smoke` must pass, and the tarball must contain only runtime assets,
templates, examples, documentation, and the license. Recheck package-name
availability and run the release checklist before publication. Never publish from a
test or contributor workflow automatically.

`npm run release:verify` is the deterministic publish gate: typecheck, functional
and security tests, and package smoke. Performance benchmarks remain mandatory in
their dedicated CI jobs and release-checklist step, but are isolated from
`prepublishOnly` so temporary machine load cannot make publication nondeterministic.

## Review checklist

Before opening a pull request, confirm:

1. The change has focused tests and `npm test` passes.
2. Security-sensitive paths, commands, and evidence remain inert and contained.
3. Documentation and examples describe the resulting behavior.
4. The v1 scope and JSON/Git source-of-truth boundaries remain intact.
5. The working tree contains no generated or secret files.
