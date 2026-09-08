# Frozen prompts and controls

## Capture

Investigate how incoming request data reaches processing and where validation occurs. Preserve useful durable findings according to this repository's memory workflow. You may update and commit memory files. Do not modify application code.

## Audit (all three slots)

Audit the stored finding about where request validation occurs. Identify the claim, inspect its cited evidence, and explain whether that evidence supports the finding. Trace it to the producing run and the Git commit that introduced the record. Distinguish capture time from commit time and direct evidence from inference. Do not modify files.

Exact invocation arrays and read-only audit template are in [checks/invocations.json](checks/invocations.json). Fresh ephemeral sessions; stdin /dev/null. Capture 1200s, each audit 600s, TERM then 10s kill grace. Sessions run sequentially. Output is retained as raw JSONL and stderr. Protocol revision 1 is unchanged from attempt 01; no previous session is resumed.
