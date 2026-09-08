Request flow is `handleRequest(request)` → `validateInput(request.body)` → `processInput(validatedInput)`.

- Validation rejects null, arrays, non-object bodies, and messages that aren’t nonempty strings after trimming.
- It returns a fresh `{ message: trimmedMessage }`, dropping extra fields.
- Processing returns `{ status: 'accepted', message }` without further validation. Direct processor calls bypass validation.
- Validation errors propagate to the caller.

Preserved five source-backed GraphKeeper claims and captured evidence. Representative runtime checks, `graphkeeper check`, and `graphkeeper doctor` passed. Application code is unchanged.

Memory changes are staged, but the commit hook failed because its Git subprocess was denied (`spawnSync git EPERM`); no commit was created.
