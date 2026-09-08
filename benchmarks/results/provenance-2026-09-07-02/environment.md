# Environment — attempt 02

Protocol revision 1; new empty-memory capture authorized after the user reported reset capacity. Attempt 01 remains unchanged.

Candidate: 9bec33efb11dfa4c4664f39d467bd2d02b66690d; graphkeeper 0.5.0 with committed unreleased changes.
Verified package SHA256: 3252c59c50a7cb17dbc31e99deb3531c25d122931b9fad3007f46dc6da05afcb.
Canonical installed skill SHA256: ae9466a607f91a75bc07bec80a3e969702fb1821ed3755ea9e65be31e995df37.
Protocol SHA256: 8492277ff8cec88528fd5706bb370a141708120401db15fff8ba89b72b32b685.

Codex 0.153.4; requested gpt-6-astra, reasoning low. Effective immutable provider snapshot is not exposed. Node v22.21.0, npm 10.9.4, Git 2.43.0; Linux.

Fresh temporary root: /tmp/graphkeeper-bench-c-02-20260907.vvS1Vn.
Verified unchanged tooling reused from /tmp/graphkeeper-bench-c-20260907.aJM0YZ/tooling/install; clean pinned source and package build/387-test verification are retained in [attempt 01](../provenance-2026-09-07-01/environment.md). No prior memory/transcripts are mounted into the new session.
Initial application commit: 1e20ed909d4781ae1e2263b1d97d37f8b9d9bf84.
Empty-memory setup commit: beb383cf729b0863912bae23abcbb4abaf34bcca.

Exact arguments: [invocations.json](checks/invocations.json). Codex bubblewrap grants only OS/executable/tooling reads and the current fixture; capture has explicit worktree/.git write grants, auditors only reads. Network, host skills, apps, plugins, memories, multi-agent and user configuration are disabled. Existing CLI authentication is not read or copied by the operator or exposed to tool commands.

Fresh operator probes verify the new roots. The separate real-agent preflight for unchanged runtime/configuration is retained in [attempt 01 preflight](../provenance-2026-09-07-01/checks/); it is not a behavioral observation. Calibration examples are reused unchanged, not new sessions.

Runtime configuration was previously checked using [official configuration documentation](https://learn.chatgpt.com/docs/config-file/config-reference) and [non-interactive execution documentation](https://learn.chatgpt.com/docs/non-interactive-mode), guided by OpenAI Docs.

Operator/scorer: main implementation-session Codex. No independent human review claimed. UTC times and all launches will be recorded in attempts.json.
