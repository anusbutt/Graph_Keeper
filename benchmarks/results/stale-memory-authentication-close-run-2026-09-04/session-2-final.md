Authentication is implemented in [`src/security/auth.ts`](/var/tmp/graphkeeper-bench-b-close-run.C4roOO/fixture/src/security/auth.ts:1).

It exports `authenticate(token: string): boolean`, which returns `true` only when the token is strictly equal to the hard-coded string `"valid-token"`. There is no session handling, hashing, token decoding, expiry validation, middleware, or other authentication integration. No callers exist elsewhere in the current repository.

GraphKeeper memory was corrected because the previous location (`src/auth.ts`) became stale after a module-layout refactor:

- Current location evidence: `evidence/authentication_implementation_20260904.ts#L1-L3`
- Existing behavior evidence: `evidence/authentication_implementation_20260903.ts#L1-L3`
- Validation: `graphkeeper check` and `graphkeeper doctor` passed with no warnings.
- Memory-only commit: `452fd50` (`memory: update authentication module location`)

No application code was modified.
