import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runProcess } from '../../src/lib/process.js';
import { createRepositoryFixture } from '../helpers/repository.js';

const initBudgetMs = process.platform === 'win32' ? 15_000 : 10_000;
const cliPath = fileURLToPath(new URL('../../src/cli.js', import.meta.url));

function supportedEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...(process.platform === 'win32' ? { MSYSTEM: 'MINGW64' } : {}),
  };
}

async function timedInit(root: string): Promise<number> {
  const started = performance.now();
  const result = await runProcess(process.execPath, [cliPath, 'init'], {
    cwd: root,
    env: supportedEnvironment(),
    timeoutMs: 15_000,
  });
  assert.equal(result.exitCode, 0, result.stderr);
  return performance.now() - started;
}

function percentile95(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? Number.POSITIVE_INFINITY;
}

test('initialization p95 stays within its platform budget', { timeout: 120_000 }, async () => {
  const durations: number[] = [];
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const fixture = await createRepositoryFixture();
    try {
      durations.push(await timedInit(fixture.root));
    } finally {
      await fixture.cleanup();
    }
  }
  const p95 = percentile95(durations);
  assert.ok(
    p95 < initBudgetMs,
    'expected init p95 below ' + initBudgetMs + 'ms, observed ' + p95.toFixed(1) + 'ms',
  );
});

test('documented scaffold-to-enforced-hook walkthrough stays below two minutes', {
  timeout: 130_000,
}, async () => {
  const fixture = await createRepositoryFixture();
  const started = performance.now();
  try {
    await timedInit(fixture.root);
    const staged = await fixture.git(['add', '--all']);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const hook = join(fixture.root, '.git', 'hooks', 'pre-commit');
    const shell = process.platform === 'win32'
      ? 'C:\\Program Files\\Git\\bin\\sh.exe'
      : '/bin/sh';
    const enforced = await runProcess(shell, [hook.replaceAll('\\', '/')], {
      cwd: fixture.root,
      env: supportedEnvironment(),
      timeoutMs: 15_000,
    });
    assert.equal(enforced.exitCode, 0, enforced.stderr);
    assert.match(enforced.stdout, /validation passed/);
    const elapsed = performance.now() - started;
    assert.ok(
      elapsed < 120_000,
      'expected walkthrough below 120000ms, observed ' + elapsed.toFixed(1) + 'ms',
    );
  } finally {
    await fixture.cleanup();
  }
});
