import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXIT_CODES,
  GraphKeeperError,
  diagnostic,
  failureResult,
} from '../../src/lib/errors.js';

test('maps stable error categories to the public exit codes', () => {
  assert.deepEqual(EXIT_CODES, {
    success: 0,
    validation: 1,
    usage: 2,
    prerequisite: 3,
    operational: 4,
    internal: 5,
  });

  for (const [kind, exitCode] of Object.entries(EXIT_CODES)) {
    const error = new GraphKeeperError('GK999', kind as keyof typeof EXIT_CODES, 'failure');
    assert.equal(error.exitCode, exitCode);
  }
});

test('formats stable GK diagnostics without losing record context', () => {
  assert.equal(
    diagnostic('GK120', 'invalid claim', 'claim_a1b2c3d4'),
    'GK120 [claim_a1b2c3d4] invalid claim',
  );
  assert.throws(() => diagnostic('BAD', 'message'), /GK diagnostic code/);
});

test('keeps normal output on stdout and diagnostics on stderr', () => {
  const error = new GraphKeeperError('GK003', 'prerequisite', 'jq is required');
  assert.deepEqual(failureResult(error), {
    exitCode: 3,
    stdout: [],
    stderr: ['GK003 jq is required'],
  });
});
