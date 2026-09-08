Request data flows through `handleRequest` → `validateInput(request.body)` → `processInput(validatedInput)`.

- Validation rejects null, non-object, or array bodies. Messages must be strings and nonempty after trimming.
- Validation returns only the trimmed message.
- Processing returns `{ status: 'accepted', message: input.message }`. Validation errors prevent processing.

Source evidence: `evidence/request_flow_handler.txt#L4-L6`, `evidence/request_flow_validation.txt#L2-L4`, `evidence/request_flow_validation.txt#L5-L7`, `evidence/request_flow_validation.txt#L8-L8`, `evidence/request_flow_processor.txt#L1-L3`.

Committed memory as `d03d0be`, with 12 active, independently changeable, source-backed claims. GraphKeeper check and doctor passed. Application code is unchanged; working tree is clean.
