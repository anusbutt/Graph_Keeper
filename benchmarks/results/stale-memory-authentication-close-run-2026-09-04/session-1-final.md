Authentication is entirely implemented in [src/auth.ts](/var/tmp/graphkeeper-bench-b-close-run.C4roOO/fixture/src/auth.ts:1):

- `authenticate(token: string): boolean` is the sole authentication entry point.
- It returns `true` only when `token === "valid-token"`.
- Every other value is rejected.
- There are no sessions, passwords, JWTs, OAuth flows, middleware, databases, or cryptographic verification.

Durable GraphKeeper knowledge was recorded with source evidence at `evidence/authentication_implementation_20260903.ts#L1-L3`. Both `graphkeeper check` and `graphkeeper doctor` passed.

Memory-only commit created: `7eade35 docs(memory): record authentication implementation`. The working tree is clean, and no application code was modified.
