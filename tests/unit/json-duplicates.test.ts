import assert from 'node:assert/strict';
import test from 'node:test';

import { findDuplicateJsonKeys } from '../../src/lib/json-duplicates.js';

test('detects adjacent duplicate keys in the same object', () => {
  assert.deepEqual(findDuplicateJsonKeys('{"id":1,"id":2}'), [
    { path: '$', key: 'id' },
  ]);
});

test('tracks duplicate scope across nested objects and arrays', () => {
  const duplicates = findDuplicateJsonKeys('{"outer":{"x":1,"x":2},"items":[{"y":1,"y":2}]}');

  assert.deepEqual(duplicates, [
    { path: '$["outer"]', key: 'x' },
    { path: '$["items"][0]', key: 'y' },
  ]);
});

test('does not confuse repeated scalar values or keys in different containers', () => {
  assert.deepEqual(findDuplicateJsonKeys('{"left":{"id":1},"right":{"id":1},"values":[1,1]}'), []);
});

test('treats escaped and literal spellings of the same property name as duplicates', () => {
  assert.deepEqual(findDuplicateJsonKeys('{"na\\u006de":1,"name":2}'), [
    { path: '$', key: 'name' },
  ]);
});

test('reports every duplicate occurrence after the first', () => {
  assert.deepEqual(findDuplicateJsonKeys('{"x":1,"x":2,"x":3}'), [
    { path: '$', key: 'x' },
    { path: '$', key: 'x' },
  ]);
});

test('rejects malformed JSON without evaluating any content', () => {
  assert.throws(() => findDuplicateJsonKeys('{"x":1,}'), /invalid JSON/);
});
