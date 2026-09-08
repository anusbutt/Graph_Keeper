# Frozen revision 2 prompts

## Capture

Investigate how incoming request data reaches processing and where validation occurs. Preserve useful durable findings according to this repository's memory workflow. You may update and commit memory files. Do not modify application code. Before saving, check that each claim states one independently changeable fact and split compound findings into separate claims.

## Audit (identical in all three slots)

Audit the stored finding about where request validation occurs. Identify the claim, inspect its cited evidence, and explain whether that evidence supports the finding. Trace it to the producing run and the Git commit that introduced the record. Distinguish capture time from commit time and direct evidence from inference. Do not modify files.

[Exact argv](checks/invocations.json) records fresh ephemeral execution, stdin /dev/null, capture 1200s and audit 600s limits with TERM +10s kill grace. Slots are sequential. No resume, fork, hand repair or behavioral retry. Compared with revision 1, the generic self-check sentence is added; no target answer or claim ID is supplied. This is a prompt-assisted configuration, not an unchanged replication.
