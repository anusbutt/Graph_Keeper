import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { loadValidationSnapshot } from '../../src/lib/git-snapshot.js';
import { validateSnapshot } from '../../src/lib/validation.js';
import {
  createValidatorFixture,
  runLegacyValidator,
  validClaim,
  validEntity,
  validRun,
} from '../helpers/validator.js';

async function compare(
  fixture: Awaited<ReturnType<typeof createValidatorFixture>>,
  mode: '--staged' | '--worktree' = '--worktree',
): Promise<void> {
  const shell = await runLegacyValidator(fixture, mode);
  const typescript = validateSnapshot(await loadValidationSnapshot({
    repositoryRoot: fixture.root,
    mode,
  }));
  assert.deepEqual(
    {
      exitCode: typescript.exitCode,
      stdout: typescript.stdout,
      stderr: typescript.stderr,
    },
    {
      exitCode: shell.exitCode,
      stdout: shell.stdout,
      stderr: shell.stderr,
    },
  );
}

test('TypeScript path matches shell success and schema diagnostic ordering', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-differential-');
  t.after(fixture.cleanup);
  await fixture.writeGraph();
  await compare(fixture);
  await fixture.writeGraph({}, {}, {});
  await compare(fixture);
});

test('TypeScript path matches shell relationship context and detail', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-differential-');
  t.after(fixture.cleanup);
  const old = { ...validClaim, id: 'claim_11111111' };
  const first = { ...validClaim, id: 'claim_22222222', supersedes: old.id };
  const second = { ...validClaim, id: 'claim_33333333', supersedes: old.id };
  await fixture.writeGraph(
    [validEntity],
    [old, first, second],
    [{ ...validRun, claims_written: [old.id, first.id, second.id] }],
  );
  await compare(fixture);
});

test('TypeScript path matches shell claim history and evidence protection', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-differential-');
  t.after(fixture.cleanup);
  await fixture.writeGraph();
  await fixture.commitAll();
  await fixture.writeGraph([validEntity], [{ ...validClaim, object: 'passing' }], [validRun]);
  await writeFile(join(fixture.root, 'evidence', 'triage.log'), 'mutated\n', 'utf8');
  await compare(fixture);
});

test('TypeScript staged path matches shell index selection before first commit', async (t) => {
  const fixture = await createValidatorFixture('graphkeeper-differential-');
  t.after(fixture.cleanup);
  await fixture.writeGraph();
  await fixture.stageAll();
  await writeFile(join(fixture.root, 'graph', 'claims.json'), '{}\n', 'utf8');
  await compare(fixture, '--staged');
});
