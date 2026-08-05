import assert from 'node:assert/strict';
import { chmod, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runProcess } from '../../src/lib/process.js';
import { createValidatorFixture } from '../helpers/validator.js';

const cliPath = fileURLToPath(new URL('../../src/cli.js', import.meta.url));
const hookSource = fileURLToPath(new URL('../../../templates/pre-commit', import.meta.url));

async function installHook(root: string): Promise<void> {
  const target = join(root, '.git', 'hooks', 'pre-commit');
  await copyFile(hookSource, target);
  await chmod(target, 0o755);
}

async function runCheck(root: string) {
  return runProcess(process.execPath, [cliPath, 'check'], {
    cwd: root,
    env: process.env,
    timeoutMs: 30_000,
  });
}

test('graphkeeper check and pre-commit accept the same valid snapshot', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph();

  const checked = await runCheck(fixture.root);
  await fixture.stageAll();
  const committed = await fixture.git(['commit', '-m', 'parity valid']);

  assert.equal(checked.exitCode, 0, checked.stderr);
  assert.equal(committed.exitCode, 0, committed.stderr);
  assert.match(checked.stdout, /GraphKeeper: validation passed/);
});

test('graphkeeper check and pre-commit reject the same invalid snapshot with the same rule code', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await installHook(fixture.root);
  await fixture.writeGraph();
  await fixture.commitAll();
  const claims = JSON.parse(await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8')) as Array<Record<string, unknown>>;
  claims[0] = { ...claims[0], predicate: 'Not Snake' };
  await fixture.writeJson('graph/claims.json', claims);

  const checked = await runCheck(fixture.root);
  await fixture.git(['add', 'graph/claims.json']);
  const committed = await fixture.git(['commit', '-m', 'parity invalid']);

  assert.equal(checked.exitCode, 1);
  assert.notEqual(committed.exitCode, 0);
  assert.match(checked.stderr, /GK120 \[graph\/claims\.json:claim_a1b2c3d4\]/);
  assert.match(committed.stderr, /GK120 \[graph\/claims\.json:claim_a1b2c3d4\]/);
});

test('check rejects arguments without invoking validation', async (t) => {
  const fixture = await createValidatorFixture();
  t.after(fixture.cleanup);
  await fixture.writeGraph();

  const checked = await runProcess(process.execPath, [cliPath, 'check', '--staged'], {
    cwd: fixture.root,
    env: process.env,
    timeoutMs: 10_000,
  });

  assert.equal(checked.exitCode, 2);
  assert.match(checked.stderr, /GK002 check does not accept arguments/);
  assert.doesNotMatch(checked.stdout + checked.stderr, /validation passed/);
});
