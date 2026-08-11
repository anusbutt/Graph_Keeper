# Security policy

GraphKeeper treats repository paths, stored commands, graph records, and evidence as
untrusted data. Reports that show command execution, path escape, append-only history
bypass, evidence mutation, or unsafe package-update behavior are especially valuable.

## Supported versions

Security fixes target the latest published version. Older `0.x` versions may be asked
to upgrade because the public interface can still change before 1.0. The affected and
fixed versions will be identified in any published advisory.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/anusbutt/Graph_Keeper/security/advisories/new).
Do not disclose a suspected vulnerability in a public issue, discussion, pull request,
graph record, or evidence file.

Include the affected GraphKeeper version, supported environment, minimal reproduction,
security impact, and any suggested mitigation. Remove unrelated secrets and personal
data. You may use placeholder credentials when demonstrating unsafe handling.

The maintainer will acknowledge the report as soon as practical, validate its scope,
coordinate a fix and release, and publish an advisory when users need remediation
guidance. No fixed response or resolution deadline is promised for this
maintainer-operated project.

For ordinary bugs that do not create a security boundary failure, use the
[bug report form](https://github.com/anusbutt/Graph_Keeper/issues/new?template=bug_report.yml).
