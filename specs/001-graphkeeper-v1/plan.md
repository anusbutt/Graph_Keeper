# Implementation Plan: GraphKeeper v1

**Branch**: '001-graphkeeper-v1' | **Date**: 2026-08-04 |
**Spec**: 'specs/001-graphkeeper-v1/spec.md'  
**Status**: Approved for task breakdown  
**Input**: Approved GraphKeeper v1 feature specification

## Summary

GraphKeeper v1 is a single npm-distributed CLI that scaffolds a repository-local,
Git-audited memory graph for coding agents. Data remains plain JSON and captured text.
A POSIX shell validator using 'jq' is the single source of truth for fast schema,
referential-integrity, lifecycle, and append-only checks. The installed Git hook and
'graphkeeper check' invoke that same validator. The TypeScript CLI owns onboarding,
query presentation, and deeper doctor checks, while agent-facing Markdown explains
behavior that cannot be enforced mechanically.

The smallest viable architecture is one package, one validator, one data contract, and
no service or database. The JSON design is intentionally bounded to approximately
10,000 claims per repository.

## Technical Context

**Language/Version**: TypeScript 5.x targeting Node.js 18 or newer; POSIX sh; jq 1.6 or
newer  
**Primary Dependencies**: Node.js standard library, Git, POSIX sh, jq; no runtime npm
framework  
**Storage**: Repository-local JSON arrays and immutable text evidence tracked by Git  
**Testing**: Node built-in test runner, fixture repositories, shell integration tests,
and end-to-end CLI tests  
**Target Platform**: Linux, macOS, WSL, and Git Bash on Windows; native PowerShell is
not supported in v1  
**Project Type**: Single CLI package with scaffold templates  
**Performance Goals**: p95 query below 2 seconds at 10,000 claims; p95 staged commit
validation below 3 seconds at 10,000 claims; p95 doctor below 10 seconds for 10,000
claims and 10,000 evidence references on the reference environment  
**Constraints**: Offline after package installation; no database, service, auth,
telemetry, SDK, or Node dependency at commit time; new-user initialization below two
minutes  
**Scale/Scope**: One repository, one graph, up to approximately 10,000 claims, one Git
writer per merge result, version 0.1.0

## Constitution Check

*GATE: Must pass before design and be rechecked before tasks.*

| Constitutional gate | Plan evidence | Result |
|---|---|---|
| Every durable fact is sourced or explicit inference | Discriminated claim source contract and reviewer rules | PASS |
| Claims and evidence are append-only | HEAD-to-selected-state semantic comparison and evidence diff checks | PASS |
| Entity growth and run lifecycle are controlled | Field-level transition rules in the validator | PASS |
| Mechanical rules are enforced | One canonical script is invoked by hook and CLI | PASS |
| Evidence targets are not opened during commit | Hook validates reference shape and Git history only | PASS |
| Portable and harness-independent | Plain files, Git, sh, jq, and Markdown instructions | PASS |
| No database or hosted scope | Explicit non-goals and no server components | PASS |
| Two memories remain separate | Graph templates and agent guidance exclude session chatter | PASS |
| Each task will be independently verified | Test and delivery gates defined below | PASS |

No constitutional exception or complexity waiver is required.

## Scope and Dependencies

### In Scope

- Public CLI commands: 'init', 'check', 'query <subject>', and 'doctor'.
- Scaffold templates for graph data, evidence, schema guidance, agent instructions,
  validation, and hook entrypoint.
- Strict claim, entity, and run contracts.
- Semantic append-only comparison against 'HEAD'.
- Immutable committed evidence.
- Active-claim lookup by entity ID or exact alias.
- Deep evidence-reference and graph-health diagnosis.
- A grounded-reviewer prompt and a populated worked example.
- Automated tests, CI, README, contribution guide, MIT license, and issue templates.

### Out of Scope

- SQLite or PostgreSQL implementations.
- Hosted APIs, authentication, authorization, telemetry, dashboards, vector search,
  fuzzy search, and multi-repository synchronization.
- Native PowerShell validation.
- Binary evidence and automatic transcript ingestion.
- Automatic merge-conflict resolution.
- Automatic installation or bundling of Git, sh, jq, or Node.js.

### External Dependencies and Ownership

| Dependency | Minimum | Purpose | Owner / failure behavior |
|---|---:|---|---|
| Node.js | 18 | Run the npm CLI | User; CLI exits with installation guidance |
| npm/npx | compatible with Node 18 | Distribution and one-command invocation | User; no repository changes on failure |
| Git | 2.x | History comparison and hooks | User; init scaffolds but warns that enforcement is disabled |
| POSIX sh | POSIX | Commit-time validator and hook | User; unsupported shell is a documented platform error |
| jq | 1.6 | JSON validation and active-claim selection | User; init/check fail before mutation with installation guidance |
| npm registry | public availability | Publish version 0.1.0 | Release owner; package name is a release gate |

The 2026-08-04 registry probe returned no public 'graphkeeper' package. This is not a
reservation guarantee; ownership MUST be verified again immediately before publish.

## Architecture and Key Decisions

### Component Flow

~~~text
developer or agent
        |
        v
graphkeeper CLI ---------------------------+
  | init     | query     | doctor          |
  |          |           |                 |
  v          v           v                 |
templates   graph JSON   graph + evidence  |
  |                                      check
  v                                         |
target repository                            v
  |                                  scripts/validate.sh
  +---- pre-commit hook --------------------+
~~~

### Decision 1: Plain JSON plus Git is the v1 source of truth

- **Options considered**: JSON files, SQLite, PostgreSQL, hosted graph service.
- **Choice**: JSON arrays committed with the repository.
- **Rationale**: Lowest adoption cost, direct diffs, tool independence, and no service
  lifecycle.
- **Trade-off**: Linear scans and merge collisions become material near 10,000 claims.
- **Reversibility**: The conceptual schema and IDs remain stable when a future storage
  adapter is added.

### Decision 2: One shell validator owns fast enforcement

- **Options considered**: duplicate validation in TypeScript and shell, Node-only hook,
  generated JSON Schema, one sh/jq validator.
- **Choice**: 'scripts/validate.sh' is canonical. The hook invokes staged mode;
  'graphkeeper check' invokes working-tree mode and forwards output.
- **Rationale**: Prevents rule drift and keeps commit enforcement independent of Node.
- **Trade-off**: jq programs are less ergonomic than TypeScript and need fixture-heavy
  tests.
- **Reversibility**: A future validator can replace the script only through a
  constitution amendment and parity migration.

### Decision 3: Fast validation and deep diagnosis are separate

- **Options considered**: dereference every evidence range on every commit, never
  dereference, separate fast and deep checks.
- **Choice**: Hook/check enforce shapes, relations, transitions, and history. Doctor
  checks actual evidence files and ranges.
- **Rationale**: Commit latency stays bounded while users retain a complete integrity
  command.
- **Trade-off**: A syntactically valid but physically broken evidence reference can
  pass the hook and is caught by doctor/CI.
- **Guardrail**: CI runs both check and doctor on every pull request.

### Decision 4: Installed assets remain repository-local

- **Options considered**: execute validator from npm cache, require a global binary,
  copy versioned assets into each target repository.
- **Choice**: Init copies the canonical validator and templates into the target repo.
- **Rationale**: Commits remain reproducible offline and hooks do not depend on npm
  cache state.
- **Trade-off**: Template upgrades require an explicit refresh and review.

### Decision 5: Exact aliases, no fuzzy matching

- **Options considered**: ID-only, exact alias, fuzzy or semantic search.
- **Choice**: Canonical ID or exact alias; ambiguity is an error listing candidates.
- **Rationale**: Deterministic, inspectable results without a search service.
- **Trade-off**: Users must know an exact ID or alias.

## Project Structure

### Documentation for This Feature

~~~text
specs/001-graphkeeper-v1/
|-- spec.md
|-- plan.md
+-- tasks.md                 # created only after plan approval
~~~

Phase-0 and phase-1 findings are kept in this plan because the system is a single,
small CLI and separate research, data-model, contract, and quickstart artifacts would
duplicate the same decisions.

### Package Source

~~~text
package.json
package-lock.json
tsconfig.json
LICENSE
README.md
CONTRIBUTING.md
src/
|-- cli.ts
|-- commands/
|   |-- init.ts
|   |-- check.ts
|   |-- query.ts
|   +-- doctor.ts
+-- lib/
    |-- errors.ts
    |-- git.ts
    |-- paths.ts
    |-- process.ts
    +-- records.ts
scripts/
+-- validate.sh              # canonical fast validator
templates/
|-- graph/
|   |-- SCHEMA.md
|   |-- entities.json
|   |-- claims.json
|   +-- runs.json
|-- evidence/
|   +-- .gitkeep
|-- SKILL.md
+-- pre-commit
examples/
|-- reviewer.md
+-- worked-example/
    |-- graph/
    +-- evidence/
tests/
|-- fixtures/
|-- unit/
|-- integration/
+-- e2e/
.github/
|-- workflows/ci.yml
+-- ISSUE_TEMPLATE/
~~~

### Target Repository Scaffold

~~~text
graph/
|-- SCHEMA.md
|-- entities.json
|-- claims.json
+-- runs.json
evidence/
+-- .gitkeep
SKILL.md
scripts/
+-- validate.sh
.githooks/
+-- pre-commit
~~~

The actual hook may be installed into Git's resolved hook directory. The checked-in
'.githooks/pre-commit' remains the inspectable fallback and chaining source.

**Structure Decision**: A single-package CLI keeps distribution, templates, tests, and
examples together. No workspace, plugin system, server layer, or repository
abstraction is justified in v1.

## Data Model

All JSON data files contain top-level arrays. Unknown fields are rejected so the
contract remains predictable.

### Claim

| Field | Type | Required | Rule |
|---|---|---:|---|
| id | string | yes | '^claim_[0-9a-f]{8}$', unique |
| subject | string | yes | Existing entity ID |
| predicate | string | yes | Lowercase snake-case slug |
| object | string | yes | Short canonical literal or entity ID |
| confidence | number | no | Inclusive range 0 through 1 |
| source | object | yes | Exactly one source variant below |
| produced_by | string | yes | Existing run ID |
| supersedes | string | no | Existing claim ID; one successor; acyclic |
| created | string | yes | Full ISO 8601 UTC timestamp |

'tool_output' source fields are exactly 'kind', 'command', 'exit_code', 'ref', and
'captured'. Exit codes are integers from 0 through 255. 'inference' source fields are
exactly 'kind' and optional non-empty 'basis'.

### Entity

| Field | Type | Required | Rule |
|---|---|---:|---|
| id | string | yes | Unique lowercase snake-case slug |
| type | string | yes | Non-empty lowercase snake-case category |
| aliases | string array | yes | Unique entries; append-only set |
| source_docs | string array | no | Unique canonical evidence refs; append-only set |
| first_seen | string | yes | Full ISO 8601 UTC timestamp |

Cross-entity alias collisions are allowed because aliases are human input. Query treats
more than one exact match as ambiguous and never guesses.

### Run

| Field | Type | Required | Rule |
|---|---|---:|---|
| id | string | yes | 'run_<date>-<unique-suffix>' |
| started | string | yes | Full ISO 8601 UTC timestamp |
| tool | string | yes | Non-empty harness label |
| task | string | no | May be added once while open, then immutable |
| evidence | string array | yes | Unique repository evidence paths; growth-only while open |
| claims_written | string array | yes | Unique claim IDs; growth-only while open |
| ended | string | on close | Full UTC timestamp not earlier than 'started' |
| verdict | enum | on close | passed, failed, inconclusive, or aborted |

'ended' and 'verdict' are both absent for an open run and both present for a closed
run. Claims and run 'claims_written' entries must agree bidirectionally. A tool-output
claim's evidence file must appear in its producing run's 'evidence' set.

### Evidence and References

Evidence is UTF-8 line-addressable text. A committed evidence path and its bytes are
immutable. Nested directories below 'evidence/' are allowed; empty, '.', and '..' path
segments are not. References are inclusive, one-based line ranges.

Duplicate JSON object keys are invalid. Fast validation handles parsed record shape;
doctor performs a raw-input duplicate-key scan because ordinary JSON object parsing
keeps only one value for a duplicate key.

## Public CLI Contracts

All commands write normal results to stdout, diagnostics to stderr, and use these exit
codes:

| Code | Meaning |
|---:|---|
| 0 | Success; doctor may include warnings |
| 1 | User data or validation failure |
| 2 | Usage error or invalid option |
| 3 | Missing prerequisite or unsupported environment |
| 4 | Filesystem, Git, or subprocess failure |
| 5 | Internal unexpected failure |

### 'graphkeeper init [--force]'

- **Input**: Current working directory; optional force flag.
- **Output**: Created, skipped, refreshed, and warning lists.
- **Idempotency**: Repeat calls preserve data. Force refreshes only 'SCHEMA.md' and
  'SKILL.md'.
- **Errors**: Prerequisites are checked before mutation. A hook collision is reported
  with chaining instructions and does not overwrite the existing hook.
- **Retries**: Safe after any failure because writes use temporary siblings followed by
  atomic rename; existing data is never replaced.
- **Timeout**: No internal retry loop; subprocess timeout budget is 10 seconds.

### 'graphkeeper check'

- **Input**: Current working tree and 'HEAD'.
- **Output**: The canonical validator's complete diagnostics and summary.
- **Behavior**: Executes 'sh scripts/validate.sh --worktree'.
- **Errors**: Returns 1 for graph violations and 3 when jq/sh is missing.
- **Idempotency**: Read-only and safe to repeat.

### 'graphkeeper query <subject>'

- **Input**: One non-empty canonical entity ID or exact alias.
- **Output**: Active claims with ID, predicate, object, source kind, producer, created
  time, and tool-output reference where present.
- **Errors**: Usage error for missing input; validation error for ambiguous alias;
  distinct successful empty result for a known entity with no active claims; not-found
  result for an unknown entity.
- **Idempotency**: Read-only and deterministic for unchanged files.
- **Timeout**: 5-second subprocess timeout; p95 target below 2 seconds.

### 'graphkeeper doctor'

- **Input**: Current graph and evidence tree.
- **Output**: All safely discoverable findings grouped into errors and warnings.
- **Errors**: Exit 1 when one or more integrity errors exist; warnings alone return 0.
- **Checks**: Fast validator parity, duplicate raw keys, evidence containment,
  existence, UTF-8/text suitability, range order and bounds, dangling references, and
  orphan entity warnings.
- **Idempotency**: Read-only and safe to repeat.
- **Timeout**: 30-second hard timeout; p95 target below 10 seconds.

## Validation Architecture

'scripts/validate.sh' accepts exactly '--staged' or '--worktree'. Staged mode reads
graph JSON from Git's index and compares it with 'HEAD'. Worktree mode reads files from
disk and compares them with 'HEAD'. Both modes run the same jq programs.

The validator accumulates safe independent failures, emits stable 'GKxxx' codes, and
returns once with a nonzero status. It never evaluates stored command text or opens an
evidence reference. Evidence immutability is checked through Git path/content status,
not through claim dereferencing.

The following script is the normative reference implementation to place at
'scripts/validate.sh'. Implementation tasks may improve diagnostics or factor repeated
jq definitions, but MUST preserve behavior and remain fixture-compatible.

~~~sh
#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  printf '%s\n' 'GK002 expected --staged or --worktree' >&2
  exit 2
fi
mode=$1
case "$mode" in
  --staged|--worktree) ;;
  *) printf '%s\n' 'GK002 invalid validator mode' >&2; exit 2 ;;
esac

failures=0
fail() {
  code=$1
  shift
  printf '%s %s\n' "$code" "$*" >&2
  failures=$((failures + 1))
}

command -v git >/dev/null 2>&1 || {
  printf '%s\n' 'GK003 git is required' >&2
  exit 3
}
command -v jq >/dev/null 2>&1 || {
  printf '%s\n' 'GK003 jq 1.6 or newer is required' >&2
  exit 3
}
jq_version=$(jq --version 2>/dev/null || true)
case "$jq_version" in
  jq-1.6*|jq-1.[7-9]*|jq-[2-9]*) ;;
  *)
    printf '%s\n' 'GK003 jq 1.6 or newer is required' >&2
    exit 3
    ;;
esac

root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  printf '%s\n' 'GK004 not inside a Git repository' >&2
  exit 4
}
cd "$root"

tmp=$(mktemp -d 2>/dev/null) || {
  printf '%s\n' 'GK004 unable to create temporary directory' >&2
  exit 4
}
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

load_selected() {
  path=$1
  out=$2
  if [ "$mode" = '--staged' ]; then
    if git cat-file -e ":$path" 2>/dev/null; then
      git show ":$path" > "$out" ||
        fail GK004 "cannot read staged $path"
    else
      fail GK101 "required staged file is missing: $path"
      printf '%s\n' '[]' > "$out"
    fi
  elif [ -f "$path" ]; then
    cp "$path" "$out" || fail GK004 "cannot read $path"
  else
    fail GK101 "required file is missing: $path"
    printf '%s\n' '[]' > "$out"
  fi
}

entities=$tmp/entities.json
claims=$tmp/claims.json
runs=$tmp/runs.json
load_selected graph/entities.json "$entities"
load_selected graph/claims.json "$claims"
load_selected graph/runs.json "$runs"

parse_ok=1
for file in "$entities" "$claims" "$runs"; do
  if ! jq empty "$file" >/dev/null 2>&1; then
    fail GK102 "invalid JSON: $file"
    parse_ok=0
  fi
done

if [ "$parse_ok" -eq 1 ]; then
  if ! jq -e '
    def exact_keys($required; $optional):
      . as $o
      | all($required[] as $k; $o | has($k))
        and ((keys_unsorted - ($required + $optional)) | length == 0);
    def nonempty: type == "string" and length > 0;
    def slug: nonempty and test("^[a-z0-9]+(_[a-z0-9]+)*$");
    def utc:
      type == "string"
      and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")
      and ((try fromdateiso8601 catch null) != null);
    def unique_strings:
      type == "array"
      and all(.[]; type == "string" and length > 0)
      and length == (unique | length);
    def safe_segments:
      split("/") | all(. != "" and . != "." and . != "..");
    def evidence_ref:
      type == "string"
      and test("^evidence/[^[:space:]#]+#L[0-9]+-L[0-9]+$")
      and (split("#")[0] | safe_segments);
    type == "array"
    and all(.[];
      exact_keys(["id", "type", "aliases", "first_seen"]; ["source_docs"])
      and (.id | slug)
      and (.type | slug)
      and (.aliases | unique_strings)
      and ((.source_docs // []) | unique_strings)
      and all((.source_docs // [])[]; evidence_ref)
      and (.first_seen | utc)
    )
    and ([.[].id] | length == (unique | length))
  ' "$entities" >/dev/null; then
    fail GK110 'entity schema or ID uniqueness violation'
  fi

  if ! jq -e '
    def exact_keys($required; $optional):
      . as $o
      | all($required[] as $k; $o | has($k))
        and ((keys_unsorted - ($required + $optional)) | length == 0);
    def nonempty: type == "string" and length > 0;
    def snake: nonempty and test("^[a-z0-9]+(_[a-z0-9]+)*$");
    def utc:
      type == "string"
      and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")
      and ((try fromdateiso8601 catch null) != null);
    def safe_segments:
      split("/") | all(. != "" and . != "." and . != "..");
    def evidence_ref:
      type == "string"
      and test("^evidence/[^[:space:]#]+#L[0-9]+-L[0-9]+$")
      and (split("#")[0] | safe_segments);
    def source:
      if .kind == "tool_output" then
        exact_keys(
          ["kind", "command", "exit_code", "ref", "captured"];
          []
        )
        and (.command | nonempty)
        and (.exit_code |
          type == "number" and . == floor and . >= 0 and . <= 255
        )
        and (.ref | evidence_ref)
        and (.captured | utc)
      elif .kind == "inference" then
        exact_keys(["kind"]; ["basis"])
        and ((has("basis") | not) or (.basis | nonempty))
      else false
      end;
    type == "array"
    and all(.[];
      exact_keys(
        ["id", "subject", "predicate", "object", "source",
         "produced_by", "created"];
        ["confidence", "supersedes"]
      )
      and (.id | type == "string" and test("^claim_[0-9a-f]{8}$"))
      and (.subject | nonempty)
      and (.predicate | snake)
      and (.object | nonempty)
      and (.source | source)
      and (.produced_by |
        type == "string"
        and test("^run_[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9][a-z0-9_-]*$")
      )
      and (.created | utc)
      and ((has("confidence") | not) or
        (.confidence | type == "number" and . >= 0 and . <= 1)
      )
      and ((has("supersedes") | not) or
        (.supersedes | type == "string" and test("^claim_[0-9a-f]{8}$"))
      )
    )
    and ([.[].id] | length == (unique | length))
  ' "$claims" >/dev/null; then
    fail GK120 'claim schema or ID uniqueness violation'
  fi

  if ! jq -e '
    def exact_keys($required; $optional):
      . as $o
      | all($required[] as $k; $o | has($k))
        and ((keys_unsorted - ($required + $optional)) | length == 0);
    def nonempty: type == "string" and length > 0;
    def utc:
      type == "string"
      and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")
      and ((try fromdateiso8601 catch null) != null);
    def unique_strings:
      type == "array"
      and all(.[]; type == "string" and length > 0)
      and length == (unique | length);
    def safe_segments:
      split("/") | all(. != "" and . != "." and . != "..");
    def evidence_path:
      type == "string"
      and test("^evidence/[^[:space:]#]+$")
      and safe_segments;
    type == "array"
    and all(.[];
      . as $run
      | exact_keys(
          ["id", "started", "tool", "evidence", "claims_written"];
          ["task", "ended", "verdict"]
        )
        and (.id |
          type == "string"
          and test("^run_[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9][a-z0-9_-]*$")
        )
        and (.started | utc)
        and (.tool | nonempty)
        and ((has("task") | not) or (.task | nonempty))
        and (.evidence | unique_strings)
        and all(.evidence[]; evidence_path)
        and (.claims_written | unique_strings)
        and all(.claims_written[];
          test("^claim_[0-9a-f]{8}$")
        )
        and (has("ended") == has("verdict"))
        and (
          if has("verdict") then
            (.ended | utc)
            and ((.ended | fromdateiso8601) >=
                 (.started | fromdateiso8601))
            and (.verdict |
              . == "passed" or . == "failed" or
              . == "inconclusive" or . == "aborted"
            )
          else true
          end
        )
    )
    and ([.[].id] | length == (unique | length))
  ' "$runs" >/dev/null; then
    fail GK130 'run schema or ID uniqueness violation'
  fi

  if ! jq -e \
    --slurpfile entities "$entities" \
    --slurpfile runs "$runs" '
    def acyclic($index; $id; $seen):
      if $id == null then true
      elif ($seen | index($id)) != null then false
      else acyclic(
        $index;
        ($index[$id].supersedes // null);
        $seen + [$id]
      )
      end;
    INDEX($entities[0][]; .id) as $by_entity
    | INDEX($runs[0][]; .id) as $by_run
    | INDEX(.[]; .id) as $by_claim
    | ([.[] | select(has("supersedes")) | .supersedes]) as $targets
    | all(.[];
        ($by_entity[.subject] != null)
        and ($by_run[.produced_by] != null)
        and ((has("supersedes") | not) or
          ($by_claim[.supersedes] != null)
        )
      )
      and (($targets | length) == ($targets | unique | length))
      and all(.[]; acyclic($by_claim; .id; []))
      and all($runs[0][];
        . as $run
        | all($run.claims_written[];
            . as $id
            | $by_claim[$id] != null
              and $by_claim[$id].produced_by == $run.id
          )
      )
      and all(.[];
        . as $claim
        | ($by_run[$claim.produced_by].claims_written |
            index($claim.id)) != null
      )
      and all(.[];
        . as $claim
        | if $claim.source.kind == "tool_output" then
            ($claim.source.ref | split("#")[0]) as $path
            | ($by_run[$claim.produced_by].evidence |
                index($path)) != null
          else true
          end
      )
  ' "$claims" >/dev/null; then
    fail GK140 'cross-reference, supersession, or provenance violation'
  fi

  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    old_entities=$tmp/old-entities.json
    old_claims=$tmp/old-claims.json
    old_runs=$tmp/old-runs.json
    git show HEAD:graph/entities.json > "$old_entities" 2>/dev/null ||
      printf '%s\n' '[]' > "$old_entities"
    git show HEAD:graph/claims.json > "$old_claims" 2>/dev/null ||
      printf '%s\n' '[]' > "$old_claims"
    git show HEAD:graph/runs.json > "$old_runs" 2>/dev/null ||
      printf '%s\n' '[]' > "$old_runs"

    if ! jq empty "$old_entities" "$old_claims" "$old_runs" \
      >/dev/null 2>&1; then
      fail GK150 'committed graph JSON cannot be parsed'
    else
      if ! jq -e --slurpfile current "$claims" '
        all(.[];
          . as $old
          | any($current[0][];
              .id == $old.id and . == $old
            )
        )
      ' "$old_claims" >/dev/null; then
        fail GK151 'a committed claim was changed or removed'
      fi

      if ! jq -e --slurpfile current "$entities" '
        all(.[];
          . as $old
          | any($current[0][];
              . as $new
              | $new.id == $old.id
                and $new.type == $old.type
                and $new.first_seen == $old.first_seen
                and (($old.aliases - $new.aliases) | length == 0)
                and (
                  (($old.source_docs // []) -
                   ($new.source_docs // [])) | length == 0
                )
            )
        )
      ' "$old_entities" >/dev/null; then
        fail GK152 'invalid entity identity change or set removal'
      fi

      if ! jq -e --slurpfile current "$runs" '
        all(.[];
          . as $old
          | any($current[0][];
              . as $new
              | $new.id == $old.id
                and (
                  if $old | has("verdict") then
                    $new == $old
                  else
                    $new.started == $old.started
                    and $new.tool == $old.tool
                    and (
                      if $old | has("task") then
                        $new.task == $old.task
                      else true
                      end
                    )
                    and (($old.evidence - $new.evidence) | length == 0)
                    and (
                      ($old.claims_written - $new.claims_written) |
                      length == 0
                    )
                  end
                )
            )
        )
      ' "$old_runs" >/dev/null; then
        fail GK153 'invalid open-run transition or closed-run mutation'
      fi
    fi

    if [ "$mode" = '--staged' ]; then
      if ! evidence_changes=$(git diff --cached --name-status \
        --diff-filter=MDR HEAD -- evidence/); then
        fail GK004 'unable to compare staged evidence with HEAD'
        evidence_changes=
      fi
    else
      if ! evidence_changes=$(git diff --name-status \
        --diff-filter=MDR HEAD -- evidence/); then
        fail GK004 'unable to compare evidence with HEAD'
        evidence_changes=
      fi
    fi
    if [ -n "$evidence_changes" ]; then
      fail GK154 "committed evidence changed: $evidence_changes"
    fi
  fi
fi

if [ "$failures" -ne 0 ]; then
  printf 'GraphKeeper: %s violation(s)\n' "$failures" >&2
  exit 1
fi

printf '%s\n' 'GraphKeeper: validation passed'
exit 0
~~~

## Hook and Installation Design

The checked-in pre-commit wrapper is intentionally small:

~~~sh
#!/bin/sh
set -eu
root=$(git rev-parse --show-toplevel)
exec sh "$root/scripts/validate.sh" --staged
~~~

Initialization resolves the hook destination in this order:

1. Read 'git config --get core.hooksPath'.
2. If unset, use the repository's normal Git hook directory.
3. Resolve a relative custom path from the repository root and confirm containment or
   explicit user configuration.
4. If no pre-commit file exists, atomically install the GraphKeeper wrapper and mark it
   executable.
5. If the destination contains a GraphKeeper marker and matches the shipped wrapper,
   report it as already installed.
6. If any other hook exists, leave it byte-for-byte unchanged, write the inspectable
   wrapper to '.githooks/pre-commit', and print exact chaining instructions.

Init never edits an existing third-party hook. It also never changes
'core.hooksPath' automatically.

## Query Design

The query command validates the current graph first, resolves the input against entity
IDs and exact aliases, and then performs one active-claim selection:

1. Exact entity ID match wins.
2. Otherwise collect exact alias matches.
3. Zero matches returns not found.
4. More than one match returns ambiguity with candidate IDs.
5. For the selected ID, exclude every claim whose ID appears as another claim's
   'supersedes' value.
6. Sort active results by 'created', then 'id', for deterministic output.

Human output is the v1 default. A future machine-readable output flag is compatible
but not required by this plan.

## Doctor Design

Doctor first invokes the canonical validator in worktree mode. It then performs checks
that require raw bytes or evidence reads:

- Raw duplicate JSON object-key detection before normal parsing.
- Canonical-path containment below 'evidence/'.
- File existence in the evaluated working tree.
- UTF-8 decodability and text suitability.
- Inclusive one-based range parsing, start less than or equal to end, and end within
  logical line count.
- Source-doc reference verification.
- Dangling claim, run, and entity relationships as defense in depth.
- Orphan entities as warnings.

LF and CRLF represent the same logical line boundaries. An empty text file has zero
addressable lines. Doctor opens referenced evidence only as data and never executes
stored command strings.

## Agent Skill and Reviewer Pattern

'SKILL.md' is vendor-neutral and contains four explicit categories:

1. **Write**: Record every durable finding as a sourced claim; inference must be
   labeled honestly.
2. **Correct**: Never edit or delete committed records; append a superseding claim.
3. **Resolve identity**: Check canonical IDs and aliases before adding an entity.
4. **Exclude**: Keep chatter, hypotheses, and dead ends in progress notes.

Every rule is tagged 'HOOK', 'DOCTOR', or 'GUIDANCE'. The reviewer example at
'examples/reviewer.md' requires an active claim ID for each approved factual statement.
It returns 'REVISE' with missing evidence when support is absent, inference-only, or
superseded.

The worked example uses a generic flaky-test investigation and includes complete
'graph/' and 'evidence/' data that pass check and doctor.

## Non-Functional Requirements and Budgets

### Performance

Reference measurements use a two-core environment with 4 GB available memory, local
SSD storage, and Git, sh, jq 1.6, and Node 18 already started or cached.

| Operation | Dataset | Budget |
|---|---|---:|
| Init | Empty representative repository | p95 below 10 seconds |
| Check / pre-commit | 10,000 claims, 2,000 entities, 1,000 runs | p95 below 3 seconds |
| Query | 10,000 claims | p95 below 2 seconds |
| Doctor | 10,000 claims and references | p95 below 10 seconds |
| Peak memory | Any supported 10,000-claim workflow | below 256 MB |

No performance optimization may skip correctness checks. Performance regressions over
20 percent require investigation before release.

### Reliability

- Deterministic validation target: identical selected files and 'HEAD' produce
  identical pass/fail results and stable error codes.
- Data-loss target: zero GraphKeeper-caused loss or overwrite of existing graph data,
  evidence, or third-party hooks.
- Initialization success target: at least 99 percent across the supported CI platform
  matrix when prerequisites are present.
- Degradation: failure to install a hook leaves scaffolded data usable but emits a
  prominent enforcement-disabled warning; validator or doctor failures never mutate
  data.
- Retries: read-only commands do not retry local deterministic failures. Init may be
  rerun safely by the user because each write is idempotent or atomic.

### Security

- Treat claim commands, aliases, objects, paths, and evidence as untrusted data.
- Never pass stored values to 'eval', a shell command line, or dynamic code loading.
- Resolve and verify evidence containment before opening a file.
- Use argument arrays for Node subprocesses and fixed Git/jq invocations.
- Reject path traversal, NUL-equivalent input, unsafe empty segments, and unsupported
  file types.
- Preserve least privilege: no network access after npm installation, no credentials,
  no telemetry, and no modification outside the current repository.
- CI includes traversal, quoting, spaces-in-path, malicious-command-string, symlink,
  and hook-collision fixtures.
- Doctor rejects a symlinked evidence target whose resolved path leaves 'evidence/'.

### Cost

- Runtime infrastructure cost is zero: there is no hosted component.
- User cost is local CPU, storage, and normal Git history.
- Package dependencies are kept at zero runtime npm dependencies unless an approved
  ADR demonstrates that a dependency materially reduces security or correctness risk.

## Data Management, Evolution, and Recovery

### Source of Truth

The current repository files and Git history are authoritative. Generated summaries,
query output, and progress notes are not sources of truth.

### Schema Evolution

- GraphKeeper begins at public package version 0.1.0 and schema version 1.
- The starter arrays carry no mutable global status. If version metadata becomes
  necessary, it is introduced through an explicit manifest and migration plan.
- Additive optional fields require validator, schema, example, doctor, and test updates
  in the same release.
- Removing or reinterpreting a field is a breaking schema change and requires a
  constitution-compatible migration.
- Readers SHOULD tolerate a future schema version only when explicitly designed;
  v1 rejects unknown record fields to prevent silent misinterpretation.

### Migration and Rollback

There is no data migration in v1. Template refresh is limited to generated Markdown.
A failed init is recovered by rerunning after the reported cause is fixed. Atomic
temporary-file replacement prevents partial generated documents.

Release rollback means installing the previous npm version. Already scaffolded
repository assets remain under Git control and can be reviewed or reverted normally,
except graph history and evidence MUST still respect append-only rules.

### Retention

Claims, committed entities, closed runs, and committed evidence have indefinite
repository retention in v1. GraphKeeper provides no purge command. Repository owners
remain responsible for ensuring evidence does not contain secrets or regulated data
before commit.

### Future Storage Path

At roughly 10,000 claims or repeated concurrent-write collisions, a future adapter may
map the same IDs, source variants, supersession rules, and run lifecycle to SQLite or
PostgreSQL. That work is documented as a good-first-issue design exploration, not a v1
implementation task.

## Operational Readiness

GraphKeeper is local software, so observability is command-oriented:

- Human-readable stdout summaries and stderr diagnostics with stable 'GKxxx' codes.
- Optional debug output may report timings and invoked fixed tools, but never evidence
  content or secrets.
- CI records command output and duration for check, doctor, tests, and package smoke
  installation.
- No remote metrics, traces, alerts, or on-call service exist in v1.

Release alerts are CI failures:

- Any invariant fixture mismatch blocks merge.
- Any p95 budget regression above 20 percent blocks release pending review.
- Any package smoke-test, supported-platform, or npm contents failure blocks publish.

Required runbooks in the README or contribution guide:

1. Install missing jq on each supported platform.
2. Chain GraphKeeper with an existing pre-commit hook.
3. Recover from interrupted or repeated initialization.
4. Repair each validator and doctor error class without rewriting history.
5. Resolve a concurrent JSON merge by preserving every committed record.
6. Upgrade or roll back the CLI and inspect refreshed templates.

Deployment is an npm publish of an exact tested tarball. CI MUST inspect package
contents, install that tarball into clean fixture repositories, and run init, check,
query, and doctor before publication. The release owner rechecks package-name
availability and publishes 0.1.0 manually. There are no feature flags in v1.

## Test and Evaluation Strategy

### Unit Tests

- Argument parsing, exit-code mapping, path normalization, alias resolution, active
  claim selection, range parsing, logical line counting, and error formatting.
- Init decision tables for new, existing, forced, non-Git, custom-hook, and collision
  states.
- Doctor duplicate-key, UTF-8, containment, symlink, and line-bound checks.

### Validator Fixture Tests

Each hook-enforced rule receives at least one passing and one rejecting fixture:

- Required and unknown fields, types, IDs, timestamps, source variants, confidence.
- Duplicate IDs, missing subjects/runs/claims, provenance mismatches.
- Missing, branching, self-cycling, and multi-node supersession chains.
- Semantic claim edits/removals versus harmless formatting.
- Entity identity edits and alias/source-doc removals.
- Open-run growth, close transition, and closed-run mutation.
- Evidence edit, delete, rename, unsafe path, and new-file allowance.
- First commit without 'HEAD'.

Every fixture runs in both staged and worktree modes where the selected repository
state is equivalent. Results and 'GKxxx' codes must match.

### Integration and End-to-End Tests

- Init into clean Git, empty Git, non-Git, custom-hooks, existing-hook, repeated-init,
  forced-refresh, read-only, and interrupted-write fixtures.
- Check proves it invokes the installed canonical validator rather than duplicated
  TypeScript validation.
- Query covers canonical IDs, unique aliases, ambiguous aliases, unknown entities, no
  active claims, correction chains, and mixed source kinds.
- Doctor covers multiple simultaneous errors and warnings, LF/CRLF, empty evidence,
  out-of-bounds ranges, binary input, and paths outside evidence.
- Reviewer fixtures cover grounded, inference-only, unsupported, and superseded facts.
- The populated worked example passes check and doctor and returns the documented
  query result.
- Supported platform CI: Linux, macOS, and Windows through Git Bash; WSL is documented
  and smoke-tested when CI capacity allows.

### Definition of Done for the Plan

- All 57 functional requirements map to at least one planned component and test class.
- All 10 success criteria have a measurement method.
- The canonical validator is present literally and has no duplicate implementation.
- Security-sensitive input never becomes executable.
- Constitution check passes after design.
- No implementation task has started.

## Requirement-to-Component Traceability

| Requirement range | Owning component | Primary verification |
|---|---|---|
| FR-001 through FR-009 | 'init' plus templates | Init integration matrix |
| FR-010 through FR-027 | Schema docs plus validator | Schema and lifecycle fixtures |
| FR-028 through FR-040 | Canonical validator plus check wrapper | Staged/worktree parity suite |
| FR-041 through FR-046 | Query command | Query unit and e2e fixtures |
| FR-047 through FR-050 | Doctor command | Evidence and graph-health fixtures |
| FR-051 through FR-057 | Skill, reviewer, examples, docs | Content contract and walkthrough tests |

## Top Risks and Mitigations

| Risk | Blast radius | Guardrail / mitigation | Kill switch or recovery |
|---|---|---|---|
| jq validator complexity produces false accept/reject results | Every commit using GraphKeeper | Rule-isolated fixtures, staged/worktree parity, stable codes, CI doctor | Bypass only with normal Git hook override under repository-owner control; fix validator without rewriting graph |
| Init damages an existing hook or user data | Adopting repository | Preflight, no-overwrite policy, atomic writes, idempotency matrix | Stop before mutation; restore generated docs from Git; data files never force-refreshed |
| JSON scale or concurrent writers cause latency/conflicts | Large or active repositories | Published 10k ceiling, performance gates, random IDs, Git merge guidance | Disable hook temporarily only by owner; run check/doctor before commit; evaluate future backend |

## Compatibility and Versioning

- Public package starts at 0.1.0, signaling that interfaces may evolve before 1.0.
- CLI command names and exit-code meanings are public contracts.
- Schema version 1 is the stable data contract for v1.
- Linux, macOS, WSL, and Git Bash are supported; native PowerShell is explicitly
  unsupported.
- The package uses ESM and npm. Users are not required to adopt npm for their target
  repository beyond invoking the CLI.

## Post-Design Constitution Recheck

| Gate | Result |
|---|---|
| Grounded source variants remain mandatory | PASS |
| Append-only claims and evidence remain mechanically protected | PASS |
| Entity/run transitions are explicit and testable | PASS |
| One validator remains the enforcement source of truth | PASS |
| Doctor, guidance, and hook responsibilities are labeled | PASS |
| v1 remains local, framework-free, and database-free | PASS |
| Scale ceiling and future path are documented without implementation | PASS |
| Session notes remain outside durable memory | PASS |

## Complexity Tracking

No constitutional violation requires justification. The TypeScript CLI and sh/jq
validator are two runtimes by explicit constitutional design; they share behavior by
invocation, not duplicated validation logic.

## Plan Acceptance Checklist

- [x] Scope, dependencies, non-goals, and ownership are explicit.
- [x] Architecture decisions include alternatives, rationale, trade-offs, and
  reversibility.
- [x] CLI inputs, outputs, errors, idempotency, retries, and timeouts are defined.
- [x] Data contracts, lifecycle, schema evolution, retention, migration, and rollback
  are defined.
- [x] Performance, reliability, security, and cost budgets are measurable.
- [x] Operational readiness, CI, runbooks, release, and rollback are covered.
- [x] Top risks include blast radius, guardrails, and recovery.
- [x] Every specification requirement maps to a component and test class.
- [x] The constitution passes before and after design.
- [x] The plan stops before tasks and implementation.

## Assumptions Recorded by the Plan

- The exact earlier hook source mentioned before planning was not available in the
  repository or visible conversation. The literal script above is therefore the
  canonical implementation derived from the ratified constitution and approved spec.
- Nested evidence directories are allowed when every path remains safely contained.
- Duplicate JSON keys are doctor-enforced rather than hook-enforced because normal jq
  object parsing does not preserve duplicates.
- A run opens with empty 'evidence' and 'claims_written' arrays; 'task' may be added
  once while the run is open.
- Known entities with no active claims return a successful empty result; an unknown
  entity is a distinct not-found result.
- Orphan entities are warnings, while dangling references are errors.
