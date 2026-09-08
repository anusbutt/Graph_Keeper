# Exact prompts and invocation controls

Frozen before capture on 2026-09-07. Prompts are passed as a single argument, with
whitespace normalized to one space between sentences; stdin is /dev/null.

## Capture

> Investigate how incoming request data reaches processing and where validation occurs. Preserve useful durable findings according to this repository's memory workflow. You may update and commit memory files. Do not modify application code.

## Audit (three identical slots)

> Audit the stored finding about where request validation occurs. Identify the claim, inspect its cited evidence, and explain whether that evidence supports the finding. Trace it to the producing run and the Git commit that introduced the record. Distinguish capture time from commit time and direct evidence from inference. Do not modify files.

## Controls

The full literal argument arrays are in [invocations.json](checks/invocations.json).
All sessions use codex-cli 0.153.4, requested model gpt-6-astra, reasoning low,
--ephemeral, --ignore-user-config, --ignore-rules, and JSON event output. No resume,
fork, capture transcript, scorer answer, or earlier audit output is provided.

Commands execute under an explicit named filesystem profile with no tool network
access and approval_policy=never. Web search, apps, plugins, memories, multi-agent,
browser/computer use, image generation, and shell snapshots are disabled. Host skill
discovery is skipped; the fixture's canonical GraphKeeper skill is available.

Read roots: minimal OS runtime, /usr/local, the exact installed Codex binary directory,
the installed GraphKeeper tooling directory, and the individual fixture. Capture
gets write access to its fixture and explicitly to its .git; audit fixtures are read
only. Evaluator data and every other session's fixture/output are outside read roots.
The tool environment is restricted to the recorded PATH, Git config controls, and locale.

The operator launches Codex outside the parent execution sandbox because nested
sandbox mounts and Git subprocesses were blocked there. Codex's narrower benchmark
profile remains enforced; neither bypass mode nor automatic approval is used.
The process transport uses existing authentication; credentials are not passed to
agent shell tools or copied into results.

The capture is bounded by timeout 1200s, audits by timeout 600s, with TERM and a
10-second kill grace period. These limits do not score execution speed.
