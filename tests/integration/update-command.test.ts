import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  updateGraphKeeper,
  type UpdateEnvironment,
} from '../../src/commands/update.js';
import { GraphKeeperError } from '../../src/lib/errors.js';
import type { ProcessResult } from '../../src/lib/process.js';
import { createRepositoryFixture } from '../helpers/repository.js';

interface Invocation {
  readonly command: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
}

function result(overrides: Partial<ProcessResult> = {}): ProcessResult {
  return { exitCode: 0, stdout: '', stderr: '', ...overrides };
}

function fakeEnvironment(
  responses: readonly ProcessResult[],
  invocations: Invocation[],
  platform: NodeJS.Platform = 'linux',
  env: NodeJS.ProcessEnv = {},
): UpdateEnvironment {
  let index = 0;
  return {
    platform,
    env,
    run: async (command, args, timeoutMs) => {
      invocations.push({ command, args: [...args], timeoutMs });
      const response = responses[index];
      index += 1;
      if (response === undefined) throw new Error('unexpected process invocation');
      return response;
    },
  };
}

test('installs one exact newer stable version globally without repository mutation', async () => {
  const fixture = await createRepositoryFixture();
  try {
    await writeFile(join(fixture.root, 'sentinel.txt'), 'preserve\n', 'utf8');
    const before = await readdir(fixture.root);
    const invocations: Invocation[] = [];
    const report = await updateGraphKeeper({
      currentVersion: '0.1.1',
      environment: fakeEnvironment([
        result({ stdout: '0.1.2\n' }),
        result({ stdout: 'changed 1 package\n' }),
      ], invocations),
    });

    assert.deepEqual(report, {
      status: 'updated',
      currentVersion: '0.1.1',
      latestVersion: '0.1.2',
    });
    assert.deepEqual(invocations.map(({ command, args }) => [command, args]), [
      ['npm', ['view', 'graphkeeper@latest', 'version', '--json']],
      ['npm', ['install', '--global', 'graphkeeper@0.1.2']],
    ]);
    assert.equal(await readFile(join(fixture.root, 'sentinel.txt'), 'utf8'), 'preserve\n');
    assert.deepEqual(await readdir(fixture.root), before);
  } finally {
    await fixture.cleanup();
  }
});

test('current and ahead versions succeed without an install process', async () => {
  for (const [currentVersion, registryOutput, status] of [
    ['0.1.1', '0.1.1\n', 'current'],
    ['0.2.0', '0.1.9\n', 'ahead'],
  ] as const) {
    const invocations: Invocation[] = [];
    const report = await updateGraphKeeper({
      currentVersion,
      environment: fakeEnvironment([result({ stdout: registryOutput })], invocations),
    });
    assert.equal(report.status, status);
    assert.equal(invocations.length, 1);
  }
});

test('native PowerShell and missing npm are prerequisite failures before install', async () => {
  const nativeCalls: Invocation[] = [];
  await assert.rejects(
    updateGraphKeeper({
      currentVersion: '0.1.1',
      environment: fakeEnvironment([], nativeCalls, 'win32', {}),
    }),
    (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK003',
  );
  assert.deepEqual(nativeCalls, []);

  const missingCalls: Invocation[] = [];
  await assert.rejects(
    updateGraphKeeper({
      currentVersion: '0.1.1',
      environment: fakeEnvironment([
        result({ exitCode: null, problem: 'missing' }),
      ], missingCalls),
    }),
    (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK003',
  );
  assert.equal(missingCalls.length, 1);
});

test('registry, malformed output, timeout, and install failures are operational', async () => {
  const cases: readonly (readonly ProcessResult[])[] = [
    [result({ exitCode: 1, stderr: 'offline' })],
    [result({ stdout: '1.0.0-beta.1\n' })],
    [result({ exitCode: null, problem: 'timeout' })],
    [result({ stdout: '0.1.2\n' }), result({ exitCode: 1, stderr: 'EACCES' })],
  ];
  for (const responses of cases) {
    const invocations: Invocation[] = [];
    await assert.rejects(
      updateGraphKeeper({
        currentVersion: '0.1.1',
        environment: fakeEnvironment(responses, invocations),
      }),
      (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK004',
    );
    assert.ok(invocations.length >= 1 && invocations.length <= 2);
  }
});

test('hostile registry text is rejected as data and never reaches install arguments', async () => {
  const invocations: Invocation[] = [];
  await assert.rejects(
    updateGraphKeeper({
      currentVersion: '0.1.1',
      environment: fakeEnvironment([
        result({ stdout: '0.1.2/../../../owned\n' }),
      ], invocations),
    }),
    (error: unknown) => error instanceof GraphKeeperError && error.code === 'GK004',
  );
  assert.equal(invocations.length, 1);
});
