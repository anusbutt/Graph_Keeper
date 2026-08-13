# Native Windows migration

Current GraphKeeper repositories use the same Node validator and Git hook on Linux,
macOS, Git Bash/WSL, and native Windows PowerShell. Normal prerequisites are Node.js
18 or newer, npm, and Git; PowerShell users do not need sh or jq.

## New repositories

Install or update GraphKeeper, then run:

```powershell
graphkeeper init
graphkeeper check
```

Initialization installs `scripts/validate.mjs` and the rule-free Node pre-commit
launcher. Commit the repository-local validator with the graph files.

## Existing package-owned repositories

After updating GraphKeeper, rerun:

```powershell
graphkeeper init --force
graphkeeper check
```

GraphKeeper migrates only exact package-owned validator and hook content. It preserves
graph data, evidence, and customized files. Review the plan/output and commit the Node
validator, refreshed guidance, and any hook migration relevant to the repository.

## Customized legacy validators or hooks

If `scripts/validate.sh` or a hook differs from the package-owned version, GraphKeeper
does not replace or bypass it. Review the custom rules, move any required validation
semantics into the canonical TypeScript core, add parity tests, and then install the
Node validator/hook explicitly. Until that review is complete, the repository's
legacy fallback may still require a POSIX shell and jq.

Do not delete a customized validator merely to make initialization succeed. Preserve
it in Git, compare behavior, and migrate through a focused pull request. Run
`graphkeeper check`, `graphkeeper doctor`, and a real test commit after migration.

## Rollback

Reinstall the previous GraphKeeper npm version if the CLI must be rolled back. Graph
records and evidence remain repository data and must not be rewritten or deleted.
Restore repository-local validator or hook files through normal Git review, preserving
all committed claims, evidence, provenance, and correction history.
