import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { prepareInitialization } from '../../src/commands/init.js';
import { GraphKeeperError } from '../../src/lib/errors.js';
import { supportedInitEnvironment } from '../helpers/init.js';
import { createRepositoryFixture } from '../helpers/repository.js';

test('agent integration never follows a guidance-file symlink', {
  skip: process.platform === 'win32',
}, async () => {
  const fixture = await createRepositoryFixture();
  const outside = await mkdtemp(join(tmpdir(), 'graphkeeper-integration-outside-'));
  try {
    const outsideFile = join(outside, 'CLAUDE.md');
    const original = '# Outside contributor file\n';
    await writeFile(outsideFile, original, 'utf8');
    await symlink(outsideFile, join(fixture.root, 'CLAUDE.md'));

    await assert.rejects(
      prepareInitialization({
        cwd: fixture.root,
        force: false,
        integrations: ['claude'],
        environment: supportedInitEnvironment(),
      }),
      (error: unknown) =>
        error instanceof GraphKeeperError
        && error.code === 'GK004'
        && /Symbolic-link/.test(error.message),
    );
    assert.equal(await readFile(outsideFile, 'utf8'), original);
    await assert.rejects(stat(join(fixture.root, 'graph')));
  } finally {
    await fixture.cleanup();
    await rm(outside, { recursive: true, force: true });
  }
});

test('agent integration never follows a symlinked skill parent', {
  skip: process.platform === 'win32',
}, async () => {
  const fixture = await createRepositoryFixture();
  const outside = await mkdtemp(join(tmpdir(), 'graphkeeper-skill-outside-'));
  try {
    await mkdir(join(outside, 'skills'), { recursive: true });
    await symlink(outside, join(fixture.root, '.claude'));

    await assert.rejects(
      prepareInitialization({
        cwd: fixture.root,
        force: true,
        integrations: ['claude'],
        environment: supportedInitEnvironment(),
      }),
      (error: unknown) =>
        error instanceof GraphKeeperError
        && error.code === 'GK004'
        && /Symbolic-link/.test(error.message),
    );
    assert.deepEqual(await stat(join(outside, 'skills')).then((value) => value.isDirectory()), true);
    await assert.rejects(stat(join(fixture.root, 'graph')));
  } finally {
    await fixture.cleanup();
    await rm(outside, { recursive: true, force: true });
  }
});
