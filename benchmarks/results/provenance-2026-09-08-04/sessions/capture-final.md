Incoming data flows through `handleRequest` → `validateInput(request.body)` → `processInput(validatedInput)`.

- Validation rejects null, non-object, or array bodies and non-string or blank messages.
- It returns only the trimmed message.
- Processing returns `{ status: 'accepted', message }`.

Source evidence: `evidence/request-flow-source.txt#L5-L7`, `evidence/request-flow-source.txt#L9-L12`, `evidence/request-flow-source.txt#L13-L15`, `evidence/request-flow-source.txt#L16-L16`, `evidence/request-flow-source.txt#L18-L20`.

Committed memory as `292fc36`, with 11 active atomic, source-backed claims. GraphKeeper check and doctor passed. Application code is unchanged; working tree is clean.
