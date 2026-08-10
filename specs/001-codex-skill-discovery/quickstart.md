# Quickstart: Verify Codex Skill Discovery

Use WSL or Git Bash in a disposable repository.

## Default discovery

```sh
git init codex-skill-test
cd codex-skill-test
graphkeeper init
test -f .agents/skills/graphkeeper/SKILL.md
sed -n '1,8p' .agents/skills/graphkeeper/SKILL.md
test ! -e AGENTS.md
test ! -e CLAUDE.md
graphkeeper check
graphkeeper doctor
```

Expected: valid skill frontmatter is present, no agent instruction file is
created by default, and validation is healthy.

## Explicit session-start awareness

```sh
graphkeeper init --integrate codex
grep -n 'graphkeeper:codex' AGENTS.md
graphkeeper init --integrate codex
grep -c 'graphkeeper:codex:start' AGENTS.md
```

Expected: the final command prints `1`.

## Preservation

```sh
printf '# Existing rules\n\nKeep this line.\n' > AGENTS.md
printf '# Claude rules\n' > CLAUDE.md
cp AGENTS.md /tmp/agents.before
cp CLAUDE.md /tmp/claude.before
graphkeeper init --force
cmp /tmp/agents.before AGENTS.md
cmp /tmp/claude.before CLAUDE.md
```

Expected: default forced initialization does not alter either instruction file.

## Global update

```sh
graphkeeper --version
graphkeeper update
graphkeeper --version
```

Expected: GraphKeeper checks npm's stable release. It reports that the installation
is current or ahead without installing, or installs and reports one exact newer
global version. It does not change files in the current repository.

## Repository gates

```sh
npm run typecheck
npm run test:functional
npm run test:security
npm run package:smoke
```
