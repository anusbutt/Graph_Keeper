import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

import {
  checkInitPrerequisites,
  type InitEnvironment,
} from '../../src/commands/init.js';
import { GraphKeeperError } from '../../src/lib/errors.js';
import type { ProcessResult } from '../../src/lib/process.js';
import { createRepositoryFixture } from '../helpers/repository.js';

function result(
  exitCode: number | null,
  stdout = '',
  problem?: ProcessResult['problem'],
): ProcessResult {
  return {
    exitCode,
    stdout,
    stderr: '',
    ...(problem === undefined ? {} : { problem }),
  };
}

function environment(
  overrides: Partial<Pick<InitEnvironment, 'platform' | 'nodeVersion' | 'env'>> = {},
  responses: Readonly<Record<string, ProcessResult>> = {},
): InitEnvironment {
  return {
    platform: 'linux',
    nodeVersion: '18.20.0',
    env: {},
    probe: async (command) => responses[command] ?? result(0, command === 'jq' ? 'jq-1.7.1\n' : ''),
    ...overrides,
  };
}

async function expectPrerequisiteFailure(
  env: InitEnvironment,
  expected: RegExp,
): Promise<void> {
  const fixture = await createRepositoryFixture(false);
  try {
    await fixture.writeJson('sentinel.json', { preserved: true });
    await assert.rejects(
      checkInitPrerequisites(fixture.root, env),
      (error: unknown) =>
        error instanceof GraphKeeperError
        && error.code === 'GK003'
        && error.exitCode === 3
        && expected.test(error.message),
    );
    assert.deepEqual(
      JSON.parse(await readFile(fixture.root + '/sentinel.json', 'utf8')),
      { preserved: true },
    );
    await assert.rejects(stat(fixture.root + '/graph'));
  } finally {
    await fixture.cleanup();
  }
}

test('accepts Node 18+ and Git on native Windows without probing sh or jq', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    const commands: string[] = [];
    const nativeEnvironment: InitEnvironment = {
      ...environment({ platform: 'win32', env: {} }),
      probe: async (command) => {
        commands.push(command);
        return command === 'git' ? result(0, 'git version 2.50.0\n') : result(null, '', 'missing');
      },
    };
    await checkInitPrerequisites(fixture.root, nativeEnvironment);
    assert.deepEqual(commands, ['git']);
  } finally {
    await fixture.cleanup();
  }
});

test('rejects Node older than 18 with an install link', async () => {
  await expectPrerequisiteFailure(environment({ nodeVersion: '17.9.1' }), /Node\.js 18.*https:\/\/nodejs\.org/s);
});

test('rejects missing Git before mutation', async () => {
  await expectPrerequisiteFailure(environment({}, { git: result(null, '', 'missing') }), /Git.*https:\/\/git-scm\.com/s);
});
