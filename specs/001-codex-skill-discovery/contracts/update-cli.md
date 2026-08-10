# Contract: `graphkeeper update`

## Accepted grammar

```text
graphkeeper update
```

Any argument returns exit code 2 with `GK002` before npm is invoked.

## External commands

```text
npm view graphkeeper@latest version --json
npm install --global graphkeeper@<exact-newer-version>
```

Commands use fixed argument arrays and never a shell. The install command runs only
for a newer stable `major.minor.patch` version.

## Outcomes

| Condition | Exit | Result |
|-----------|------|--------|
| Current or running version is ahead | 0 | No installation; report both versions |
| Newer version installs | 0 | Report update from old to exact new version |
| Invalid arguments | 2 | `GK002`; no npm process |
| Native PowerShell or npm missing | 3 | `GK003`; no install process |
| Lookup, malformed version, timeout, permission, or install failure | 4 | `GK004` |

The command does not inspect or mutate repository files.
