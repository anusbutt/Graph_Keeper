# Frozen prompts and controls

## Capture

Investigate how incoming request data reaches processing and where validation occurs. Preserve useful durable findings according to this repository's memory workflow. You may update and commit memory files. Do not modify application code.

## Audit (all three slots)

Audit the stored finding about where request validation occurs. Identify the claim, inspect its cited evidence, and explain whether that evidence supports the finding. Trace it to the producing run and the Git commit that introduced the record. Distinguish capture time from commit time and direct evidence from inference. Do not modify files.

Exact argv and filesystem controls: [invocations](checks/invocations.json). Fresh ephemeral sessions, stdin /dev/null, sequential capture (1200s limit) and audits (600s each); TERM then 10s kill grace. No previous thread is resumed. Settings and rubric are unchanged from attempts 01/02.
