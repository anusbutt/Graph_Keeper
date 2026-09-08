The stored finding is supported at its stated scope: **`handleRequest` passes `request.body` to `validateInput`.**

- **Claim:** `claim_85b5617c` in `graph/claims.json`, subject `request_handler`, predicate `validates`. It is recorded as `tool_output`, confidence `1`, and has no superseding claim.
- **Cited evidence:** `evidence/request-flow-source.txt#L5-L6` directly shows:
  ```js
  export function handleRequest(request) {
    const input = validateInput(request.body);
  ```
  These are evidence-file line numbers; the embedded source numbers are 4–5.
- **Scope:** That citation proves the call and argument. The broader conclusion that validation occurs before processing also uses `evidence/request-flow-source.txt#L5-L7`, cited by companion claim `claim_c4a5f82f`. The actual validation checks appear in `evidence/request-flow-source.txt#L9-L15`, corresponding to `src/validation.js`. This is source evidence, not an observed request execution or proof that every application entry point validates input.

The producing run is **`run_2026-09-08-request_flow`**, using tool identity `coding_agent`, with task “Investigate request data flow and validation; preserve atomic source-backed findings.” Provenance is bidirectional: the claim names the run, and the run lists both the claim and its evidence file. Its `passed` verdict describes that investigation’s outcome, not a passing application test suite.

| Event | UTC time, 2026-09-08 |
|---|---|
| Recorded evidence capture and run start | 11:44:48 |
| Claim creation | 11:45:13 |
| Producing run end | 11:45:14 |
| Introducing commit’s author and committer time | 11:45:34 |

Git’s addition diff confirms that **`292fc3620f7b197a15ff6a47e4fd0be016262a2e`**, “Record request flow and atomic validation findings,” introduced the claim, run, and evidence together. Git displays its timestamp as `16:45:34 +0500`, equivalent to `11:45:34Z`—46 seconds after the recorded capture.

Evidence line 1 contains **`beb383cf729b0863912bae23abcbb4abaf34bcca`**, the recorded capture-time HEAD and the introducing commit’s parent. That hash alone does not prove the captured working tree was clean; however, the inspected source matches the capture, and Git reports no changes to those source files between that parent and current HEAD.

Capture time is stored metadata, corroborated by `evidence/request-flow-capture.json`; commit time is separate Git metadata. The source directly supports the narrow claim. Broader architectural guarantees would be inference. No files were modified.
