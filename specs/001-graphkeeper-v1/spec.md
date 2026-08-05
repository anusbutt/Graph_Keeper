# Feature Specification: GraphKeeper v1

**Feature Branch**: '001-graphkeeper-v1'  
**Created**: 2026-08-04  
**Status**: Approved for technical planning  
**Input**: User description: now start writing spec. cover all US and edge cases.

## Problem Statement

Coding agents lose durable context between sessions and tools. Developers can recover
some context by rereading transcripts, logs, and previous changes, but that process is
slow, incomplete, and difficult to verify. Existing memory systems commonly require a
specific agent framework, database, hosted service, or opaque retrieval layer.

GraphKeeper v1 gives a repository a small, portable memory graph whose factual claims
are tied to captured evidence, whose history is auditable in Git, and whose integrity
is checked automatically. It separates durable, reviewable findings from ordinary
session notes and agent chatter.

## Target Users

- Developers using coding agents such as Claude Code, Codex, OpenCode, Aider, or
  Cursor who need reliable memory across sessions or tools.
- Teams that need to audit why an agent or developer believes a repository fact.
- Agents that need explicit rules for recording durable findings.
- Reviewers who must approve only statements supported by evidence.
- Contributors extending GraphKeeper with new queries, agent adapters, validation
  rules, examples, or future storage backends.

## User Scenarios & Testing

### User Story 1 - Initialize Grounded Memory (Priority: P1)

As a developer, I want to run one command to scaffold grounded memory into my
repository, so that an agent can begin recording auditable findings immediately.

**Why this priority**: No other journey is available until a repository has a safe,
understandable memory store.

**Independent Test**: Run 'npx graphkeeper init' in a representative repository and
verify that the user receives a usable, documented, enforcement-ready memory store
without installing a database.

**Acceptance Scenarios**:

1. **Given** a Git repository with the required prerequisites and no GraphKeeper data,
   **When** the developer runs initialization, **Then** the memory files,
   agent instructions, schema documentation, evidence location, and validation hook
   are prepared and the command explains what changed.
2. **Given** a repository already containing GraphKeeper data, **When** initialization
   runs again, **Then** existing graph data and evidence remain unchanged and skipped
   items are reported.
3. **Given** existing GraphKeeper data, **When** the developer requests a forced
   refresh, **Then** only generated template documentation is refreshed and graph data
   and evidence remain unchanged.
4. **Given** a directory that is not yet a Git repository, **When** initialization
   runs, **Then** files are scaffolded and the developer receives a prominent warning
   that enforcement is disabled until Git is initialized and the hook is installed.
5. **Given** an existing non-GraphKeeper pre-commit hook, **When** initialization runs,
   **Then** the existing hook is not overwritten and the developer receives precise
   chaining instructions.
6. **Given** a configured custom Git hook directory, **When** initialization runs,
   **Then** that configuration is respected and the same no-overwrite rule applies.
7. **Given** a missing hard prerequisite, **When** initialization begins, **Then** it
   exits without partially changing the repository and identifies the missing
   prerequisite with a clear installation link.

---

### User Story 2 - Record a Grounded Finding (Priority: P1)

As an agent, I want clear written rules for recording a claim with a real source, so
that durable memory is factual, inspectable, and reusable by another agent.

**Why this priority**: Grounded claims are the product's core unit of value.

**Independent Test**: Give the shipped agent instructions to an agent, captured
evidence, and an empty valid graph; verify that it creates a conforming entity, run,
and claim without duplicating an existing entity or treating its own prose as proof.

**Acceptance Scenarios**:

1. **Given** captured command output, **When** an agent records a factual claim,
   **Then** the claim includes the command, integer exit code, capture timestamp, and
   canonical evidence line reference.
2. **Given** reasoning without external evidence, **When** an agent records it,
   **Then** the source is marked as inference and may include a short basis but does
   not include tool-output fields.
3. **Given** an existing entity ID or alias for the subject, **When** an agent records
   a claim, **Then** it reuses that entity rather than creating a duplicate.
4. **Given** a new subject with no matching entity or alias, **When** an agent records
   the finding, **Then** it creates a generic, human-readable entity before referencing
   it from the claim.
5. **Given** structured diagnostic detail, **When** an agent records the finding,
   **Then** the claim remains flat and concise while the detail remains in evidence.
6. **Given** session chatter, an abandoned hypothesis, or an unverified dead end,
   **When** the agent decides what to retain, **Then** that material remains in normal
   progress notes and is not presented as a grounded graph fact.

---

### User Story 3 - Block Invalid History at Commit (Priority: P1)

As a developer, I want a commit blocked automatically when graph data violates its
contract, so that invalid or rewritten memory cannot enter repository history.

**Why this priority**: Documentation alone cannot guarantee trustworthy memory.

**Independent Test**: Stage isolated valid and invalid graph changes and verify that
valid changes pass while every mechanically invalid fixture is rejected with an
actionable explanation.

**Acceptance Scenarios**:

1. **Given** a valid new entity, run, claim, and evidence file, **When** the developer
   commits, **Then** validation succeeds.
2. **Given** a claim missing a required field or using the wrong source fields,
   **When** the developer commits, **Then** the commit is blocked and the exact claim
   and rule are identified.
3. **Given** duplicate claim IDs or a subject absent from the entity set, **When** the
   developer commits, **Then** the commit is blocked.
4. **Given** a missing supersession target, a second direct correction of the same
   claim, or a supersession cycle, **When** the developer commits, **Then** the commit
   is blocked with the conflicting IDs.
5. **Given** a committed claim that is edited or removed, **When** the developer
   commits, **Then** the commit is blocked even if the resulting JSON remains valid.
6. **Given** only whitespace, indentation, or object-key ordering changes,
   **When** the developer commits, **Then** those changes are not misclassified as a
   historical claim edit.
7. **Given** a committed evidence file that is edited, renamed, or removed, **When**
   the developer commits, **Then** the commit is blocked and the affected path is
   identified.
8. **Given** an entity identity change, alias removal, invalid run transition, or
   closed-run mutation, **When** the developer commits, **Then** the commit is blocked.
9. **Given** a malformed or unsafe evidence reference, **When** the developer commits,
   **Then** the commit is blocked without executing the reference or opening its
   target.
10. **Given** a repository without an existing 'HEAD', **When** the first commit is
    attempted, **Then** schema and internal-consistency checks run while historical
    comparisons are skipped.

---

### User Story 4 - Ask Why We Know Something (Priority: P1)

As a developer, I want to ask why or how we know something about a subject, so that I
receive current sourced claims without rereading old sessions.

**Why this priority**: Fast retrieval turns stored records into useful memory.

**Independent Test**: Query a populated graph by an entity ID and an alias and verify
that only active claims and their source information are returned.

**Acceptance Scenarios**:

1. **Given** an entity with active claims, **When** the developer runs
   'graphkeeper query <subject>', **Then** the result identifies each claim, predicate,
   object, source kind, producer, timestamp, and evidence reference when applicable.
2. **Given** a claim that has been superseded, **When** the subject is queried,
   **Then** the obsolete claim is excluded from the default result.
3. **Given** an exact unique alias, **When** it is queried, **Then** it resolves to the
   canonical entity and returns the same active claims.
4. **Given** an alias shared by multiple entities, **When** it is queried, **Then** no
   entity is guessed and the result lists the matching entity IDs.
5. **Given** an unknown subject or alias, **When** it is queried, **Then** the command
   reports that no entity was found and does not return unrelated claims.
6. **Given** only inference-sourced active claims, **When** the subject is queried,
   **Then** those claims are visibly distinguished from externally grounded claims.

---

### User Story 5 - Diagnose Graph Health (Priority: P1)

As a developer, I want a deeper health check, so that references which are too
expensive to inspect during every commit are still verifiable on demand.

**Why this priority**: Fast commit checks intentionally do not prove that referenced
files and line ranges exist.

**Independent Test**: Run 'graphkeeper doctor' against fixtures containing valid,
missing, unsafe, reversed, zero-based, and out-of-bounds references and compare the
reported findings with expected results.

**Acceptance Scenarios**:

1. **Given** a valid graph and line-addressable evidence, **When** the doctor runs,
   **Then** it reports a healthy graph and returns success.
2. **Given** a referenced file that is missing, outside 'evidence/', or not
   line-addressable text, **When** the doctor runs, **Then** it reports an integrity
   error and returns failure.
3. **Given** a range whose start is below one, exceeds its end, or exceeds the file's
   line count, **When** the doctor runs, **Then** it reports the claim, reference, and
   precise range problem.
4. **Given** dangling graph references, **When** the doctor runs, **Then** it reports
   every affected record rather than stopping after the first.
5. **Given** an entity that no claim uses, **When** the doctor runs, **Then** it reports
   a warning without treating the structurally valid graph as corrupt.
6. **Given** both errors and warnings, **When** the doctor completes, **Then** it
   presents separate counts and returns failure because errors exist.

---

### User Story 6 - Correct a Durable Claim (Priority: P1)

As an agent or developer, I want to correct a previous finding without erasing it, so
that readers see the current truth and auditors retain the full reasoning history.

**Why this priority**: Durable memory must support learning without rewriting history.

**Independent Test**: Append one valid correction to an existing claim and verify that
the old claim remains stored, the new claim is active, and a second competing
correction is rejected.

**Acceptance Scenarios**:

1. **Given** an active claim later shown to be wrong, **When** a sourced correction is
   appended with 'supersedes', **Then** the old claim remains unchanged and the new
   claim becomes active.
2. **Given** an already superseded claim, **When** another claim attempts to supersede
   that same claim directly, **Then** the change is rejected as a fork.
3. **Given** a chain of corrections, **When** the latest active claim is corrected,
   **Then** the new claim extends the chain without changing earlier claims.
4. **Given** a proposed correction that creates a cycle, **When** it is validated,
   **Then** it is rejected and the cycle members are identified.

---

### User Story 7 - Track Runs and Evidence (Priority: P2)

As an agent operator, I want findings tied to the run and raw output that produced
them, so that another person can reconstruct their provenance.

**Why this priority**: Claims can deliver basic value alone, but run-level provenance
improves auditing and debugging.

**Independent Test**: Open a run, add evidence and claims, close it once, then verify
that further changes are rejected.

**Acceptance Scenarios**:

1. **Given** a new agent session, **When** its run is opened, **Then** it has a unique
   run ID, start timestamp, and tool identity.
2. **Given** an open run, **When** it captures evidence or produces claims, **Then**
   those references may be added without removing earlier entries.
3. **Given** completed work, **When** the run is closed, **Then** it receives an end
   timestamp and exactly one allowed verdict.
4. **Given** interrupted work, **When** the run is closed, **Then** it may use
   'aborted' or 'inconclusive' without inventing successful claims.
5. **Given** a closed run, **When** any field or set is changed, **Then** the change is
   rejected.

---

### User Story 8 - Review Only Grounded Statements (Priority: P2)

As a reviewer, I want a reusable grounded-checker prompt, so that approvals identify
supporting claims and unsupported factual statements are sent back for revision.

**Why this priority**: The reviewer pattern demonstrates how trustworthy memory should
affect agent behavior beyond storage.

**Independent Test**: Give the reviewer example supported facts, inference-only facts,
and unsupported facts; verify that it cites claim IDs only for supported approvals and
returns 'REVISE' for the others.

**Acceptance Scenarios**:

1. **Given** a factual statement supported by an active tool-output claim, **When** the
   reviewer approves it, **Then** the response cites that claim ID.
2. **Given** a statement supported only by inference, **When** the reviewer evaluates
   it as fact, **Then** it returns 'REVISE' and requests external evidence.
3. **Given** no matching active claim, **When** the reviewer evaluates the statement,
   **Then** it returns 'REVISE' and names the unsupported statement.
4. **Given** only a superseded supporting claim, **When** the reviewer evaluates the
   statement, **Then** it does not treat that claim as current support.

---

### User Story 9 - Extend a Small Codebase (Priority: P2)

As a contributor, I want a small, clearly documented project, so that I can add query
recipes, agent adapters, validation improvements, or a future storage backend safely.

**Why this priority**: Contribution readiness sustains the open-source project but is
not required for the first grounded-memory workflow.

**Independent Test**: A new contributor follows the contribution guide, runs the
project checks, identifies extension boundaries, and completes a small example change
without private knowledge from the original author.

**Acceptance Scenarios**:

1. **Given** a new contributor, **When** they read the repository documentation,
   **Then** scope, prerequisites, quality gates, contribution expectations, and
   extension points are clear.
2. **Given** a proposed database backend, **When** the contributor reviews v1 scope,
   **Then** it is clearly identified as future work rather than a v1 requirement.
3. **Given** a new validation rule, **When** it is proposed, **Then** the contributor
   can identify the canonical validator and the required passing and rejecting tests.
4. **Given** a supported change, **When** a pull request is opened, **Then** automated
   checks provide an unambiguous pass or fail result.

## Edge Cases

### Initialization and Environment

- Initialization runs in an empty Git repository with no 'HEAD'.
- Initialization runs outside Git and cannot install enforcement.
- Initialization runs repeatedly against complete or partially present scaffolding.
- Data files exist but generated documentation is missing, or the reverse.
- A forced refresh encounters locally customized template documentation.
- The default hook path already contains a non-GraphKeeper hook.
- A custom hook path is absolute, relative to the repository, or currently missing.
- The selected hook destination is not writable.
- 'jq', Git, a POSIX shell, or a supported Node.js runtime is missing.
- The user invokes the CLI from native PowerShell rather than WSL or Git Bash.
- Initialization is interrupted after prerequisite checks but before completion.

### Graph Records

- A JSON file is empty, malformed, has the wrong top-level type, or contains duplicate
  object keys.
- Two agents independently generate the same random claim ID.
- Entity IDs differ only by case, or aliases collide across entities.
- An aliases or source-doc set contains duplicates.
- A claim subject is an alias instead of the required canonical entity ID.
- A claim object happens to equal an entity ID; it remains valid without being forced
  to act as a relationship.
- Confidence is absent, zero, one, outside the allowed range, or not numeric.
- A timestamp has an offset, fractional seconds, date-only form, or invalid calendar
  value instead of the required UTC form.
- A tool-output source omits a field, has a non-integer exit code, or includes an
  unknown field.
- An inference includes forbidden tool-output fields or has a non-string basis.
- A claim references a run that does not exist.

### Evidence

- A reference contains whitespace, '#', a nested directory, or a traversal segment.
- A reference matches the basic shape but uses line zero, a reversed range, or a range
  beyond the file.
- The evidence file is empty, binary, unreadable, or uses CRLF line endings.
- A claim and its new evidence file are staged together.
- A referenced evidence file exists in the working tree but is not part of the
  repository state being evaluated.
- A committed evidence file is renamed, including a case-only rename.
- Two claims cite overlapping ranges in the same evidence file; this is valid.

### History and Concurrency

- A claim is removed and recreated with the same ID but different values.
- An old claim is unchanged semantically but the JSON file is reformatted.
- Two staged claims supersede the same active claim.
- A supersession chain spans many claims or attempts a self-cycle.
- Two agents append concurrently and produce a merge conflict.
- An open run is created and closed in one change.
- An open run remains open across commits.
- A closed run's arrays are reordered or receive new entries.

### Query and Diagnosis

- A query uses a canonical ID, a unique alias, an ambiguous alias, or unknown text.
- A subject exists but has no active claims.
- Every claim for a subject has been superseded except the end of one correction chain.
- Active results contain a mix of tool-output and inference sources.
- Doctor encounters several errors and warnings in one run.
- Logical line counting must remain consistent across LF and CRLF text.

## Requirements

### Functional Requirements

#### Initialization and Safety

- **FR-001**: The product MUST provide 'graphkeeper init' as a single onboarding
  command invocable through 'npx graphkeeper init'.
- **FR-002**: Initialization MUST create the documented graph, evidence, instruction,
  schema, and enforcement assets needed for a usable memory store.
- **FR-003**: Initialization MUST check all hard prerequisites before changing files.
- **FR-004**: Initialization MUST be idempotent and MUST preserve existing graph data
  and evidence.
- **FR-005**: A force option MUST refresh only generated template documentation.
- **FR-006**: Initialization MUST scaffold a non-Git directory while clearly warning
  that enforcement is disabled.
- **FR-007**: Initialization MUST respect custom Git hook configuration.
- **FR-008**: Initialization MUST NOT overwrite a non-GraphKeeper hook and MUST provide
  actionable chaining instructions when a collision occurs.
- **FR-009**: Every failed or skipped initialization action MUST identify its reason
  and leave existing user data recoverable.

#### Claims, Entities, Runs, and Evidence

- **FR-010**: Each claim MUST contain an ID, subject, predicate, object, source,
  producing run ID, and creation timestamp.
- **FR-011**: Claim IDs MUST match 'claim_' plus eight lowercase hexadecimal
  characters and MUST be unique.
- **FR-012**: Claim subjects MUST resolve to canonical entity IDs.
- **FR-013**: Claim predicates and objects MUST be flat strings; nested claim objects
  MUST be rejected.
- **FR-014**: Optional confidence MUST be numeric from 0 through 1 inclusive.
- **FR-015**: A tool-output source MUST contain only its kind plus command, integer
  exit code, reference, and capture timestamp.
- **FR-016**: An inference source MUST contain its kind and MAY contain a string basis;
  tool-output fields on an inference MUST be rejected.
- **FR-017**: Evidence references MUST follow
  'evidence/<filename>#L<start>-L<end>' and MUST reject unsafe path segments.
- **FR-018**: Entity IDs MUST be unique lowercase snake-case slugs.
- **FR-019**: Entity identity fields MUST remain immutable after commit.
- **FR-020**: Entity aliases and source-document references MAY only gain unique
  entries.
- **FR-021**: Run IDs MUST contain an ISO date and a unique lowercase slug or random
  suffix.
- **FR-022**: A run MUST open with an ID, start timestamp, and tool identity.
- **FR-023**: Open-run evidence and claim-reference sets MAY grow but MUST NOT lose or
  change existing entries.
- **FR-024**: A run MUST close exactly once with an end timestamp and one allowed
  verdict.
- **FR-025**: Closed runs MUST be immutable.
- **FR-026**: All timestamps MUST be valid full ISO 8601 UTC values at whole-second
  precision.
- **FR-027**: Committed evidence files MUST be immutable.

#### Validation

- **FR-028**: The product MUST provide 'graphkeeper check' for on-demand execution of
  the same rules used by commit enforcement.
- **FR-029**: Commit validation and on-demand validation MUST have identical pass/fail
  decisions for the same repository state.
- **FR-030**: Validation MUST report all detected violations where continuing is safe,
  with record IDs or paths and corrective guidance.
- **FR-031**: Validation MUST enforce schema, field type, ID, timestamp, source-variant,
  entity-reference, and uniqueness rules.
- **FR-032**: Validation MUST enforce semantic append-only claim history.
- **FR-033**: Validation MUST allow JSON-only formatting and key-order changes.
- **FR-034**: Validation MUST enforce entity growth and run lifecycle rules.
- **FR-035**: Validation MUST block modification, removal, or rename of committed
  evidence.
- **FR-036**: A supersession target MUST exist and MUST be referenced by no more than
  one direct successor.
- **FR-037**: Validation MUST reject self-cycles and multi-claim cycles in
  supersession chains.
- **FR-038**: First-commit validation MUST skip only comparisons that require 'HEAD'.
- **FR-039**: Fast validation MUST check evidence-reference shape and path safety
  without dereferencing the target.
- **FR-040**: Evidence references and stored commands MUST always be treated as data
  and MUST NOT be executed during validation, query, or diagnosis.

#### Query and Doctor

- **FR-041**: The product MUST provide 'graphkeeper query <subject>'.
- **FR-042**: Query MUST accept a canonical entity ID or an exact unique alias.
- **FR-043**: Query MUST return only active claims by default.
- **FR-044**: Query output MUST retain claim IDs and enough provenance to distinguish
  grounded claims from inference.
- **FR-045**: Query MUST reject ambiguous aliases without guessing.
- **FR-046**: Unknown subjects and subjects without active claims MUST produce distinct,
  clear outcomes.
- **FR-047**: The product MUST provide 'graphkeeper doctor' for deep integrity checks.
- **FR-048**: Doctor MUST verify evidence path containment, target existence,
  line-addressable content, positive increasing ranges, and actual line bounds.
- **FR-049**: Doctor MUST detect dangling graph references and MUST warn about unused
  entities.
- **FR-050**: Doctor MUST separate warnings from errors, return failure when errors
  exist, and report all safely discoverable findings.

#### Agent and Reviewer Guidance

- **FR-051**: Shipped agent guidance MUST teach agents to record durable findings with
  honest sources, reuse entity aliases, append corrections, and exclude session
  chatter.
- **FR-052**: Every rule described in guidance MUST be labeled as automatically
  enforced, doctor-enforced, or behavioral guidance.
- **FR-053**: The product MUST include a copy-pasteable grounded-reviewer example.
- **FR-054**: The reviewer example MUST cite active claim IDs for approved factual
  statements and return 'REVISE' when grounding is missing.
- **FR-055**: The reviewer MUST NOT accept inference alone as proof of a factual
  statement.
- **FR-056**: The product MUST include a populated, generic worked example containing
  graph data and evidence.
- **FR-057**: Documentation MUST state prerequisites, supported environments,
  limitations, recovery behavior, and known scaling boundaries.

### Key Entities

- **Claim**: A durable, flat factual assertion or explicit inference about one entity,
  with provenance, producer, creation time, and optional correction link.
- **Entity**: The canonical subject of claims, identified by a stable human-readable
  ID and discoverable through aliases.
- **Run**: One agent work session or beat that groups evidence and produced claims and
  closes with an auditable verdict.
- **Evidence artifact**: Immutable, line-addressable captured output used to ground one
  or more claims.
- **Evidence reference**: A safe repository-relative pointer from a tool-output claim
  to a specific inclusive line range in an evidence artifact.
- **Supersession chain**: A non-branching, acyclic history of corrections whose final
  claim is active.
- **Graph health finding**: A doctor result classified as an integrity error or a
  non-blocking warning.

## Assumptions and Dependencies

- The adopting repository uses Git for history and enforcement.
- Users can run Node.js 18 or newer for the distributed CLI.
- Git, a POSIX-compatible shell, and 'jq' are installed for enforced v1 workflows.
- Windows users operate through WSL or Git Bash; native PowerShell is unsupported.
- Evidence is captured as line-addressable text. Binary evidence is outside v1.
- Repository collaborators resolve concurrent JSON merge conflicts through normal Git
  review without rewriting previously committed records.
- The unscoped npm name 'graphkeeper' returned no public package on 2026-08-04 and is
  provisional until the release owner completes the final registry ownership check.
- An orphan entity is valid but suspicious, so doctor reports it as a warning.
- Alias resolution is exact rather than fuzzy; ambiguous aliases are never guessed.

## Out of Scope for v1

Version 1 has no database backend, no hosted service, and no UI or dashboard. It also
has no vector search and no multi-repository synchronization.

- Database storage, including SQLite and PostgreSQL implementations.
- A hosted GraphKeeper service or remote API.
- Authentication, authorization, accounts, or secrets management.
- A graphical interface or dashboard.
- Vector, semantic, or fuzzy search.
- Multi-repository synchronization or a shared cross-repository graph.
- Automatic transcript ingestion or treating a transcript as evidence.
- Native PowerShell support.
- Bundling or auto-installing 'jq'.
- Binary or non-line-addressable evidence.
- Automatic conflict resolution for concurrent writers.
- Telemetry or usage tracking.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A new user with prerequisites installed can go from
  'npx graphkeeper init' to a hook-enforced, queryable store in under two minutes.
- **SC-002**: Initialization preserves 100 percent of pre-existing graph data,
  evidence, and non-GraphKeeper hooks across repeat and forced runs.
- **SC-003**: The acceptance fixture suite rejects 100 percent of specified invalid
  claim, entity, run, evidence, and supersession cases while accepting all specified
  valid cases.
- **SC-004**: All committed-claim mutations and committed-evidence edits, removals, and
  renames in the acceptance suite are blocked.
- **SC-005**: A query over a graph containing up to 10,000 claims returns the correct
  active claims or a clear no-result/ambiguity outcome within two seconds on the
  documented reference environment.
- **SC-006**: Doctor identifies 100 percent of missing-file, unsafe-path, reversed,
  zero-based, and out-of-bounds evidence fixtures and reports every safely discoverable
  issue in one run.
- **SC-007**: The worked example can be queried and independently traced from each
  grounded claim to its exact evidence lines without reading a session transcript.
- **SC-008**: The reviewer example approves 100 percent of supported factual fixtures
  with claim IDs and returns 'REVISE' for 100 percent of inference-only, superseded,
  and unsupported factual fixtures.
- **SC-009**: One initialized graph is usable by at least two different documented
  agent harnesses without changing stored graph data.
- **SC-010**: A new contributor can identify v1 boundaries, run all checks, and locate
  the extension points for queries, agent guidance, validation, and future storage
  within 15 minutes using repository documentation alone.

## Specification Acceptance Checklist

- [x] All required user stories are represented as independently testable journeys.
- [x] Initialization, writing, validation, querying, diagnosis, correction, review,
  run tracking, and contribution workflows have acceptance scenarios.
- [x] Normal, failure, boundary, concurrency, environment, and recovery cases are
  covered.
- [x] Requirements describe user-visible behavior and data contracts without choosing
  internal implementation structure.
- [x] Version 1 non-goals and external prerequisites are explicit.
- [x] Success criteria are measurable and technology-agnostic where possible.
- [x] No plan, task list, or implementation is included.
