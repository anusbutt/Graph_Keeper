# GraphKeeper v0.1.0 verification

This file is the release-candidate evidence index for the approved v1 specification. A `PASS` requires both the linked focused proof and the complete release-candidate workflow recorded below. Paths name executable tests unless explicitly marked as documentation inspection.

## Functional requirement matrix

| Requirement | Verification evidence slot | RC status |
|---|---|---|
| FR-001 | `tests/e2e/init.test.ts` — single-command onboarding | PASS - clean RC 2026-08-05 |
| FR-002 | `tests/integration/init-files.test.ts`, `tests/integration/templates.test.ts` — complete scaffold | PASS - clean RC 2026-08-05 |
| FR-003 | `tests/integration/init-prerequisites.test.ts`, `tests/e2e/init.test.ts` — preflight before writes | PASS - clean RC 2026-08-05 |
| FR-004 | `tests/e2e/init.test.ts` — repeat init preserves data | PASS - clean RC 2026-08-05 |
| FR-005 | `tests/e2e/init.test.ts` — force refreshes documentation only | PASS - clean RC 2026-08-05 |
| FR-006 | `tests/e2e/init.test.ts` — non-Git scaffold and enforcement warning | PASS - clean RC 2026-08-05 |
| FR-007 | `tests/integration/init-hooks.test.ts`, `tests/e2e/init.test.ts` — custom hooksPath | PASS - clean RC 2026-08-05 |
| FR-008 | `tests/integration/init-hooks.test.ts` — third-party hook preservation and chaining | PASS - clean RC 2026-08-05 |
| FR-009 | `tests/unit/init-plan.test.ts`, `tests/e2e/init.test.ts` — reasoned create/skip/warn actions | PASS - clean RC 2026-08-05 |
| FR-010 | `tests/integration/validator-schema.test.ts` — required claim fields | PASS - clean RC 2026-08-05 |
| FR-011 | `tests/integration/validator-schema.test.ts` — random-hex claim ID shape | PASS - clean RC 2026-08-05 |
| FR-012 | `tests/integration/validator-relations.test.ts` — subject resolves to entity | PASS - clean RC 2026-08-05 |
| FR-013 | `tests/integration/validator-schema.test.ts` — flat predicate/object strings | PASS - clean RC 2026-08-05 |
| FR-014 | `tests/integration/validator-schema.test.ts` — confidence bounds | PASS - clean RC 2026-08-05 |
| FR-015 | `tests/integration/validator-schema.test.ts` — exact tool-output source shape | PASS - clean RC 2026-08-05 |
| FR-016 | `tests/integration/validator-schema.test.ts` — inference source shape | PASS - clean RC 2026-08-05 |
| FR-017 | `tests/integration/validator-schema.test.ts`, `tests/unit/evidence.test.ts` — evidence reference syntax | PASS - clean RC 2026-08-05 |
| FR-018 | `tests/integration/validator-schema.test.ts` — entity IDs and uniqueness | PASS - clean RC 2026-08-05 |
| FR-019 | `tests/integration/validator-history.test.ts` — immutable entity identity | PASS - clean RC 2026-08-05 |
| FR-020 | `tests/integration/validator-history.test.ts` — unique set-only entity growth | PASS - clean RC 2026-08-05 |
| FR-021 | `tests/integration/validator-schema.test.ts` — dated unique run IDs | PASS - clean RC 2026-08-05 |
| FR-022 | `tests/integration/run-lifecycle.test.ts` — open-run minimum shape | PASS - clean RC 2026-08-05 |
| FR-023 | `tests/integration/run-lifecycle.test.ts` — open-run set growth | PASS - clean RC 2026-08-05 |
| FR-024 | `tests/integration/run-lifecycle.test.ts` — one valid close transition | PASS - clean RC 2026-08-05 |
| FR-025 | `tests/integration/run-lifecycle.test.ts` — closed-run immutability | PASS - clean RC 2026-08-05 |
| FR-026 | `tests/integration/validator-schema.test.ts` — whole-second UTC timestamps | PASS - clean RC 2026-08-05 |
| FR-027 | `tests/integration/validator-history.test.ts`, `tests/e2e/pre-commit.test.ts` — evidence immutability | PASS - clean RC 2026-08-05 |
| FR-028 | `tests/integration/check-command.test.ts`, `tests/e2e/check-and-hook.test.ts` — on-demand check | PASS - clean RC 2026-08-05 |
| FR-029 | `tests/e2e/check-and-hook.test.ts` — hook/check parity | PASS - clean RC 2026-08-05 |
| FR-030 | `tests/integration/validator-diagnostics.test.ts` — safe error aggregation | PASS - clean RC 2026-08-05 |
| FR-031 | `tests/integration/validator-schema.test.ts`, `validator-relations.test.ts` — canonical fast checks | PASS - clean RC 2026-08-05 |
| FR-032 | `tests/integration/validator-history.test.ts` — semantic append-only claims | PASS - clean RC 2026-08-05 |
| FR-033 | `tests/integration/validator-history.test.ts` — formatting/key-order tolerance | PASS - clean RC 2026-08-05 |
| FR-034 | `tests/integration/validator-history.test.ts`, `run-lifecycle.test.ts` — entity/run transitions | PASS - clean RC 2026-08-05 |
| FR-035 | `tests/integration/validator-history.test.ts`, `tests/e2e/pre-commit.test.ts` — committed evidence edit/remove/rename | PASS - clean RC 2026-08-05 |
| FR-036 | `tests/integration/validator-relations.test.ts` — one existing supersession target | PASS - clean RC 2026-08-05 |
| FR-037 | `tests/integration/validator-relations.test.ts`, `tests/e2e/corrections.test.ts` — cycle rejection | PASS - clean RC 2026-08-05 |
| FR-038 | `tests/integration/validator-modes.test.ts` — first-commit comparison skip only | PASS - clean RC 2026-08-05 |
| FR-039 | `tests/security/validator-input.test.ts` — fast shape/path safety without dereference | PASS - clean RC 2026-08-05 |
| FR-040 | `tests/security/security-regression.test.ts` — commands/evidence remain inert data | PASS - clean RC 2026-08-05 |
| FR-041 | `tests/e2e/query.test.ts` — query command | PASS - clean RC 2026-08-05 |
| FR-042 | `tests/unit/query-resolution.test.ts`, `tests/e2e/query.test.ts` — ID/exact alias resolution | PASS - clean RC 2026-08-05 |
| FR-043 | `tests/integration/query-corrections.test.ts`, `tests/e2e/corrections.test.ts` — active claims only | PASS - clean RC 2026-08-05 |
| FR-044 | `tests/integration/query-command.test.ts` — IDs and provenance rendering | PASS - clean RC 2026-08-05 |
| FR-045 | `tests/unit/query-resolution.test.ts`, `tests/e2e/query.test.ts` — ambiguous alias rejection | PASS - clean RC 2026-08-05 |
| FR-046 | `tests/e2e/query.test.ts` — distinct unknown/no-active diagnostics | PASS - clean RC 2026-08-05 |
| FR-047 | `tests/e2e/doctor.test.ts` — doctor command | PASS - clean RC 2026-08-05 |
| FR-048 | `tests/unit/evidence.test.ts`, `tests/e2e/doctor.test.ts` — containment/existence/text/ranges | PASS - clean RC 2026-08-05 |
| FR-049 | `tests/unit/doctor-graph.test.ts`, `tests/e2e/doctor.test.ts` — dangling references and warnings | PASS - clean RC 2026-08-05 |
| FR-050 | `tests/integration/doctor-command.test.ts` — warning/error sections and exit status | PASS - clean RC 2026-08-05 |
| FR-051 | `tests/integration/schema-doc.test.ts`, `skill-doc.test.ts`, `tests/e2e/agent-guidance.test.ts` — grounded-writing guidance | PASS - clean RC 2026-08-05 |
| FR-052 | `tests/integration/skill-doc.test.ts` — automated/manual labels | PASS - clean RC 2026-08-05 |
| FR-053 | `tests/integration/reviewer-prompt.test.ts` — copy-pasteable reviewer | PASS - clean RC 2026-08-05 |
| FR-054 | `tests/integration/reviewer-prompt.test.ts` — factual approval cites active claim IDs | PASS - clean RC 2026-08-05 |
| FR-055 | `tests/integration/reviewer-prompt.test.ts` — inference-only proof rejected | PASS - clean RC 2026-08-05 |
| FR-056 | `tests/e2e/worked-example.test.ts` — populated generic graph/evidence | PASS - clean RC 2026-08-05 |
| FR-057 | `tests/integration/release-docs.test.ts`, `tests/integration/contributor-docs.test.ts` — prerequisites, platforms, limits, recovery | PASS - clean RC 2026-08-05 |

## Success criterion matrix

| Criterion | Verification evidence slot | RC status |
|---|---|---|
| SC-001 | `tests/performance/init.bench.ts` — scaffold-to-hook walkthrough under two minutes | PASS - clean RC 2026-08-05 |
| SC-002 | `tests/e2e/init.test.ts`, `tests/integration/init-files.test.ts` — existing data preservation | PASS - clean RC 2026-08-05 |
| SC-003 | validator unit/integration acceptance suites — specified invalid fixture rejection | PASS - clean RC 2026-08-05 |
| SC-004 | `tests/e2e/pre-commit.test.ts`, `tests/e2e/corrections.test.ts` — mutation/evidence rejection | PASS - clean RC 2026-08-05 |
| SC-005 | `tests/performance/query.bench.ts` — correct 10,000-claim query below two seconds p95 | PASS - clean RC 2026-08-05 |
| SC-006 | `tests/e2e/doctor.test.ts`, `tests/performance/doctor.bench.ts` — integrity matrix and ten-second p95 | PASS - clean RC 2026-08-05 |
| SC-007 | `tests/e2e/worked-example.test.ts` — every active tool-output claim traces to evidence | PASS - clean RC 2026-08-05 |
| SC-008 | `tests/integration/reviewer-prompt.test.ts` — supported/unsupported reviewer fixtures | PASS - clean RC 2026-08-05 |
| SC-009 | `tests/e2e/contributor-onboarding.test.ts` — two harness styles, one unchanged graph | PASS - clean RC 2026-08-05 |
| SC-010 | `tests/e2e/contributor-onboarding.test.ts`, `tests/integration/contributor-docs.test.ts` — clean contributor onboarding | PASS - clean RC 2026-08-05 |

## Release-candidate observation

Status: **PASS — LOCAL RC ELIGIBLE FOR A PUBLISH DECISION**

Observed on 2026-08-05 from a newly created source snapshot committed before dependency installation. The workflow finished in 169.7 seconds and ended with an empty `git status --short`. Performance tests ran serially so their measurements were not distorted by the functional test pool.

After that workflow, the README quickstart was corrected to stage only actual scaffold files. This documentation-only change was rechecked by the release-doc and tarball-content tests (3/3 passed); the final tarball metadata below includes that correction.

### Environment

| Tool | Observed version |
|---|---|
| Operating system | Microsoft Windows NT 10.0.26200.0, supported Git Bash execution model |
| Node.js | v24.17.0; package contract remains Node >=18 |
| npm | 11.13.0 |
| Git | 2.50.1.windows.1 |
| jq | 1.7.1 |
| sh | GNU bash 5.2.37, MSYS2/Git Bash |

### Commands and results

| Command | Duration | Result | Evidence |
|---|---:|---|---|
| `npm ci` | 1.902 s | PASS; 3 packages installed, 0 vulnerabilities | Locked clean-snapshot install |
| `npm run typecheck` | 2.233 s | PASS | TypeScript no-emit gate |
| `npm test` | 115.291 s | PASS; 211 functional/security tests plus 5 serial performance tests, 216 total, 0 failures | Complete clean-snapshot suite |
| `npm run test:security` | 12.099 s | PASS; 14/14 | Aggregate and focused security regressions |
| `npm run test:performance` | 30.184 s | PASS; 5/5 | 10k query/doctor, init, walkthrough, and aggregate budget gates |
| `npm ls --all` | 1.200 s | PASS | Dependency tree valid; zero runtime dependencies |
| `npm run package:smoke` | 4.609 s | PASS | 53-file npm dry-run manifest |
| Clean tarball installation journey | 31.017 s inside the concurrent functional lane | PASS | `tests/e2e/package-install.test.ts` ran installed `init`, `check`, `query`, and `doctor` |

The dedicated aggregate budget observation was: init 366.2 ms, check 646.4 ms, query 700.4 ms, doctor 672.0 ms, and peak RSS 48.73 MB. All are below the 20-percent regression gates. The separate 10,000-claim query, 10,000-reference doctor/RSS, initialization p95, and two-minute walkthrough benchmarks also passed their hard specification budgets.

### Package observation

- Filename: `graphkeeper-0.1.0.tgz`
- Compressed size: 44,222 bytes; unpacked size: 189,034 bytes; entries: 53
- SHA-1: `553ea9bb3e8b9eb9fc62510337a8d48e712e80f4`
- Integrity: `sha512-T9+bGLTVrW0OAXYv2wNTrRl29HqAlKL4DjEbbsK3wXTPtEbClkmaPBl3FVKUa+FsnkLh66OQ2T+LyRbP+jAU/g==`
- `npm view graphkeeper name version dist-tags time --json` returned `E404` on 2026-08-05. No public package was visible, but this does not reserve the name; the release owner must recheck immediately before publication.

### Remaining exceptions

- Hosted Linux, macOS, and Windows/Git Bash GitHub Actions have not run for a remote candidate commit. All three jobs must pass before publication.
- `npm publish --dry-run`, npm identity/2FA/ownership confirmation, and actual publication were intentionally not performed. They require the release-owner checklist and explicit publish approval.
- Native PowerShell remains unsupported by specification; the Windows observation used the documented Git Bash toolchain.
