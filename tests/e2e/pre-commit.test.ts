import assert from 'node:assert/strict';
import { chmod, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createValidatorFixture } from '../helpers/validator.js';

const hookSource = fileURLToPath(new URL('../../../templates/pre-commit', import.meta.url));

async function installHook(root: string): Promise<void> {
  const target = join(root, '.git', 'hooks', 'pre-commit');
  await copyFile(hookSource, target);
  await chmod(target, 0o755);
}

test('pre-commit accepts a valid first commit in an unborn repository', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph();
  await fixture.stageAll();

  const committed = await fixture.git(['commit', '-m', 'valid first graph']);

  assert.equal(committed.exitCode, 0, committed.stderr);
  assert.match(committed.stdout + committed.stderr, /GraphKeeper: validation passed/);
});

test('pre-commit accepts later commits when the graph remains valid', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph();
  await fixture.commitAll();
  await writeFile(join(fixture.root, 'README.md'), 'safe change\n', 'utf8');
  await fixture.git(['add', 'README.md']);

  const committed = await fixture.git(['commit', '-m', 'safe non-graph change']);

  assert.equal(committed.exitCode, 0, committed.stderr);
});

test('pre-commit blocks malformed staged graph JSON and leaves HEAD unchanged', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph();
  await fixture.commitAll();
  const before = await fixture.git(['rev-parse', 'HEAD']);
  await writeFile(join(fixture.root, 'graph', 'claims.json'), '{bad json\n', 'utf8');
  await fixture.git(['add', 'graph/claims.json']);

  const committed = await fixture.git(['commit', '-m', 'must fail']);
  const after = await fixture.git(['rev-parse', 'HEAD']);

  assert.notEqual(committed.exitCode, 0);
  assert.match(committed.stderr, /GK102.*graph\/claims\.json/);
  assert.equal(after.stdout, before.stdout);
});

test('pre-commit blocks mutation of an already committed claim', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph();
  await fixture.commitAll();
  const claims = JSON.parse(await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8')) as Array<Record<string, unknown>>;
  claims[0] = { ...claims[0], object: 'passing' };
  await fixture.writeJson('graph/claims.json', claims);
  await fixture.git(['add', 'graph/claims.json']);

  const committed = await fixture.git(['commit', '-m', 'must fail']);

  assert.notEqual(committed.exitCode, 0);
  assert.match(committed.stderr, /GK151.*claim_a1b2c3d4/);
});
