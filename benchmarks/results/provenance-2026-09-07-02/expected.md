# Evaluator expectation (defined before capture)

The request handler imports validateInput from ./validation.js and calls it on
request.body. The call's return value is passed to processInput. The required atomic
target is the handler's delegation of validation to the imported validateInput
function; no claim about security or validation completeness is needed.

An eligible tool-output claim cites a saved artifact showing both the import and
call in handler.js. The evaluator will compare its bytes with the capture session's
observed output and verify the producer/claim/evidence links and introducing commits.

No claim/run IDs are preassigned. Equivalent eligible target claims are handled by
the protocol's preregistered rule. The agent receives no copy of this file; it remains
outside the allowed filesystem reads and will be included in the final public record.
