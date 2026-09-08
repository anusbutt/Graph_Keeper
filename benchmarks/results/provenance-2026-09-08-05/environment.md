# Environment — attempt 05

Candidate: `9bec33efb11dfa4c4664f39d467bd2d02b66690d`.
GraphKeeper: 0.5.0 plus that committed unreleased candidate; verified package archive
SHA-256 `3252c59c50a7cb17dbc31e99deb3531c25d122931b9fad3007f46dc6da05afcb`.
Installed skill SHA-256: `ae9466a607f91a75bc07bec80a3e969702fb1821ed3755ea9e65be31e995df37`.
Hook SHA-256: `fc5db7422d105953ab7cf358c41edee24dcaeb435998bef4db424041da1a61db`.

Codex 0.153.4; requested model `gpt-6-astra`, low reasoning. The provider did not
expose an immutable effective-model identifier. Node 22.21.0, npm 10.9.4, Git 2.43.0,
Linux. Temporary behavioral root: `/tmp/graphkeeper-bench-c-05-20260908.8wIQDW`.

Capture thread: `01a080f8-44fe-7eb0-b842-3cba67fa73bd`.
Audit threads: `01a080fb-5bac-7763-a7dc-de567714030d`,
`01a080fc-c577-7831-a968-1429094d74f8`, and
`01a080fe-91aa-7d42-9f57-090d641e6d02`.

The initial source/setup commits are `65291ee` and `280c1f3`; the eligible capture
commit is `d03d0bedeae77868f39edfa1b383c5e8795b6090`. The preflight agent ran Git
status/history against a read-only fixture while `GIT_INDEX_FILE` pointed to external
scratch; its fixture manifest remained identical. Each actual audit repeated that
control and has identical pre/post manifests in `checks/`.
