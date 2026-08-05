# GraphKeeper Constitution

**Status:** Ratified

## Core Principles

### I. Grounded Claims Only (NON-NEGOTIABLE)

Every durable fact MUST be stored as a claim with a declared source. A
'tool_output' source MUST include the command, integer exit code, evidence reference,
and capture timestamp. An 'inference' source MUST include only its kind and MAY include
a short 'basis'; it MUST NOT claim external evidence.

An agent's own prose is not evidence for its own factual claim. A reviewer MUST cite a
claim ID for every factual statement it approves. An inference-only claim cannot
independently ground such approval; the reviewer MUST return 'REVISE' and name the
missing evidence.

Evidence references use 'evidence/<filename>#L<start>-L<end>' and MUST match
'^evidence/[^\s#]+#L\d+-L\d+$'. Paths with '.' or '..' segments are invalid and the
resolved file MUST remain inside 'evidence/'. 'source.captured' and every other
timestamp MUST use full ISO 8601 UTC form: 'YYYY-MM-DDTHH:MM:SSZ'.

### II. Append-Only Audit History (NON-NEGOTIABLE)

Committed claims MUST NOT be edited or removed. A correction MUST be a new claim whose
'supersedes' field identifies the previous claim. Append-only comparison is semantic:
every claim ID present in 'HEAD' MUST remain in staged data with identical field
values. Whitespace, indentation, and JSON key order are not history.

A claim is active only when no claim supersedes it. Active state MUST be derived when
reading and MUST NOT be stored as a mutable field. A supersession target MUST exist,
MUST have at most one direct superseding claim, and MUST NOT participate in a cycle.

Entity identity is append-only: committed 'id', 'type', and 'first_seen' values MUST
remain unchanged. Existing 'aliases' and 'source_docs' entries MUST remain, while new
entries MAY be added.

A run has one controlled transition. It opens with 'id', 'started', and 'tool'; its
evidence and claim-reference sets MAY grow while open. It closes once by adding
'ended' and one verdict from 'passed', 'failed', 'inconclusive', or 'aborted'. A
verdict's presence defines closure. A closed run MUST NOT change.

A committed evidence file MUST NOT be edited, truncated, renamed, or deleted. New
evidence MUST be captured in a new file.

### III. Guardrails Live in the Harness (NON-NEGOTIABLE)

Every mechanically checkable invariant MUST be enforced automatically, not merely
described in 'SCHEMA.md', 'SKILL.md', or a prompt.

The pre-commit validator MUST reject invalid schemas and source variants, duplicate
claim IDs, unresolved subjects, broken or branching supersession references,
supersession cycles, unsafe evidence-reference shapes, rewritten claims, rewritten
evidence, invalid entity growth, invalid run transitions, and changes to closed runs.

On the first commit, absence of 'HEAD' only disables comparisons with earlier history;
all schema and internal-consistency checks MUST still run. The fast commit validator
MUST validate evidence-reference shape and safety without opening referenced evidence
files. 'graphkeeper doctor' MUST perform the slower checks for file existence, path
containment, increasing line ranges, actual line bounds, dangling references, and
orphaned records.

The Git hook and 'graphkeeper check' MUST execute one canonical validation script.
Validation logic MUST NOT be independently reimplemented in the TypeScript CLI.

### IV. Portable and Framework-Free

GraphKeeper MUST NOT depend on a model vendor, agent harness, SDK, hosted service, or
database. Its durable contract is ordinary files, plain JSON, and Git. It MUST work
with any coding agent capable of reading repository files and running shell commands.

Version 1 uses Git, POSIX shell, and 'jq'; 'jq' is an explicit prerequisite and MUST
NOT be silently bundled. The distribution CLI uses Node.js 18 or newer and npm with
ESM modules, but commit-time validation MUST NOT require Node.js. Windows support in
version 1 is through WSL or Git Bash; native PowerShell operation is not promised.

Initialization MUST preserve existing data and hooks. It MUST be idempotent, MUST NOT
overwrite existing graph data, and MUST NOT silently replace a hook in '.git/hooks' or
a configured 'core.hooksPath'. A non-Git directory MAY be scaffolded only with a clear
warning that enforcement is disabled until Git and the hook are initialized.

### V. Small First, Honest About Scale

Version 1 MUST ship the JSON-file implementation before any database backend. The
documentation MUST state that JSON is expected to strain around 10,000 claims and may
experience concurrent-write collisions.

SQLite and PostgreSQL are documented future storage options using the same conceptual
schema. They MUST NOT be implemented in version 1. Hosted services, authentication,
telemetry, dashboards, vector search, and multi-repository synchronization are also
outside version 1.

### VI. Generic, Flat, and Inspectable

Every field, rule, example, and default MUST be useful across repositories, teams,
languages, and agent products. Project-author-specific behavior is prohibited.

Claim IDs use 'claim_' plus eight random lowercase hexadecimal characters. Entity IDs
are human-readable lowercase snake-case slugs. Run IDs use
'run_<ISO-date>-<unique-slug-or-random-suffix>'. IDs MUST be unique in their record
type.

Claim 'subject', 'predicate', and 'object' values are strings. The subject MUST resolve
to an entity ID. The object is a short canonical literal or an entity ID; it MUST NOT
contain nested JSON. Predicates use lowercase snake case. Optional 'confidence' MUST
be numeric from 0 through 1. Structured supporting detail belongs in evidence.

### VII. Two Memories, Two Truth Standards

Progress notes MAY contain exploration, chatter, failed approaches, and dead ends.
The graph is reserved for durable findings represented honestly as sourced claims or
explicit inference. A transcript is not automatically durable memory, and inference
is not automatically verified fact. These stores MUST remain separate in the data
model, agent instructions, examples, and reviewer behavior.

## Engineering and Product Constraints

- 'graph/claims.json' is the source of truth for claims,
  'graph/entities.json' for entities, 'graph/runs.json' for runs, and 'evidence/' for
  captured artifacts.
- Entity 'source_docs', when present, is a set of canonical evidence references.
- Evidence-reference strings are data and MUST never be executed as commands.
- Path normalization and containment checks MUST prevent directory traversal.
- Hook installation MUST apply the same collision policy to default and custom hook
  directories and MUST provide explicit chaining instructions when needed.
- 'graphkeeper init --force' MAY refresh only generated template documentation; it
  MUST NOT overwrite graph data or evidence.
- The npm package name MUST be verified against the public registry before it is
  committed to user-facing documentation. If 'graphkeeper' is unavailable, the
  architecture and validator MUST approve an alternative.
- The technical plan MUST define measurable performance and resource budgets for the
  hook, CLI, and doctor command without weakening correctness.

## Development Workflow and Quality Gates

Development MUST follow this approval-gated order:

1. Constitution.
2. User-facing specification.
3. Technical plan.
4. Dependency-ordered tasks.
5. Implementation, one approved task at a time.

The architecture and validator role MUST approve each stage before the next begins.
During implementation, tasks MUST remain small, sequential, and independently
verified within their approved phase. After each phase, the implementation MUST stop,
present the phase summary and observed verification results, and wait for an
architecture/validator go/no-go decision before the next phase.

Tests MUST cover each enforced invariant with at least one passing and one rejecting
case where meaningful. Integration coverage MUST prove that initialization produces a
valid scaffold, the hook blocks invalid staged history, 'graphkeeper check' uses the
same validator, and 'doctor' detects invalid evidence targets. Security tests MUST
cover path traversal and unsafe reference input. No unrelated refactor belongs in a
feature change.

'SCHEMA.md' defines the field contract and labels each rule as hook-enforced,
doctor-enforced, or guidance. 'SKILL.md' teaches agents when and how to write durable
memory, but MUST NOT be treated as an enforcement boundary.

### Constitution Acceptance Gates

- [x] Grounding and inference standards are explicit and testable.
- [x] Append-only behavior is defined for claims, entities, runs, and evidence.
- [x] Hook enforcement is separated from doctor checks and written guidance.
- [x] Version 1 dependencies, supported environments, scale limits, and non-goals are
  explicit.
- [x] Security-sensitive evidence paths are constrained.
- [x] Progression to the specification requires architecture and validator approval.

## Governance

This constitution supersedes later specifications, plans, tasks, implementation
choices, and convenience. Any conflict MUST be resolved in favor of this constitution.

An intentional amendment requires:

1. A written explanation of the changed rule and its consequences.
2. Architecture and validator approval.
3. A semantic version change to the constitution.
4. Updates to affected specifications, plans, tasks, schemas, tests, and documentation.
5. A migration and rollback plan when committed data or public behavior is affected.

All reviews MUST verify constitutional compliance. Complexity MUST be justified by a
current requirement. No amendment may silently weaken evidence grounding, committed
history immutability, automated enforcement, portability, or separation of session
notes from durable memory.

**Amendment 0.2.0**: Implementation checkpoints moved from every task to every phase.
Tasks remain sequential and independently verified; only user-facing go/no-go pauses
are grouped at the phase boundary.

**Version**: 0.2.0 | **Ratified**: 2026-08-04 | **Last Amended**: 2026-08-04
