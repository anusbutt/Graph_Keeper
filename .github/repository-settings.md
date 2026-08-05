# Repository settings

These are maintainer-applied settings for the public GraphKeeper repository. This file
documents intent; it does not grant automation permission to mutate repository settings.

## Description

Grounded, auditable, Git-backed memory for coding agents.

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

Require branches to be current before merge, one approving review, resolved
conversations, and linear history. Block force pushes and branch deletion. Apply the
rules to administrators, with emergency bypass limited to repository owners and
followed by a documented incident review.

## Security and access

Grant the CI workflow read-only repository contents permission. Store no publish token
until the release checklist is approved. Enable secret scanning and dependency alerts;
GraphKeeper itself sends no telemetry and uses no hosted runtime service.
