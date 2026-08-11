# GraphKeeper release checklist

This checklist is for a human release owner. Passing it makes a version eligible for a publish decision; no repository command publishes automatically.

## 1. Choose and verify the version

- [ ] Apply semantic versioning. `0.x` means the public API may still change; breaking behavior after `1.0.0` requires a major version.
- [ ] Update `package.json`, `package-lock.json`, CLI `--version`, changelog/release notes, and verification evidence to the same version.
- [ ] Confirm the version is not already published: `npm view graphkeeper versions --json`.
- [ ] Verify the established package identity immediately before publishing: `npm view graphkeeper name version dist-tags repository homepage bugs --json`.
- [ ] Run `npm owner ls graphkeeper` and confirm the authenticated release owner still has publish access. Do not silently change package identity in a release commit.

Registry observation on 2026-08-11: `graphkeeper@0.1.2` is public under the `latest`
dist-tag. Registry state and publish authorization must still be rechecked at release
time.

## 2. Reproduce the release candidate

- [ ] Start from a clean clone of the exact candidate commit and confirm `git status --short` is empty.
- [ ] Record `node --version`, `npm --version`, `git --version`, `jq --version`, and `sh --version`. Node must be 18 or newer and jq 1.6 or newer.
- [ ] Run `npm ci`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test:functional`.
- [ ] Run `npm run test:security` and review every aggregate regression result.
- [ ] Run `npm run test:performance` and compare the reported p95/RSS values with the fixed budgets and the 20-percent release regression gates.
- [ ] Run `npm ls --all`; investigate missing, invalid, or unexpected dependencies.
- [ ] Confirm the Linux, macOS, and Windows/Git Bash GitHub Actions jobs pass for the same commit. WSL is documented but native PowerShell is not a supported runtime.

## 3. Inspect the package

- [ ] Run `npm run package:smoke` and review the complete included-file list.
- [ ] Run `npm pack --json --pack-destination <clean-temp-directory>`.
- [ ] Confirm the tarball contains `dist/src`, `scripts/validate.sh`, templates, examples, `README.md`, `LICENSE`, and `package.json`.
- [ ] Confirm it excludes source, tests, specifications, history, GitHub administration, `node_modules`, and contributor-only scripts.
- [ ] Extract the tarball and run `node package/dist/src/cli.js --help` and `--version`.
- [ ] Install that exact tarball into a clean directory with `npm install <tarball>` and run the `init`, `check`, `query`, and `doctor` smoke journey.
- [ ] Record the tarball filename, SHA-1/SHA-512 integrity values from `npm pack --json`, byte sizes, command durations, and any approved exceptions in the signed GitHub release notes or attached release record.

## 4. Publish deliberately

- [ ] Confirm the npm account, organization, package ownership, 2FA, provenance policy, and public access with the release owner.
- [ ] Run `npm publish --dry-run --access public` and inspect the final notice. This invokes `prepublishOnly`, which reruns the deterministic typecheck, functional/security, and package-smoke gate; performance evidence comes from the separate benchmark step and required CI jobs.
- [ ] Obtain the architecture/validator publish decision.
- [ ] From the clean candidate commit, run `npm publish --access public` once. Do not retry blindly after a timeout; query the registry first.
- [ ] Verify `npm view graphkeeper@<version> dist --json`, install from the registry in a new directory, and rerun `graphkeeper --version`, `init`, `check`, `query`, and `doctor`.
- [ ] Create the signed Git tag and release notes only after registry verification.

## 5. Roll back or contain a bad release

- [ ] Stop promotion and announce the affected version and symptom.
- [ ] Prefer a forward fix with a new patch version. Never reuse an npm version.
- [ ] If users must be warned immediately, run `npm deprecate graphkeeper@<bad-version> "<reason and safe version>"` after release-owner approval.
- [ ] Move the `latest` dist-tag to the last verified version with `npm dist-tag add graphkeeper@<safe-version> latest`, then verify it.
- [ ] Unpublish only when npm policy permits and the release owner explicitly approves; it is not the normal rollback mechanism.
- [ ] Preserve the bad tarball, verification record, and incident evidence. Add a regression test before publishing the correction.
