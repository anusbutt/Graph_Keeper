# Relevant prompts

## Original finding prompt

> Why does the homepage Playwright test scroll each main project card into view and
> then poll its computed opacity until it exceeds 0.99?

## GraphKeeper recording prompt

> You said you were preserving the verified finding in GraphKeeper, but
> graph/claims.json and graph/runs.json are still empty and evidence/ contains no
> files. Use $graphkeeper now to actually record the verified finding with appropriate
> evidence and provenance. Do not change application code.

## Repeated-investigation prompt

The control and GraphKeeper sessions received the same task text:

> Investigate the homepage project opacity behavior and determine whether the opacity
> poll is still part of the current implementation or legacy behavior.

The GraphKeeper workspace additionally supplied this repository guidance before the
task:

> Before repeating repository investigation, invoke `$graphkeeper` to check existing
> durable findings. Record new durable, evidence-backed findings through that skill.
