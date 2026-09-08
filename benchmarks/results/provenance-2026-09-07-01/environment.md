# Benchmark environment and identities

Experiment: provenance-2026-09-07-01. Protocol revision: 1.
Date: 2026-09-07, Asia/Karachi; recorded capture timestamps use UTC.

- Candidate source: 9bec33efb11dfa4c4664f39d467bd2d02b66690d.
- Package: graphkeeper 0.5.0 plus committed unreleased close/help changes.
- Package SHA-256: 3252c59c50a7cb17dbc31e99deb3531c25d122931b9fad3007f46dc6da05afcb.
- Installed canonical skill SHA-256: ae9466a607f91a75bc07bec80a3e969702fb1821ed3755ea9e65be31e995df37.
- Frozen protocol SHA-256: 8492277ff8cec88528fd5706bb370a141708120401db15fff8ba89b72b32b685.
- Initial application commit: 5599054 (full identity retained in setup history).
- Initialized empty-memory commit: af35db3a9a1e9f7d322cb06ab62a254a52d1158c.
- Codex CLI: 0.153.4, standalone Linux x86_64 musl distribution.
- Requested model: gpt-6-astra, reasoning low. This is the installed bundled catalog's
  highest-priority model; the model alias is pinned for all observations. An immutable
  provider backend snapshot is not exposed and is not claimed.
- Node: v22.21.0. npm: 10.9.4. Git: 2.43.0. Host: Linux.
- Temporary root: /tmp/graphkeeper-bench-c-20260907.aJM0YZ.
- Source/build: /tmp/graphkeeper-bench-c-20260907.aJM0YZ/source (detached candidate; npm ci).
- Package/install: /tmp/graphkeeper-bench-c-20260907.aJM0YZ/tooling; no tarball or dependencies are included here.
- Capture: /tmp/graphkeeper-bench-c-20260907.aJM0YZ/capture. Audit copies: audit-1, audit-2, audit-3 under that root.
- Operator: implementation-session Codex; manual scorer. No separate human review
  has yet occurred.

## Preflight observations

A normal parent-sandbox initialization reached the real Git hook but Git spawning
failed with EPERM. Repeating setup outside that parent restriction succeeded.
The initial focused tests also failed there; their unchanged rerun passed all 17
checks. Both test outputs are retained. These were setup checks, not behavioral slots.

The first nested Codex sandbox probe could not create its mount-registry lock.
Outside the parent sandbox, a profile without the Codex binary read root could not
start; adding that exact executable directory fixed startup. The first capture
write profile still protected .git; explicitly granting write access to that exact
fixture .git fixed the authorization needed for memory commits. All adjustments
preceded capture. No behavioral retry or weakened evaluator read boundary occurred.

The successful read-only operator probe read handler.js, failed to read the existing
operator expected.md and product README (hidden mounts return ENOENT), and failed a
fixture write with EROFS. The successful capture probe wrote/deleted dummy files in
its disposable preflight worktree and .git, and could not read evaluator expected.md.

A separate real-agent preflight, thread 01a07c06-0d0c-74c1-b8eb-b602740f9f6f, read
package/skill, completed check/doctor, and saw both forbidden operations fail. Its
logs are under checks/ and are excluded from capture/audit tallies. The operator
confirmed the outside targets exist, so ENOENT inside the mount namespace is hiding,
not an absent host file. The profile uses Codex's Linux bubblewrap sandbox.

## Documentation consulted

Runtime setup followed the [official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
and [non-interactive execution documentation](https://learn.chatgpt.com/docs/non-interactive-mode),
then the installed CLI help and actual preflight. The OpenAI Docs skill guided that
verification; documented options alone were not counted as successful isolation.

The pre-capture identity record above was fixed before execution. Final session IDs,
operator-observed start/end times, exits, and outcomes are in attempts.json and the
result report. Capture was externally interrupted by the account usage limit;
no audit sessions ran. An account error suggested trying again at 9:06 PM, but that
is not a guaranteed reset time or authorization to purchase capacity.
