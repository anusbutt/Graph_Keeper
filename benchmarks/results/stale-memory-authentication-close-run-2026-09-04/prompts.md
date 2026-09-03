# Benchmark prompt and invocation

Both sessions received exactly this prompt:

> Explore this repository and determine where authentication is implemented and how
> it works. Preserve useful durable knowledge according to the repository's existing
> memory workflow; you may update and commit memory files. Do not modify application
> code.

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

The candidate package's `node_modules/.bin` directory was prepended to `PATH`. No
resume, fork, prior transcript, stale-memory hint, module-move hint, supersession hint,
or expected result was supplied.

Session 1 saw `src/auth.ts`. Before Session 2, the benchmark moved that file unchanged
to `src/security/auth.ts` and committed the move without updating memory.
