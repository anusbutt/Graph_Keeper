# Benchmark prompts and invocations

## Shared prompt

Session 1 and Session 2 received exactly the same prompt:

> Explore this repository and determine where authentication is implemented and how
> it works. Preserve useful durable knowledge according to the repository's existing
> memory workflow; you may update and commit memory files. Do not modify application
> code.

The prompt authorizes repository-memory writes without mentioning existing memory,
staleness, the file move, supersession, or the expected result.

## Invocation controls

Each behavioral session was a separate invocation equivalent to:

```sh
codex exec \
  --ephemeral \
  --ignore-user-config \
  --json \
  --approve-for-me \
  -C <isolated-fixture> \
  "<shared-prompt>"
```

The candidate package's `node_modules/.bin` directory was prepended to `PATH`, making
the tested local `graphkeeper` executable available to each session. No `resume` or
`fork` command was used.

`--approve-for-me` supplied the workspace-write sandbox. An initial pre-session launch
combined it with an explicit `--sandbox workspace-write`; CLI 0.153.0 rejected that
combination before starting a thread. The retained launch-error log records this
operational correction.

## Fixture states

Session 1 state:

```text
src/auth.ts
```

Session 2 state:

```text
src/security/auth.ts
```

The file contents were unchanged. The intervening Git commit was named
`refactor module layout`; GraphKeeper memory was not updated before Session 2.
