# Repository settings

These are maintainer-applied settings for the public GraphKeeper repository. This file
documents intent; it does not grant automation permission to mutate repository settings.

## Description

Grounded, auditable, Git-backed memory for coding agents.

## Website

`https://www.npmjs.com/package/graphkeeper`

## Topics

`ai-agents`, `developer-tools`, `git`, `knowledge-graph`, `memory`, `provenance`,
`typescript`, `validation`

## Default branch

The Default branch is `main`. Delete merged topic branches automatically and prefer
squash merging so each pull request has one reviewable integration commit.

## Labels

| Label | Purpose |
|---|---|
| `type:bug` | Reproducible incorrect behavior |
| `type:feature` | New user-visible capability |
| `type:docs` | Documentation-only improvement |
| `area:cli` | Command dispatch or output |
| `area:validator` | Canonical jq/sh validation |
| `area:doctor` | Deep evidence or graph inspection |
| `area:templates` | Shipped schema or agent guidance |
| `area:ci` | Automation, packaging, or platform support |
| `breaking-schema` | Incompatible record interpretation |
| `good first issue` | Bounded work with explicit acceptance checks |

## Branch protection and required status checks

Protect `main` with these required status checks:

- `quality-ubuntu`
- `quality-macos`
- `quality-windows-git-bash`
- `performance-ubuntu`
- `performance-windows-git-bash`

Require every change to use a pull request, including maintainer changes. Required
approvals are `0` while GraphKeeper has one maintainer because pull-request authors
cannot approve their own work. Require branches to be current before manual merge,
all status checks to pass, resolved conversations, and linear history. Disable
auto-merge, force pushes, and branch deletion, and apply the rules to administrators.
The repository owner remains the only account with merge permission. When a second
trusted maintainer receives write access, require at least one approval from someone
other than the pull-request author.

## Security and access

Grant the CI workflow read-only repository contents permission. Store no publish token
until the release checklist is approved. Enable private vulnerability reporting,
secret scanning, and dependency alerts; GraphKeeper itself sends no telemetry and uses
no hosted runtime service.
