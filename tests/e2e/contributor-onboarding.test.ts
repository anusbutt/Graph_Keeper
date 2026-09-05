import assert from 'node:assert/strict';
import { cp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { query } from '../../src/commands/query.js';
import { runProcess } from '../../src/lib/process.js';
import { createRepositoryFixture } from '../helpers/repository.js';
import { createValidatorFixture } from '../helpers/validator.js';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const cliPath = fileURLToPath(new URL('../../src/cli.js', import.meta.url));
const exampleRoot = fileURLToPath(
  new URL('../../../examples/worked-example/', import.meta.url),
);

test('command-capable and file-editing harness styles read one unchanged graph identically', async (t) => {
  if (process.env.GRAPHKEEPER_ONBOARDING_NESTED === '1') return;
  const fixture = await createValidatorFixture('graphkeeper-two-harness-');
  t.after(fixture.cleanup);
  await cp(join(exampleRoot, 'graph'), join(fixture.root, 'graph'), { recursive: true });
  await cp(join(exampleRoot, 'evidence'), join(fixture.root, 'evidence'), { recursive: true });
  const graphPaths = ['entities.json', 'claims.json', 'runs.json']
    .map((name) => join(fixture.root, 'graph', name));
  const before = await Promise.all(graphPaths.map((path) => readFile(path, 'utf8')));

  const commandHarness = await runProcess(process.execPath, [
    cliPath,
    'query',
    'test_payments_flaky',
  ], {
    cwd: fixture.root,
    env: process.env,
    timeoutMs: 20_000,
  });
  const fileEditingHarness = await query({
    cwd: fixture.root,
    subject: 'test_payments_flaky',
  });

  assert.equal(commandHarness.exitCode, 0, commandHarness.stderr);
  assert.equal(fileEditingHarness.exitCode, 0, fileEditingHarness.stderr);
  assert.equal(commandHarness.stdout, fileEditingHarness.stdout);
  assert.match(commandHarness.stdout, /claim_22222222/);
  assert.match(commandHarness.stdout, /claim_33333333/);
  assert.doesNotMatch(commandHarness.stdout, /claim_11111111/);
  const after = await Promise.all(graphPaths.map((path) => readFile(path, 'utf8')));
  assert.deepEqual(after, before);

  const guide = await readFile(join(projectRoot, 'CONTRIBUTING.md'), 'utf8');
  assert.match(guide, /command-capable harness/is);
  assert.match(guide, /file-editing harness/is);
  assert.match(guide, /same\s+records without vendor-specific\s+fields/is);
});
