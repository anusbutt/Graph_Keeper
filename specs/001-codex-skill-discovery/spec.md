# Feature Specification: Codex Skill Discovery

**Feature Branch**: `001-codex-skill-discovery`
**Created**: 2026-08-10
**Status**: Ready for planning
**Input**: Make GraphKeeper memory discoverable to Codex for repositories used
through WSL or Git Bash, preserve existing agent guidance by default, and offer
an explicit safe Codex integration without adding other agent adapters.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover GraphKeeper in Codex (Priority: P1)

As a developer initializing GraphKeeper, I want Codex to discover a
repository-scoped GraphKeeper skill so that a fresh session can retrieve or
record durable memory without being told to open a root guidance file.

**Why this priority**: Automatic discovery is the missing link between valid
GraphKeeper data and reliable cross-session use.

**Independent Test**: Initialize a clean repository, inspect the generated
Codex skill metadata and workflow, and confirm that Codex can identify the
skill by name and description from the repository root or a nested directory.

**Acceptance Scenarios**:

1. **Given** a clean Git repository, **When** the user initializes GraphKeeper,
   **Then** a repository-scoped `graphkeeper` skill is created in Codex's
   recognized project skill location with valid name and description metadata.
2. **Given** the generated skill, **When** Codex loads only skill metadata,
   **Then** the description clearly covers retrieving existing memory, avoiding
   repeated investigation, and recording durable evidence-backed findings.
3. **Given** the generated skill is invoked, **When** Codex reads its body,
   **Then** the workflow requires reading the graph schema, keeps commands inert,
   and preserves append-only correction semantics.

---

### User Story 2 - Adopt Without Damaging Existing Guidance (Priority: P2)

As a maintainer adopting the Codex skill in an existing repository, I want
initialization and upgrades to preserve my graph, evidence, hooks, and agent
instruction files so that adoption cannot silently destroy project knowledge or
contributor guidance.

**Why this priority**: Safe migration is required before the feature can be used
in established repositories.

**Independent Test**: Initialize repositories containing existing GraphKeeper
data, legacy root guidance, `AGENTS.md`, and `CLAUDE.md`; compare every
protected file before and after normal and forced initialization.

**Acceptance Scenarios**:

1. **Given** an existing `AGENTS.md` or `CLAUDE.md`, **When** normal or forced
   initialization runs without an integration request, **Then** those files
   remain byte-for-byte unchanged.
2. **Given** an older GraphKeeper repository with a root `SKILL.md`, **When**
   initialization runs, **Then** the legacy file is preserved and the new
   discoverable Codex skill is added.
3. **Given** a populated graph and evidence directory, **When** initialization
   runs repeatedly, **Then** graph data and evidence remain unchanged and no
   duplicate skill resources are created.
4. **Given** the intended skill destination already has the wrong filesystem
   type, **When** initialization runs, **Then** it fails operationally without
   replacing the destination or protected guidance files.

---

### User Story 3 - Opt Into Always-On Codex Awareness (Priority: P3)

As a repository owner, I want an explicit Codex integration option that adds a
short GraphKeeper activation rule to `AGENTS.md` so that each new Codex session
knows when to invoke the progressively disclosed skill.

**Why this priority**: Skill discovery enables relevant invocation, while an
explicit repository rule provides deterministic session-start awareness for
teams that want it.

**Independent Test**: Run the Codex integration option against missing, existing,
already-managed, and malformed `AGENTS.md` files and verify ownership,
idempotency, preservation, and failure behavior.

**Acceptance Scenarios**:

1. **Given** no `AGENTS.md`, **When** the user explicitly requests Codex
   integration, **Then** GraphKeeper creates one containing only a clearly marked
   managed activation block.
2. **Given** an existing `AGENTS.md` without that block, **When** integration is
   requested, **Then** exactly one managed block is appended and all existing
   content is preserved.
3. **Given** an existing valid managed block, **When** integration is requested
   again, **Then** only GraphKeeper's block may be refreshed and it is not
   duplicated.
4. **Given** incomplete, nested, or repeated GraphKeeper ownership markers,
   **When** integration is requested, **Then** initialization fails with an
   operational diagnostic and leaves `AGENTS.md` unchanged.
5. **Given** a `CLAUDE.md`, **When** Codex integration is requested, **Then**
   `CLAUDE.md` remains byte-for-byte unchanged.

---

### User Story 4 - Update the Global CLI Safely (Priority: P2)

As a developer using a globally installed GraphKeeper, I want one command to check
the npm stable release and install it when newer so that I can stay current without
remembering npm-specific syntax.

**Why this priority**: Early users installed GraphKeeper globally, so a predictable
upgrade path reduces version drift before wider contribution and adoption.

**Independent Test**: Run the update workflow with a fake process runner for newer,
current, older, malformed, offline, missing-npm, and failed-install outcomes; verify
the exact executable arguments and that repository files remain unchanged.

**Acceptance Scenarios**:

1. **Given** npm reports a newer stable GraphKeeper version, **When** the user runs
   `graphkeeper update`, **Then** GraphKeeper installs that exact version globally
   and reports the old and new versions.
2. **Given** npm reports the installed version or an older version, **When** update
   runs, **Then** it succeeds without invoking installation.
3. **Given** npm is missing or the runtime is native PowerShell, **When** update runs,
   **Then** it fails with `GK003` before an install attempt.
4. **Given** registry lookup, version parsing, or global installation fails, **When**
   update runs, **Then** it returns `GK004`, reports a recovery-oriented message,
   and does not alter repository files.
5. **Given** any update argument, **When** the CLI parses it, **Then** it returns
   `GK002` without registry access or installation.

### Edge Cases

- The repository path contains spaces or non-ASCII characters.
- Initialization is launched from a nested repository directory.
- The discoverable skill appears concurrently while initialization is running.
- `AGENTS.md` has CRLF endings, no final newline, or unrelated HTML comments.
- The user combines forced refresh with explicit Codex integration.
- The user requests an unsupported integration target or repeats a CLI option.
- Initialization runs outside Git, where hook enforcement is unavailable.
- The npm registry is unavailable, returns malformed output, or reports a version
  older than the running development build.
- Global installation lacks filesystem permission.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Default initialization MUST create a repository-scoped GraphKeeper
  skill that Codex can discover from the project.
- **FR-002**: The generated skill MUST contain valid `name` and `description`
  metadata and a non-empty workflow body.
- **FR-003**: The skill description MUST cover both retrieval and recording
  triggers while remaining concise enough for progressive disclosure.
- **FR-004**: The skill workflow MUST direct Codex to the repository graph schema
  and preserve GraphKeeper's provenance, inert-command, and append-only rules.
- **FR-005**: Default and forced initialization MUST NOT create, modify, or delete
  `AGENTS.md` or `CLAUDE.md` unless Codex integration is explicitly requested.
- **FR-006**: Initialization MUST preserve an existing root `SKILL.md` as legacy
  guidance and MUST NOT create that legacy file in a clean new repository.
- **FR-007**: The CLI MUST accept an explicit Codex integration request, alone or
  together with forced documentation refresh, and MUST reject unknown targets,
  duplicate flags, and malformed argument combinations as usage errors.
- **FR-008**: Explicit Codex integration MUST create or update exactly one
  GraphKeeper-owned block in `AGENTS.md` while preserving all unowned content.
- **FR-009**: GraphKeeper MUST recognize its block through unambiguous start and
  end markers and MUST fail without writing when marker ownership is malformed.
- **FR-010**: Repeated initialization and integration MUST be idempotent.
- **FR-011**: Initialization MUST report skill and Codex guidance actions as
  create, refresh, skip, or warning outcomes consistent with existing reporting.
- **FR-012**: Existing graph records, evidence, validators, hooks, and unsupported
  agent guidance MUST retain their current safety and lifecycle guarantees.
- **FR-013**: The installed npm package MUST include every template required to
  initialize the discoverable skill.
- **FR-014**: User documentation MUST describe Codex, WSL, and Git Bash as the
  initial supported integration and execution surfaces.
- **FR-015**: The CLI MUST expose `graphkeeper update` with no accepted arguments.
- **FR-016**: Update MUST query npm for the stable `latest` GraphKeeper version.
- **FR-017**: Update MUST install only when the registry version is newer and MUST
  install the exact resolved version globally without invoking a shell.
- **FR-018**: Update MUST accept only stable `major.minor.patch` semantic versions
  and MUST reject malformed or prerelease registry output.
- **FR-019**: Update MUST NOT read, create, or modify repository graph, evidence,
  guidance, hook, or package manifest files.
- **FR-020**: Missing npm or an unsupported native PowerShell runtime MUST return
  `GK003`; lookup, parse, timeout, permission, or install failures MUST return `GK004`.
- **FR-021**: Current, ahead, and successfully updated outcomes MUST be distinct and
  human-readable while retaining stable exit-code behavior.

## Assumptions

- Codex recognizes repository skills under
  `.agents/skills/<skill-name>/SKILL.md` and uses `name` and `description`
  metadata for discovery.
- Full skill instructions are progressively loaded after explicit or implicit
  invocation rather than injected into every session.
- `AGENTS.md` is the Codex session-start instruction mechanism.
- Codex integration uses an explicit option; default initialization remains
  non-invasive toward existing agent instruction files.

## Out of Scope

- Claude, Gemini, Cursor, Aider, or other agent adapters.
- Modifying `CLAUDE.md`.
- Native PowerShell runtime support.
- A server, database, dashboard, telemetry, or cross-repository memory.
- Automatic package publication.
- Updating local project dependencies, supporting non-npm package managers, or
  installing prerelease versions.
- Automatic deletion or rewriting of legacy root `SKILL.md` files.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every clean initialization produces one discoverable GraphKeeper
  skill whose metadata and body pass automated structural validation.
- **SC-002**: In all preservation tests, existing graph data, evidence,
  `AGENTS.md`, `CLAUDE.md`, hooks, and legacy guidance retain 100% of
  unowned content.
- **SC-003**: Ten consecutive initialization or integration runs produce no
  duplicate skill or managed guidance blocks.
- **SC-004**: Every malformed marker and unsupported CLI-input case is rejected
  before a protected instruction file is changed.
- **SC-005**: A fresh Codex session can discover the `graphkeeper` skill without
  being told to read a root `SKILL.md`.
- **SC-006**: Existing functional, security, performance, and package release
  gates continue to pass within their documented budgets.
- **SC-007**: Update tests cover 100% of comparison outcomes and failure boundaries,
  and every install assertion uses the exact argument array with shell execution off.
