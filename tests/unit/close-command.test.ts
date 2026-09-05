import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCloseArguments } from '../../src/commands/close.js';

test('parseCloseArguments accepts the exact close-run contract in any flag order', () => {
  const parsed = parseCloseArguments('run', [
    '--verdict', 'passed',
    '--id', 'run_2026-09-04-auth_refresh',
    '--ended', '2026-09-04T09:15:00Z',
  ]);

  assert.deepEqual(parsed, {
    ok: true,
    options: {
      id: 'run_2026-09-04-auth_refresh',
      ended: '2026-09-04T09:15:00Z',
      verdict: 'passed',
    },
  });
});

test('parseCloseArguments accepts every supported verdict', () => {
  for (const verdict of ['passed', 'failed', 'inconclusive', 'aborted']) {
    const parsed = parseCloseArguments('run', [
      '--id', 'run_2026-09-04-auth_refresh',
      '--ended', '2026-09-04T09:15:00Z',
      '--verdict', verdict,
    ]);
    assert.equal(parsed.ok, true, verdict);
  }
});

test('parseCloseArguments rejects unsupported record types and malformed flag grammar', () => {
  for (const [name, recordType, args, expected] of [
    ['wrong record type', 'claim', [], /close requires a record type: run/i],
    ['missing id', 'run', ['--ended', '2026-09-04T09:15:00Z', '--verdict', 'passed'], /--id is required/i],
    ['missing ended', 'run', ['--id', 'run_2026-09-04-auth_refresh', '--verdict', 'passed'], /--ended is required/i],
    ['missing verdict', 'run', ['--id', 'run_2026-09-04-auth_refresh', '--ended', '2026-09-04T09:15:00Z'], /--verdict is required/i],
    ['duplicate flag', 'run', ['--id', 'run_2026-09-04-a', '--id', 'run_2026-09-04-b', '--ended', '2026-09-04T09:15:00Z', '--verdict', 'passed'], /duplicate close flag: --id/i],
    ['unknown flag', 'run', ['--id', 'run_2026-09-04-a', '--ended', '2026-09-04T09:15:00Z', '--verdict', 'passed', '--task', 'x'], /unknown close flag: --task/i],
    ['missing value', 'run', ['--id', '--ended', '2026-09-04T09:15:00Z', '--verdict', 'passed'], /--id requires a value/i],
    ['positional extra', 'run', ['unexpected', '--id', 'run_2026-09-04-a', '--ended', '2026-09-04T09:15:00Z', '--verdict', 'passed'], /unexpected close argument: unexpected/i],
    ['invalid verdict', 'run', ['--id', 'run_2026-09-04-a', '--ended', '2026-09-04T09:15:00Z', '--verdict', 'maybe'], /--verdict must be passed\|failed\|inconclusive\|aborted/i],
  ] as const) {
    const parsed = parseCloseArguments(recordType, args);
    assert.equal(parsed.ok, false, name);
    if (!parsed.ok) assert.match(parsed.usageError, expected, name);
  }
});
