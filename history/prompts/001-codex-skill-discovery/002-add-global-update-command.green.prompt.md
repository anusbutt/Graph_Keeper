---
id: 002
title: Add global update command
stage: green
date: 2026-08-10
surface: codex
model: gpt-5
feature: 001-codex-skill-discovery
branch: 001-codex-skill-discovery
user: anus_butt
command: manual
labels: [sdd, cli, npm, update, security]
links:
  spec: specs/001-codex-skill-discovery/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/001-codex-skill-discovery/spec.md
  - specs/001-codex-skill-discovery/plan.md
  - specs/001-codex-skill-discovery/research.md
  - specs/001-codex-skill-discovery/data-model.md
  - specs/001-codex-skill-discovery/contracts/update-cli.md
  - specs/001-codex-skill-discovery/quickstart.md
  - specs/001-codex-skill-discovery/tasks.md
  - src/commands/update.ts
  - src/cli.ts
  - README.md
  - CONTRIBUTING.md
  - tests/unit/update.test.ts
  - tests/integration/update-command.test.ts
  - tests/e2e/cli-help.test.ts
  - tests/e2e/package-contents.test.ts
  - tests/e2e/package-install.test.ts
tests:
  - npm run typecheck
  - npm run test:functional
  - npm run test:security
  - npm test
  - npm run test:performance
  - npm run package:smoke
  - git diff --check
---

## Prompt

i think we should also add update command what will update versions if new available.

## Response snapshot

Extended the existing SpecifyPlus feature with a fourth user story, npm research,
an exact CLI contract, red tests, green implementation, documentation, and complete
WSL verification. `graphkeeper update` now resolves npm's stable latest version and
installs one exact newer version globally without shell execution or repository reads
or writes.

## Outcome

- ✅ Impact: Global GraphKeeper users can update with one safe command while current and ahead installations remain unchanged.
- 🧪 Tests: 238 complete tests and 5 isolated performance tests passed; package contents and clean-install verification include the update module.
- 📁 Files: Added the update command, strict version comparison, focused tests, SDD contract, and recovery documentation.
- 🔁 Next prompts: Choose and apply the next package version before publishing; do not publish automatically.
- 🧠 Reflection: Resolving and validating the stable version before installation provides deterministic reporting and prevents registry text from becoming executable input.

## Evaluation notes (flywheel)

- Failure modes observed: Red compilation failed as intended because the update module did not exist; registry, timeout, malformed output, native PowerShell, missing npm, permission, and hostile-text cases were simulated without global mutation.
- Graders run and results (PASS/FAIL): SDD contract PASS; focused red/green PASS; WSL typecheck PASS; functional/security/full tests PASS; isolated performance PASS; package smoke PASS; worktree audit PASS.
- Prompt variant (if applicable): concise additive feature request
- Next experiment (smallest change to try): After publishing the next patch release, run `graphkeeper update` from a disposable WSL global installation and verify the reported version transition.
