# Environment — attempt 04

Date 2026-09-08; protocol revision 2. Operator/manual scorer: main implementation-session Codex; no independent human review claimed.

Candidate 9bec33efb11dfa4c4664f39d467bd2d02b66690d, graphkeeper 0.5.0 plus committed unreleased changes. Same verified package SHA256 3252c59c50a7cb17dbc31e99deb3531c25d122931b9fad3007f46dc6da05afcb, installed skill ae9466a607f91a75bc07bec80a3e969702fb1821ed3755ea9e65be31e995df37, and unchanged executable pre-commit hook fc5db7422d105953ab7cf358c41edee24dcaeb435998bef4db424041da1a61db. Full candidate verification remains in attempt 01 (387 complete-suite tests and focused/gates); this continuation introduces no product changes.

Codex 0.153.4, requested gpt-6-astra, reasoning low. No immutable effective provider snapshot exposed. Node v22.21.0, npm 10.9.4, Git 2.43.0, Linux. Temporary root /tmp/graphkeeper-bench-c-04-20260908.aLEIA7; tooling /tmp/graphkeeper-bench-c-20260907.aJM0YZ/tooling/install.

Fresh capture clone from empty setup bundle: initial application commit 1e20ed909d4781ae1e2263b1d97d37f8b9d9bf84, setup beb383cf729b0863912bae23abcbb4abaf34bcca. Hook copied unchanged from public CLI initialized setup. No synthetic preflight commit or memory enters capture.

## Verified corrected isolation

See [preflight report](../provenance-preflight-2026-09-08/README.md). Native and separate fresh-agent preflight verified hook-backed valid commit, rejection of invalid graph, unchanged hook/HEAD on rejection, evaluator read denial, and read-only audit files/.git with byte/mode/mtime equality. An evaluator path known to exist outside is hidden inside (ENOENT is expected mount isolation, not absence on host).

Same strict filesystem roots as prior attempts. Capture can write its disposable fixture/.git; each auditor reads only its own frozen copy. Main repository, evaluator artifacts and old transcripts are not mounted. OS, executable and tooling roots are read-only.

Correction: features.network_proxy=true; network.enabled=true with domains={} (no allowed destinations), allow_upstream_proxy=false, allow_local_binding=false, dangerously_allow_all_unix_sockets=false. The active proxy denies external destinations; native probe returned explicit 403 not_allowed for example.com, and direct test-net traffic had no route. This preserves command isolation while allowing the local pipe operations that produced EPERM with the prior direct-denial policy. No unrestricted network or host access is used for behavioral agents. Model-service traffic is separate from command traffic.

Web, apps, plugins, memories, multi-agent, browser/computer/image tools and host skills remain disabled; ignore-user-config/ignore-rules and sanitized shell environment are recorded in argv. Codex injects proxy runtime variables; Node may print an experimental EnvHttpProxyAgent warning. These are runtime warnings, distinguished from GraphKeeper doctor's zero graph warnings. No credentials/config are copied into evidence.

Settings followed [official permissions documentation](https://learn.chatgpt.com/docs/permissions), guided by OpenAI Docs, and actual acceptance/rejection tests. Pre-capture hashes are in checks/pre-capture-freeze.txt; final thread IDs and observed times belong in attempts.json.
