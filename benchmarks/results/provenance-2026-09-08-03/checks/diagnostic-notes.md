# Post-capture diagnostic record

These are read-only operator diagnostics, not capture/audit retries.

The hook at preflight/.git/hooks/pre-commit was invoked with /usr/local/bin/node, using the same capture permission profile with only the fixture path replaced by preflight. Environment was cleared and set to the recorded tooling PATH, GIT_CONFIG_NOSYSTEM=1 and GIT_CONFIG_GLOBAL=/dev/null. Inside `codex sandbox -P bench`: exit 4, Git spawn EPERM. Outside that sandbox, in the same preflight copy with the same cleared environment: exit 0. See the paired raw outputs. No commit was attempted by the diagnostic, and neither capture nor preflight memory was changed.

An initial setup-check permission review timed out before process launch; the permitted single retry succeeded. This was operator preflight, not a behavioral launch. One capture session ran; no audit or behavioral replacement was launched.

Restoration used a full bundle clone followed by `git apply --index capture-staged.patch`. Git warned that the numbered blank source line has trailing whitespace; original evidence bytes were preserved. Snapshot assertions then verified exact evidence, graph, staged diff, status, source/guidance and setup history equality.
