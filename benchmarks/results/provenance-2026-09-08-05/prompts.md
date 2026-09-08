# Frozen prompts and launch controls

## Capture

> Investigate how incoming request data reaches processing and where validation occurs.
> Preserve useful durable findings according to this repository's memory workflow.
> You may update and commit memory files. Do not modify application code.
> Before saving, check that each claim states one independently changeable fact and
> split compound findings into separate claims.

## Audit — identical for slots 1–3

> Audit the stored finding about where request validation occurs. Identify the claim,
> inspect its cited evidence, and explain whether that evidence supports the finding.
> Where the evidence contains both an import and an invocation, explain how they relate
> to the finding rather than leaving that relationship implicit.
> Trace it to the producing run and the Git commit that introduced the record.
> Distinguish capture time from commit time and direct evidence from inference.
> Do not modify files.

All sessions used fresh ephemeral Codex threads, requested `gpt-6-astra` at low
reasoning effort, no approvals, disabled web/apps/plugins/memory/multi-agent/browser/
computer/image tools, a sanitized shell environment, and the active deny-all network
proxy inherited from the accepted preflight. Capture could write only its disposable
fixture. Each auditor could read only its own fixture and Git directory, with a
dedicated writable `GIT_INDEX_FILE` scratch path outside that fixture.
