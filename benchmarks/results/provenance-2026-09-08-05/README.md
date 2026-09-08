# Test C — revision 3 provenance result

Date: 2026-09-08. Protocol revision 3. Result: **PASS**.

This is a separately frozen experiment after revision 2's two explanation omissions
and one audit-isolation metadata defect. It uses the same candidate, source fixture,
and GraphKeeper guidance. Revision 3 changes only the published audit wording and
routes the audit process's transient Git index to dedicated scratch outside each
immutable fixture.

The unchanged candidate's earlier hook/network acceptance and rejection checks remain
in the [separate preflight](../provenance-preflight-2026-09-08/README.md). Revision 3
adds the fresh-agent audit-index isolation preflight included in this result.

The capture created and committed atomic claim `claim_beec17b2`: `handleRequest`
passes `request.body` to `validateInput`. Its saved evidence artifact contains
the module import and handler invocation. Three fresh auditors independently read
that record, explained the import-to-call relationship, traced its run and Git
introduction, and left their complete fixture manifests unchanged.

**Tally:** 3 passed, 0 failed, 0 unevaluable, 0 not run. Capture was eligible, so
the aggregate outcome is **PASS** under the frozen protocol.

## Inspect

- [Protocol](protocol.md) and [exact prompts/configuration](prompts.md)
- [Scorecard](scoring.md), [attempt ledger](attempts.json), and [environment](environment.md)
- [Saved graph/evidence snapshot](graphkeeper/graph/claims.json)
- [Capture](sessions/capture.jsonl) and [three audit logs](sessions/audit-1.jsonl)
- [Before/after manifests](checks/audit-1-before.manifest) and [fixture bundle](fixture.bundle)

Validate published bytes with `sha256sum -c SHA256SUMS`. Restore the complete
fixture history by cloning `fixture.bundle`, then check out
`d03d0bedeae77868f39edfa1b383c5e8795b6090`. In that restored fixture,
`node scripts/validate.mjs --worktree` verifies the graph; the public CLI can run
`check`, `doctor`, and `query request_handler`.

This result is one fixture, one host, and one requested model/configuration. It
establishes the recorded provenance trace for this scenario, not general reliability,
application correctness, source authenticity, runtime behavior, or current freshness.
The package includes no dependencies, build output, archives other than the required
Git bundle, private configuration, or credentials. Checksums attest published bytes,
not the authenticity of observations.
