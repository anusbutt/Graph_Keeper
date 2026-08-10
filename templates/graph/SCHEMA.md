# GraphKeeper Record Contract

GraphKeeper stores durable memory in three top-level JSON arrays:
graph/entities.json, graph/claims.json, and graph/runs.json. Unknown fields are
rejected. All IDs are unique within their record array. All timestamps use valid
whole-second ISO 8601 UTC in the form YYYY-MM-DDTHH:MM:SSZ.

## Enforcement labels

[HOOK] means the canonical fast validator enforces the rule during commit and
graphkeeper check. [DOCTOR] means graphkeeper doctor performs the slower physical
evidence check. [GUIDANCE] means the rule is a behavioral boundary for the human or
agent writing memory.

## Claim fields

| Field | Type | Required | Rule | Enforcement |
|---|---|---:|---|---|
| id | string | yes | Matches claim_[0-9a-f]{8}; generate eight random lowercase hex characters. | [HOOK] |
| subject | string | yes | Resolves to an id already present in entities.json. | [HOOK] |
| predicate | string | yes | Non-empty lowercase snake_case relation label. | [HOOK] |
| object | string | yes | Non-empty plain string, never an array or nested object. | [HOOK] [GUIDANCE] |
| confidence | number | no | Inclusive numeric range from 0 through 1. | [HOOK] |
| source | object | yes | Exactly one source variant described below. | [HOOK] |
| produced_by | string | yes | Resolves to an id already present in runs.json. | [HOOK] |
| supersedes | string | no | Resolves to one earlier claim; one successor only and no cycle. | [HOOK] |
| created | string | yes | Valid whole-second UTC timestamp. | [HOOK] |

[GUIDANCE] Keep predicate and object short and canonical. Put structured detail,
stack traces, diagnostics, and large values in evidence; object remains a plain string.

### Tool-output source

[HOOK] A tool_output source contains exactly kind, command, exit_code, ref, and
captured. kind equals tool_output; command is a non-empty string; exit_code is an
integer from 0 through 255; captured is a whole-second UTC timestamp; ref is a
canonical evidence reference.

    {
      "kind": "tool_output",
      "command": "npm test -- payments",
      "exit_code": 1,
      "ref": "evidence/triage.log#L1-L3",
      "captured": "2026-07-21T09:14:22Z"
    }

### Inference source

[HOOK] An inference source contains exactly kind and optional basis. kind equals
inference. basis, when present, is a non-empty string. An inference must not include
command, exit_code, ref, or captured because it has no external artifact.

    {
      "kind": "inference",
      "basis": "Repeated timeouts suggest dependency latency."
    }

[GUIDANCE] Inference is honest reasoning, not external proof. Do not disguise an
inference as tool output or invent an evidence reference.

## Entity fields

| Field | Type | Required | Rule | Enforcement |
|---|---|---:|---|---|
| id | string | yes | Unique human-readable lowercase snake_case slug. | [HOOK] |
| type | string | yes | Non-empty lowercase snake_case category. | [HOOK] |
| aliases | string array | yes | Unique non-empty exact aliases; existing entries are never removed. | [HOOK] |
| source_docs | string array | no | Unique evidence references; existing entries are never removed. | [HOOK] |
| first_seen | string | yes | Valid whole-second UTC timestamp that never changes. | [HOOK] |

[HOOK] Entity id, type, and first_seen form immutable identity after commit. aliases
and source_docs are append-only sets.

[GUIDANCE] Search canonical IDs and exact aliases before adding an entity. Reuse one
exact match. If an alias matches more than one entity, do not guess.

## Run fields

| Field | Type | Required | Rule | Enforcement |
|---|---|---:|---|---|
| id | string | yes | Matches run_<ISO-date>-<unique-lowercase-suffix>. | [HOOK] |
| started | string | yes | Valid whole-second UTC timestamp. | [HOOK] |
| tool | string | yes | Non-empty generic harness label. | [HOOK] |
| task | string | no | Non-empty when present; may be added once while open. | [HOOK] |
| evidence | string array | yes | Unique evidence paths; growth-only while open. | [HOOK] |
| claims_written | string array | yes | Unique claim IDs; growth-only while open. | [HOOK] |
| ended | string | on close | UTC timestamp not earlier than started. | [HOOK] |
| verdict | string enum | on close | passed, failed, inconclusive, or aborted. | [HOOK] |

[HOOK] Open runs omit both ended and verdict. Closing adds both exactly once. Closed
runs are immutable. Every claim and its producing run reference each other. A
tool-output claim's evidence file also appears in the producing run's evidence array.

## Evidence references

[HOOK] The reference shape is evidence/<path>#L<start>-L<end>. Line numbers contain
digits and are inclusive and one-based by contract. The repository path starts with
evidence/, contains no whitespace or #, and has no empty, . or .. segment. The hook
checks only shape and safe path segments; it does not open the target.

[DOCTOR] Doctor checks that the evidence file exists, stays physically contained below
evidence/, is line-addressable text, and that the line range is positive, ordered, and
within the actual line count.

[GUIDANCE] When reporting retrieved memory, reproduce source.ref exactly in its
repository-relative evidence/<path>#L<start>-L<end> form. Do not replace it with an
absolute host path, which is non-portable and is not the canonical reference.

[DOCTOR] Duplicate JSON object keys are invalid and are detected from raw JSON by
doctor. Ordinary parsed-object validation cannot preserve duplicate keys.

[HOOK] Committed claims and evidence are immutable. Entity growth and run transitions
follow the rules above. Correct a claim by appending a new claim with supersedes.

## Coherent examples

The Example run lifecycle below shows both legal shapes and how claim provenance
connects to captured evidence.

### Example entity

    {
      "id": "test_payments_flaky",
      "type": "test",
      "aliases": ["payments test"],
      "source_docs": ["evidence/triage.log#L1-L3"],
      "first_seen": "2026-07-21T09:14:22Z"
    }

### Example open run

[HOOK] An open run omits both ended and verdict. It normally starts with empty
evidence and claims_written arrays; those sets may only grow while the run remains
open.

    {
      "id": "run_2026-07-21-triage_a1",
      "started": "2026-07-21T09:14:22Z",
      "tool": "coding_agent",
      "task": "triage payments test",
      "evidence": [],
      "claims_written": []
    }

### Example closed run

[HOOK] A closed run adds ended and verdict together. After commit, the entire closed
run is immutable, including its identity, task, evidence, and claims_written sets.

    {
      "id": "run_2026-07-21-triage_a1",
      "started": "2026-07-21T09:14:22Z",
      "tool": "coding_agent",
      "task": "triage payments test",
      "evidence": ["evidence/triage.log"],
      "claims_written": ["claim_0a1b2c3d", "claim_1a2b3c4d"],
      "ended": "2026-07-21T09:16:22Z",
      "verdict": "inconclusive"
    }

### Allowed verdicts

- `passed`: the run completed and its intended check passed.
- `failed`: the run completed and its intended check failed.
- `inconclusive`: the available result cannot support a conclusive verdict.
- `aborted`: the run stopped before it could complete.

[GUIDANCE] A verdict describes the producing run and its stated task, not the overall
status of the claim subject or repository. For example, passed on a test-discovery run
means discovery completed successfully; it does not mean the project test suite passed.

[GUIDANCE] An inconclusive or aborted run may have no claims. Never invent a successful
claim merely to populate claims_written.

### Example tool-output claim

    {
      "id": "claim_0a1b2c3d",
      "subject": "test_payments_flaky",
      "predicate": "has_failure",
      "object": "timeout_failure",
      "confidence": 1,
      "source": {
        "kind": "tool_output",
        "command": "npm test -- payments",
        "exit_code": 1,
        "ref": "evidence/triage.log#L1-L3",
        "captured": "2026-07-21T09:14:22Z"
      },
      "produced_by": "run_2026-07-21-triage_a1",
      "created": "2026-07-21T09:15:22Z"
    }

### Example inference claim

    {
      "id": "claim_1a2b3c4d",
      "subject": "test_payments_flaky",
      "predicate": "likely_cause",
      "object": "dependency_latency",
      "source": {
        "kind": "inference",
        "basis": "The observed timeout pattern is consistent with dependency latency."
      },
      "produced_by": "run_2026-07-21-triage_a1",
      "created": "2026-07-21T09:15:52Z"
    }

### Evidence provenance

[HOOK] For a tool-output claim, `source.ref` names exact inclusive lines and its
`produced_by` run lists the same file path in `evidence`. The run also lists the claim
ID in `claims_written`, and the claim points back to that run. For example,
`evidence/triage.log#L1-L3` belongs to `run_2026-07-21-triage_a1`, whose evidence set
contains `evidence/triage.log` and whose claims_written set contains
`claim_0a1b2c3d`.

[HOOK] Two claims may cite overlapping ranges in one evidence file. That overlap is
valid because each claim independently identifies the lines supporting it; the run
lists the evidence path only once.
