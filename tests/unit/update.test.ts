import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareStableVersions,
  parseStableVersion,
} from '../../src/commands/update.js';

test('parses stable semantic versions into numeric components', () => {
  assert.deepEqual(parseStableVersion('0.1.1'), [0, 1, 1]);
  assert.deepEqual(parseStableVersion('10.20.30'), [10, 20, 30]);
});

test('rejects malformed, prerelease, build, padded, and hostile versions', () => {
  for (const version of [
    '',
    '1',
    '1.2',
    '01.2.3',
    '1.02.3',
    '1.2.03',
    '1.2.3-beta.1',
    '1.2.3+build',
    'v1.2.3',
    ' 1.2.3',
    '1.2.3 ',
    '1.2.3; touch owned',
  ]) {
    assert.equal(parseStableVersion(version), null, version);
  }
});

test('compares major, minor, and patch components numerically', () => {
  assert.equal(compareStableVersions('0.1.1', '0.1.2'), -1);
  assert.equal(compareStableVersions('0.9.9', '1.0.0'), -1);
  assert.equal(compareStableVersions('2.0.0', '1.99.99'), 1);
  assert.equal(compareStableVersions('1.2.3', '1.2.3'), 0);
  assert.equal(compareStableVersions('1.10.0', '1.9.99'), 1);
});

test('comparison rejects an invalid running or registry version', () => {
  assert.throws(() => compareStableVersions('development', '1.0.0'));
  assert.throws(() => compareStableVersions('1.0.0', 'latest'));
});
