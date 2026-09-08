# Audit 3 post-state metadata difference

Compared with audit-3-before.json, audit-3-after.json differs only in:

- `.git/` mtime: `1788868082938.1904` → `1788868618916.1567` ms.
- `.git/index` mtime: `1788868082938.1904` → `1788868618916.1567` ms.

The index has identical mode `33188`, size `1560`, and SHA-256
`6c42cdfe6a5088521a126bc5179f63c07470dea4620705828cf57e04ea7ba8d2`.
All tracked file bytes/modes/mtimes match; `git diff`, cached diff, porcelain status,
reflogs and refs are unchanged. The recorded audit commands contain no attempted
write, commit or correction. This is treated as an external containment defect,
not as a behavioral write by the auditor. It makes C8/slot validity unevaluable.
