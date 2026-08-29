import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  EXIT_SUCCESS,
  EXIT_USAGE,
  authorizePlan,
  parseInitArguments,
  parseRemoveArguments,
  type CliIO,
  type CliTerminal,
  run,
} from '../../src/cli.js';
import { AGENT_IDS } from '../../src/lib/agent-adapters.js';
import { runCommand } from '../helpers/repository.js';

function captureIO(): {
  readonly io: CliIO;
  readonly stdout: string[];
  readonly stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    },
  };
}

test('prints help successfully when no command is provided', async () => {
  const capture = captureIO();
  const exitCode = await run([], capture.io);

  assert.equal(exitCode, EXIT_SUCCESS);
  assert.match(capture.stdout.join('\n'), /graphkeeper init/);
  assert.match(capture.stdout.join('\n'), /graphkeeper update/);
  assert.equal(capture.stderr.length, 0);
  const grammar = AGENT_IDS.join('|');
  assert.match(capture.stdout.join('\n'), new RegExp(`--integrate <${grammar}\\|all>`));
  assert.match(capture.stdout.join('\n'), new RegExp(`integrate remove <${grammar}>`));
});

test('parses the documented multi-adapter init option grammar deterministically', () => {
  assert.deepEqual(
    parseInitArguments([]),
    { force: false, integrations: [], yes: false, dryRun: false },
  );
  assert.deepEqual(
    parseInitArguments(['--force']),
    { force: true, integrations: [], yes: false, dryRun: false },
  );
  assert.deepEqual(
    parseInitArguments(['--integrate', 'codex']),
    { force: false, integrations: ['codex'], yes: false, dryRun: false },
  );
  assert.deepEqual(
    parseInitArguments(['--integrate', 'claude']),
    { force: false, integrations: ['claude'], yes: false, dryRun: false },
  );
  assert.deepEqual(
    parseInitArguments([
      '--integrate', 'claude',
      '--yes',
      '--integrate', 'codex',
      '--dry-run',
      '--force',
    ]),
    { force: true, integrations: ['codex', 'claude'], yes: true, dryRun: true },
  );
  assert.deepEqual(
    parseInitArguments(['--integrate', 'all']),
    { force: false, integrations: [...AGENT_IDS], yes: false, dryRun: false },
  );

  for (const invalid of [
    ['--integrate'],
    ['--integrate', 'unknown'],
    ['--force', '--force'],
    ['--integrate', 'codex', '--integrate', 'codex'],
    ['--integrate', 'all', '--integrate', 'claude'],
    ['--integrate', 'claude', '--integrate', 'all'],
    ['--yes', '--yes'],
    ['--dry-run', '--dry-run'],
    ['--unknown'],
    ['codex'],
  ]) {
    assert.equal(parseInitArguments(invalid), null, invalid.join(' '));
  }
});

test('parses only the documented conservative removal grammar', () => {
  assert.deepEqual(
    parseRemoveArguments(['remove', 'codex']),
    { adapter: 'codex', yes: false, dryRun: false },
  );
  assert.deepEqual(
    parseRemoveArguments(['remove', 'claude', '--yes', '--dry-run']),
    { adapter: 'claude', yes: true, dryRun: true },
  );
  for (const invalid of [
    [],
    ['remove'],
    ['remove', 'all'],
    ['remove', 'unknown'],
    ['remove', 'claude', '--force'],
    ['install', 'claude'],
  ]) {
    assert.equal(parseRemoveArguments(invalid), null, invalid.join(' '));
  }
});

test('confirmation is injectable, defaults safely, and dry-run never prompts', async () => {
  const action = {
    kind: 'create' as const,
    target: 'CLAUDE.md',
    reason: 'test plan',
  };

  for (const answer of [true, false]) {
    const capture = captureIO();
    let prompts = 0;
    const terminal: CliTerminal = {
      isInteractive: true,
      confirm: async (prompt) => {
        prompts += 1;
        assert.equal(prompt, 'Continue? [y/N] ');
        return answer;
      },
    };
    assert.equal(
      await authorizePlan([action], false, false, capture.io, terminal),
      answer ? 'apply' : 'stop',
    );
    assert.equal(prompts, 1);
  }

  const dryCapture = captureIO();
  const noPrompt: CliTerminal = {
    isInteractive: false,
    confirm: async () => {
      throw new Error('dry-run must not prompt');
    },
  };
  assert.equal(
    await authorizePlan([action], true, true, dryCapture.io, noPrompt),
    'stop',
  );
  assert.match(dryCapture.stdout.join('\n'), /DRY RUN/);

  const nonInteractive = captureIO();
  assert.equal(
    await authorizePlan([action], false, false, nonInteractive.io, noPrompt),
    'error',
  );
  assert.match(nonInteractive.stderr.join('\n'), /GK002.*--yes/s);
});

test('prints the package version successfully', async () => {
  const capture = captureIO();
  const exitCode = await run(['--version'], capture.io);

  assert.equal(exitCode, EXIT_SUCCESS);
  assert.deepEqual(capture.stdout, ['0.5.0']);
  assert.equal(capture.stderr.length, 0);
});

test('rejects an unknown command as a usage error', async () => {
  const capture = captureIO();
  const exitCode = await run(['unknown'], capture.io);

  assert.equal(exitCode, EXIT_USAGE);
  assert.match(capture.stderr.join('\n'), /Unknown command: unknown/);
});

test('update rejects every argument with GK002 before external work', async () => {
  for (const args of [['--check'], ['latest'], ['--force', '--check']]) {
    const capture = captureIO();
    const exitCode = await run(['update', ...args], capture.io);
    assert.equal(exitCode, EXIT_USAGE);
    assert.match(capture.stderr.join('\n'), /GK002/);
    assert.equal(capture.stdout.length, 0);
  }
});

test('compiled CLI entrypoint returns success for --help', async () => {
  const cliPath = fileURLToPath(new URL('../../src/cli.js', import.meta.url));
  const result = await runCommand(process.execPath, [cliPath, '--help'], process.cwd());

  assert.equal(result.exitCode, EXIT_SUCCESS);
  assert.match(result.stdout, /GraphKeeper/);
  assert.equal(result.stderr, '');
});

test('compiled CLI entrypoint runs through an npm-style symlink', {
  skip: process.platform === 'win32',
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'graphkeeper-cli-link-'));
  try {
    const cliPath = fileURLToPath(new URL('../../src/cli.js', import.meta.url));
    const linkPath = join(directory, 'graphkeeper');
    await symlink(cliPath, linkPath);

    const result = await runCommand(process.execPath, [linkPath, '--version'], directory);

    assert.equal(result.exitCode, EXIT_SUCCESS);
    assert.equal(result.stdout, '0.5.0\n');
    assert.equal(result.stderr, '');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
