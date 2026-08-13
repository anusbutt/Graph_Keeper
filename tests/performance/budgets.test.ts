import assert from 'node:assert/strict';
import { cp } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { check, type CheckRunner } from '../../src/commands/check.js';
import { doctor } from '../../src/commands/doctor.js';
import { query } from '../../src/commands/query.js';
import { runProcess } from '../../src/lib/process.js';
import { createRepositoryFixture } from '../helpers/repository.js';

const cliPath = fileURLToPath(new URL('../../src/cli.js', import.meta.url));
const exampleRoot = fileURLToPath(new URL('../../../examples/worked-example/', import.meta.url));
const regressionMultiplier = 1.2;
const budgets = process.platform === 'win32'
  ? {
      init: 15_000,
      check: 5_000,
      query: 3_000,
      doctor: 15_000,
      peakMemoryMb: 256,
    } as const
  : {
      init: 10_000,
      check: 3_000,
      query: 2_000,
      doctor: 10_000,
      peakMemoryMb: 256,
    } as const;

test('aggregate release journey reports budgets and rejects regressions above twenty percent', {
  timeout: 60_000,
}, async (t) => {
  const fixture = await createRepositoryFixture(true, 'graphkeeper-budget-');
  t.after(fixture.cleanup);
  const environment = { ...process.env };
  const runner: CheckRunner = (command, args, options) => runProcess(command, args, {
    ...options,
    env: environment,
  });
  let peakRss = process.memoryUsage().rss;

  const initStarted = performance.now();
  const initialized = await runProcess(process.execPath, [cliPath, 'init'], {
    cwd: fixture.root,
    env: environment,
    timeoutMs: 15_000,
  });
  const initMs = performance.now() - initStarted;
  assert.equal(initialized.exitCode, 0, initialized.stderr);
  peakRss = Math.max(peakRss, process.memoryUsage().rss);

  await cp(join(exampleRoot, 'graph'), join(fixture.root, 'graph'), { recursive: true, force: true });
  await cp(join(exampleRoot, 'evidence'), join(fixture.root, 'evidence'), { recursive: true, force: true });

  const checkStarted = performance.now();
  const checked = await check({ cwd: fixture.root, runner });
  const checkMs = performance.now() - checkStarted;
  assert.equal(checked.exitCode, 0, checked.stderr);
  peakRss = Math.max(peakRss, process.memoryUsage().rss);

  const queryStarted = performance.now();
  const queried = await query({ cwd: fixture.root, subject: 'test_payments_flaky', runner });
  const queryMs = performance.now() - queryStarted;
  assert.equal(queried.exitCode, 0, queried.stderr);
  assert.match(queried.stdout, /Claim: claim_22222222/);
  peakRss = Math.max(peakRss, process.memoryUsage().rss);

  const doctorStarted = performance.now();
  const diagnosed = await doctor({ cwd: fixture.root, runner });
  const doctorMs = performance.now() - doctorStarted;
  assert.equal(diagnosed.exitCode, 0, diagnosed.stderr);
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  const peakMemoryMb = peakRss / (1024 * 1024);

  const observed = { initMs, checkMs, queryMs, doctorMs, peakMemoryMb };
  t.diagnostic('release budget report ' + JSON.stringify(observed));
  for (const [name, value, budget] of [
    ['init', initMs, budgets.init],
    ['check', checkMs, budgets.check],
    ['query', queryMs, budgets.query],
    ['doctor', doctorMs, budgets.doctor],
    ['peak memory', peakMemoryMb, budgets.peakMemoryMb],
  ] as const) {
    assert.ok(
      value < budget * regressionMultiplier,
      name + ' exceeded the 20% regression gate: observed '
        + value.toFixed(1) + ', gate ' + (budget * regressionMultiplier).toFixed(1),
    );
  }
});
