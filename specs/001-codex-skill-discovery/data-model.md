# Data Model: Codex Skill Discovery

This feature adds initialization planning state only. It does not change the
GraphKeeper entity, claim, run, or evidence schemas.

## Init request

| Field | Type | Rules |
|-------|------|-------|
| `force` | boolean | Refresh generated documentation and the discoverable skill |
| `integrateCodex` | boolean | Plan and apply one managed `AGENTS.md` block |

## Scaffold target

| Field | Type | Rules |
|-------|------|-------|
| `target` | repository-relative path | Must pass repository containment checks |
| `source` | package-relative asset path | Required for file targets |
| `refreshable` | boolean | Data, evidence, and validator remain non-refreshable |

## Codex guidance plan

| Variant | Required state | Result |
|---------|----------------|--------|
| `create` | `AGENTS.md` missing | Create only the managed block |
| `append` | File exists with no ownership markers | Preserve bytes and append one block |
| `refresh` | Exactly one valid marker pair | Replace only the owned span |
| `skip` | Existing owned span already matches | No write |

Every write variant retains the originally observed file content so the apply
phase can reject concurrent changes.

## Marker state transitions

```text
missing file ──integrate──> one valid managed block
no markers   ──integrate──> original content + one valid managed block
valid pair   ──integrate──> same unowned content + refreshed managed block
malformed    ──integrate──> operational failure; no write
```

Malformed includes a missing peer, more than one occurrence of either marker,
reversed order, or an additional marker inside the owned span.

## Update request and result

The update request has no user options. Internal execution receives the running
version, platform environment, and a fixed process runner for deterministic tests.

| Result | Condition | Mutation |
|--------|-----------|----------|
| `current` | Registry version equals running version | None |
| `ahead` | Registry version is older than running version | None |
| `updated` | Registry version is newer and exact global install succeeds | Global npm package only |

Both running and registry versions must be stable `major.minor.patch` values. No
repository path or record participates in this state machine.
