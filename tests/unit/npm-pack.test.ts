import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePackManifest } from '../helpers/npm-pack.js';

const manifest = {
  filename: 'graphkeeper-0.4.1.tgz',
  files: [{ path: 'package.json', mode: 420 }],
};

test('parses npm 10 array pack output', () => {
  assert.deepEqual(parsePackManifest(JSON.stringify([manifest])), manifest);
});

test('parses npm 12 keyed pack output', () => {
  assert.deepEqual(parsePackManifest(JSON.stringify({ graphkeeper: manifest })), manifest);
});

test('rejects empty, multiple, and malformed pack manifests', () => {
  for (const output of [
    '[]',
    JSON.stringify([manifest, manifest]),
    '{}',
    JSON.stringify({ graphkeeper: {} }),
  ]) {
    assert.throws(() => parsePackManifest(output), TypeError);
  }
});
