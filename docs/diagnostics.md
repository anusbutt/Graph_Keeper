# Diagnostic reference

GraphKeeper diagnostics use `GKnnn` codes so failures remain searchable across the CLI,
repository validator, Git hook, and `doctor`. The text in brackets identifies the
record, file, alias, or evidence reference that needs attention.

`src/lib/errors.ts` defines the stable exit codes. `src/lib/validation.ts` is the
canonical fast-validator source, and the generated `scripts/validate.mjs` mirrors it.
The legacy `scripts/validate.sh` is a compatibility fallback.

Before repairing a validation failure, preserve GraphKeeper's append-only rules. Restore
changed committed claims or evidence, then append a superseding claim or new evidence
instead of rewriting history. Run `graphkeeper check` after a repair and
`graphkeeper doctor` when evidence or cross-record relationships are involved.

## Exit codes

| Exit | Class | Meaning |
|---|---|---|
| `0` | Success | The command completed. `doctor` also uses `0` when it reports warnings but no errors. |
| `1` | Validation | Graph data, provenance, evidence, or query resolution is invalid. |
| `2` | Usage | Command grammar, arguments, validator mode, or required confirmation is invalid. |
| `3` | Prerequisite | A required executable such as Git, Node.js, npm, or legacy `sh`/jq is unavailable. |
| `4` | Operational | GraphKeeper could not safely read, write, compare, spawn, integrate, or contact a required service. |
| `5` | Internal | A child validator returned an exit code outside GraphKeeper's public range. |

## CLI and runtime diagnostics

| Code | Emitted by | Meaning and safe recovery |
|---|---|---|
| `GK002` | CLI and standalone validator | Invalid command arguments, validator mode, or non-interactive confirmation. Run `graphkeeper --help`, correct the arguments, and use `--yes` or `--dry-run` when confirmation cannot be interactive. |
| `GK003` | `init`, `check`, `update`, and standalone validator | A named prerequisite is missing. Install or restore the named tool, confirm it is on `PATH`, and retry. A customized legacy validator may require POSIX `sh` and jq 1.6 or newer. |
| `GK004` | All repository-mutating commands, `check`, `query`, `doctor`, `update`, and validator loading | An operation could not be completed safely. Follow the specific message: restore access or a missing generated validator, repair malformed integration markers, retry a timed-out process or registry request, and rerun without bypassing ownership checks. |
| `GK005` | `check` | The repository validator returned an unexpected exit code. Preserve its preceding output, rerun once, and report a reproducible failure if it persists. |
| `GK400` | `append` | A concurrent write did not stabilize, or a lock on a graph file could not be acquired. Nothing was written and no record was lost; reduce concurrent appends to the same file or retry. |
| `GK401` | `append` | The claim or run input is invalid or cannot satisfy provenance: unknown subject, missing/closed producing run, duplicate ID, or a record that fails existing schema rules. Correct the input and retry; the graph was not modified. |

`GK002`, `GK003`, `GK004`, and `GK005` map to exit codes `2`, `3`, `4`, and `5`
respectively. `GK400` maps to exit code `4` (operational); `GK401` maps to exit code `1` (validation).

## Fast validation diagnostics

These codes are emitted by the Node validator used by `graphkeeper check`, `query`,
`doctor`, and the installed pre-commit hook. Each is a validation failure with exit
code `1`.

| Code | Meaning | Safe recovery |
|---|---|---|
| `GK101` | A required graph JSON file is missing from the worktree or staged snapshot. | Restore the named file, run `graphkeeper init` for a missing scaffold, or add and stage the required file. |
| `GK102` | A graph document is not valid JSON. | Restore a valid JSON array and rerun validation. |
| `GK110` | Entity schema or entity-ID uniqueness is invalid. | Correct the named records, keep IDs unique, and preserve committed identity fields; aliases and `source_docs` may only grow. |
| `GK120` | Claim schema, claim-ID uniqueness, or source shape is invalid. | Correct uncommitted records. For a committed conclusion, restore it and append a valid superseding claim. |
| `GK130` | Run schema, run-ID uniqueness, or lifecycle is invalid. | Correct uncommitted records; only grow an open run, close it once, and never mutate a committed closed run. |
| `GK140` | References, bidirectional provenance, or the supersession graph is invalid. | Repair missing links in both directions and keep supersession to one acyclic successor. Restore committed records before appending a correction. |
| `GK150` | The committed `HEAD` graph cannot be parsed as JSON. | Inspect the committed baseline, restore valid graph JSON through a reviewed history repair, then validate new work against that baseline. |
| `GK151` | A committed claim changed or was removed. | Restore the claim byte-for-byte at the data-model level and append a new claim with `supersedes`. |
| `GK152` | Committed entity identity changed, or an alias/source-document value was removed. | Restore identity and removed accumulated values; only append aliases or `source_docs`. |
| `GK153` | An open run made a non-growth transition, or a committed closed run changed. | Restore the run; grow only allowed open-run fields and close the run exactly once. |
| `GK154` | Committed evidence changed, was deleted, or was renamed. | Restore the original evidence path and contents, then capture new output in a new evidence file. |

## Query diagnostics

Both query codes use exit code `1` after fast validation succeeds.

| Code | Emitted by | Meaning and safe recovery |
|---|---|---|
| `GK201` | `query` | An alias resolves to more than one entity. Query one of the listed canonical IDs; do not remove a committed alias to force uniqueness. |
| `GK202` | `query` | No entity matches the exact ID or alias. Check the spelling, use a known canonical ID, or add a valid entity before querying it. |

## Doctor diagnostics

`doctor` includes all fast-validator diagnostics, then performs duplicate-key, evidence,
and graph-reference checks. Codes `GK300` through `GK325` are errors and produce exit
code `1`. `GK390` is a warning and does not fail an otherwise healthy doctor run.

| Code | Meaning | Safe recovery |
|---|---|---|
| `GK300` | A graph document became unreadable after fast validation. | Restore file access and rerun; if another process is changing the graph, stop it before retrying. |
| `GK301` | A graph document contains a duplicate JSON key. | Keep one intended key/value in the uncommitted record and rerun both check and doctor. |
| `GK310` | An evidence reference has the wrong shape, is unsafe, or resolves outside `evidence/`. | Use `evidence/<file>#L<start>-L<end>` with a contained repository-relative path. |
| `GK311` | Referenced evidence does not exist. | Restore the referenced file or, for new work, capture it and update the uncommitted reference. |
| `GK312` | Evidence cannot be read. | Restore read permission and ensure the path is an accessible regular file. |
| `GK313` | Evidence is not a regular UTF-8 text file or contains binary control bytes. | Capture inert UTF-8 text in a regular file and reference that file instead. |
| `GK314` | An evidence line range starts below line 1. | Change the uncommitted range so its start is at least 1. |
| `GK315` | An evidence range starts after it ends. | Put the inclusive start before or at the inclusive end. |
| `GK316` | An evidence range ends past the file's logical line count. | Recount the file and use an in-bounds inclusive range. |
| `GK320` | A claim subject does not resolve to an entity. | Add the missing entity or correct the uncommitted subject ID. |
| `GK321` | A claim's `produced_by` run does not exist. | Add the producing run or correct the uncommitted run ID. |
| `GK322` | A claim's `supersedes` target does not exist. | Point to the actual predecessor claim and preserve an acyclic correction chain. |
| `GK323` | A run's `claims_written` entry names no claim. | Add the claim or remove the invalid uncommitted run entry. |
| `GK324` | A run lists a claim whose `produced_by` names another run. | Make the uncommitted claim and run agree on one producer. |
| `GK325` | A claim names a producing run that does not list the claim. | Add the claim ID to the matching open run's `claims_written` list before it is committed closed. |
| `GK390` | An entity is not referenced by any claim. | No action is required if intentional; otherwise record a grounded claim through a run. Do not delete a committed entity merely to silence the warning. |
