# Research: Codex Skill Discovery

## Decision 1: Use the repository skill discovery path

**Decision**: Generate `.agents/skills/graphkeeper/SKILL.md` with required
`name` and `description` frontmatter.

**Rationale**: Official Codex documentation states that repository skills are
scanned from `.agents/skills` between the current directory and repository root,
and that metadata is used for explicit and implicit activation before the body is
loaded.

**Alternatives considered**:

- Root `SKILL.md`: rejected because it is not a documented discovery location.
- User-global installation: rejected because GraphKeeper memory is repository-local.
- Always loading the full workflow: rejected because skills use progressive disclosure.

**Source**: https://developers.openai.com/codex/skills/

## Decision 2: Separate discovery from session-start policy

**Decision**: Install the discoverable skill by default and modify
`AGENTS.md` only through explicit `--integrate codex`.

**Rationale**: Codex loads `AGENTS.md` before work, while skill bodies load only
after invocation. A short activation rule provides deterministic awareness without
placing the full GraphKeeper contract in every session. Explicit integration avoids
surprising changes to existing contributor guidance.

**Alternatives considered**:

- Modify `AGENTS.md` on every init: rejected as too invasive.
- Rely only on implicit skill matching: rejected because matching is not a guaranteed start-of-session policy.
- Generate `AGENTS.override.md`: rejected because it can override repository instructions.

**Source**: https://developers.openai.com/codex/guides/agents-md/

## Decision 3: Own one marked text span

**Decision**: Use unique start/end HTML comments and replace only the bytes inside
one valid pair.

**Rationale**: Marker ownership is diffable, idempotent, reviewable, and compatible
with arbitrary Markdown outside the block.

**Alternatives considered**:

- Parse and regenerate all Markdown: rejected because formatting and comments could be lost.
- Append on every run: rejected because it creates duplicates.
- Maintain a second instruction filename: rejected because Codex does not discover arbitrary alternatives.

## Decision 4: Preserve legacy root guidance

**Decision**: Stop generating root `SKILL.md` for new installs but never delete or
rewrite an existing one.

**Rationale**: Existing repositories may refer to that file from other agent
instructions. Preservation satisfies migration safety while the new Codex path fixes
discovery.

**Alternatives considered**:

- Delete during migration: rejected as destructive.
- Refresh both copies forever: rejected because duplicated canonical instructions will drift.

## Decision 5: Keep the adapter inside existing init

**Decision**: Extend `graphkeeper init` instead of adding a separate agent command.

**Rationale**: Skill scaffolding is repository initialization, reuses atomic write
machinery, and avoids a new command surface before the first public release.

**Alternatives considered**:

- New `graphkeeper integrate` command: clearer long-term separation but unnecessary for one adapter.
- Postinstall mutation: rejected because npm installation must never change the caller's repository.

## Decision 6: Resolve then install an exact stable npm version

**Decision**: `graphkeeper update` queries
`npm view graphkeeper@latest version --json`, validates a stable semantic version,
and installs only a newer result with
`npm install --global graphkeeper@<exact-version>`.

**Rationale**: npm documents `view` as the registry metadata command and defaults
package specifications to the `latest` tag. npm also documents `install --global`
for global CLI packages. Resolving before installation makes comparison and reporting
deterministic, while installing the exact result avoids a tag-change race.

**Alternatives considered**:

- `npm update --global graphkeeper`: rejected because it does not expose the resolved
  version before mutation.
- Install `graphkeeper@latest` directly: rejected because the tag could move between
  check and install.
- Add a semver runtime dependency: rejected because stable `major.minor.patch`
  comparison is small and GraphKeeper preserves its zero-runtime-dependency boundary.
- Support pnpm, Yarn, or prerelease channels now: rejected from the initial WSL and
  Git Bash npm launch.

**Sources**:

- https://docs.npmjs.com/cli/v11/commands/npm-view/
- https://docs.npmjs.com/downloading-and-installing-packages-globally/
