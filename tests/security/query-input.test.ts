import assert from 'node:assert/strict';
import { access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { query } from '../../src/commands/query.js';
import {
  createValidatorFixture,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

test('query treats malicious aliases and stored commands as inert data', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  const marker = join(fixture.root, 'QUERY_MARKER');
  const hostile = '$(touch QUERY_MARKER); `touch QUERY_MARKER`';
  await fixture.writeGraph(
    [{ ...validEntity, aliases: [hostile] }],
    [{
      ...validClaim,
      source: { ...validClaim.source, command: hostile },
    }],
    [validRun],
  );

  const result = await query({ cwd: fixture.root, subject: hostile });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /Matched by alias: "\$\(touch QUERY_MARKER\); `touch QUERY_MARKER`"/);
  assert.match(result.stdout, /Command: "\$\(touch QUERY_MARKER\); `touch QUERY_MARKER`"/);
  await assert.rejects(access(marker));
});

test('query reports provenance without dereferencing a missing evidence file', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph();
  const evidence = join(fixture.root, 'evidence', 'triage.log');
  await rm(evidence);

  const result = await query({ cwd: fixture.root, subject: validEntity.id });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /Evidence: evidence\/triage\.log#L1-L2/);
  await assert.rejects(access(evidence));
});

test('query works from a repository path containing spaces', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper query repo with spaces ');
  t.after(fixture.cleanup);
  await fixture.writeGraph();

  const result = await query({ cwd: fixture.root, subject: validEntity.id });

  assert.match(fixture.root, / /);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, new RegExp('Entity: ' + validEntity.id));
});
