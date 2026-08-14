#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import { check } from './commands/check.js';
import { doctor } from './commands/doctor.js';
import {
  applyInitialization,
  prepareInitialization,
  type ScaffoldAction,
} from './commands/init.js';
import {
  applyAgentIntegrationPlan,
  prepareAgentRemoval,
  type IntegrationAction,
} from './commands/integrate.js';
import { query } from './commands/query.js';
import { updateGraphKeeper } from './commands/update.js';
import {
  AGENT_IDS,
  isAgentId,
  type AgentId,
} from './lib/agent-adapters.js';
import {
  EXIT_CODES,
  GraphKeeperError,
  diagnostic,
} from './lib/errors.js';

export const EXIT_SUCCESS = EXIT_CODES.success;
export const EXIT_VALIDATION = EXIT_CODES.validation;
export const EXIT_USAGE = EXIT_CODES.usage;
export const EXIT_PREREQUISITE = EXIT_CODES.prerequisite;
export const EXIT_OPERATIONAL = EXIT_CODES.operational;
export const EXIT_INTERNAL = EXIT_CODES.internal;

export interface CliIO {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

export interface CliTerminal {
  readonly isInteractive: boolean;
  readonly confirm: (prompt: string) => Promise<boolean>;
}

const VERSION = '0.4.1';
const COMMANDS = new Set(['init', 'integrate', 'check', 'query', 'doctor', 'update']);

const USAGE = [
  'GraphKeeper - grounded, auditable memory for coding agents',
  '',
  'Usage:',
  '  graphkeeper init [--force] [--integrate <codex|claude|all>]... [--yes] [--dry-run]',
  '  graphkeeper integrate remove <codex|claude> [--yes] [--dry-run]',
  '  graphkeeper check',
  '  graphkeeper query <subject>',
  '  graphkeeper doctor',
  '  graphkeeper update',
  '  graphkeeper --help',
  '  graphkeeper --version',
].join('\n');

const processIO: CliIO = {
  stdout: (message) => process.stdout.write(message + '\n'),
  stderr: (message) => process.stderr.write(message + '\n'),
};

const processTerminal: CliTerminal = {
  isInteractive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  confirm: async (prompt) => {
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await terminal.question(prompt);
      return /^(?:y|yes)$/i.test(answer.trim());
    } catch {
      return false;
    } finally {
      terminal.close();
    }
  },
};

export interface ParsedInitArguments {
  readonly force: boolean;
  readonly integrations: readonly AgentId[];
  readonly yes: boolean;
  readonly dryRun: boolean;
}

export function parseInitArguments(
  args: readonly string[],
): ParsedInitArguments | null {
  let force = false;
  let yes = false;
  let dryRun = false;
  const explicit: AgentId[] = [];
  let all = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--force') {
      if (force) return null;
      force = true;
      continue;
    }
    if (argument === '--yes') {
      if (yes) return null;
      yes = true;
      continue;
    }
    if (argument === '--dry-run') {
      if (dryRun) return null;
      dryRun = true;
      continue;
    }
    if (argument === '--integrate') {
      const value = args[index + 1];
      if (value === undefined) return null;
      if (value === 'all') {
        if (all || explicit.length > 0) return null;
        all = true;
      } else if (isAgentId(value)) {
        if (all || explicit.includes(value)) return null;
        explicit.push(value);
      } else {
        return null;
      }
      index += 1;
      continue;
    }
    return null;
  }
  return {
    force,
    integrations: all ? [...AGENT_IDS] : AGENT_IDS.filter((id) => explicit.includes(id)),
    yes,
    dryRun,
  };
}

export interface ParsedRemoveArguments {
  readonly adapter: AgentId;
  readonly yes: boolean;
  readonly dryRun: boolean;
}

export function parseRemoveArguments(
  args: readonly string[],
): ParsedRemoveArguments | null {
  if (args[0] !== 'remove' || args[1] === undefined || !isAgentId(args[1])) return null;
  let yes = false;
  let dryRun = false;
  for (const argument of args.slice(2)) {
    if (argument === '--yes' && !yes) {
      yes = true;
    } else if (argument === '--dry-run' && !dryRun) {
      dryRun = true;
    } else {
      return null;
    }
  }
  return { adapter: args[1], yes, dryRun };
}

type DisplayAction = ScaffoldAction | IntegrationAction;

function printPlan(actions: readonly DisplayAction[], io: CliIO): void {
  io.stdout('GraphKeeper will:');
  for (const action of actions) {
    io.stdout('  ' + action.kind.toUpperCase() + ' ' + action.target + ': ' + action.reason);
  }
  io.stdout('  Existing content outside matching GraphKeeper marked blocks will be preserved.');
}

function printCompleted(actions: readonly DisplayAction[], io: CliIO): void {
  for (const action of actions) {
    const message = action.kind.toUpperCase() + ' ' + action.target + ': ' + action.reason;
    if (action.kind === 'warn' || action.kind === 'warning' || action.kind === 'preserve') {
      io.stderr('WARNING ' + message);
    } else {
      io.stdout(message);
    }
  }
}

export async function authorizePlan(
  actions: readonly DisplayAction[],
  yes: boolean,
  dryRun: boolean,
  io: CliIO,
  terminal: CliTerminal,
): Promise<'apply' | 'stop' | 'error'> {
  printPlan(actions, io);
  if (dryRun) {
    io.stdout('DRY RUN No changes were made.');
    return 'stop';
  }
  if (yes) return 'apply';
  if (!terminal.isInteractive) {
    io.stderr(diagnostic(
      'GK002',
      'confirmation is required in non-interactive mode; rerun with --yes or --dry-run',
    ));
    return 'error';
  }
  if (!await terminal.confirm('Continue? [y/N] ')) {
    io.stdout('Cancelled; no changes were made.');
    return 'stop';
  }
  return 'apply';
}

function forwardOutput(output: string, write: (message: string) => void): void {
  const lines = output.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  for (const line of lines) write(line);
}

export async function run(
  argv: readonly string[],
  io: CliIO = processIO,
  cwd: string = process.cwd(),
  terminal: CliTerminal = processTerminal,
): Promise<number> {
  const command = argv[0];

  if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
    io.stdout(USAGE);
    return EXIT_SUCCESS;
  }

  if (command === '--version' || command === '-v') {
    io.stdout(VERSION);
    return EXIT_SUCCESS;
  }

  if (!COMMANDS.has(command)) {
    io.stderr('Unknown command: ' + command);
    io.stderr(USAGE);
    return EXIT_USAGE;
  }

  if (command === 'init') {
    const initArguments = argv.slice(1);
    const parsed = parseInitArguments(initArguments);
    if (parsed === null) {
      io.stderr(diagnostic(
        'GK002',
        'init accepts --force, distinct --integrate codex|claude flags or --integrate all, --yes, and --dry-run',
      ));
      return EXIT_USAGE;
    }
    try {
      const prepared = await prepareInitialization({
        cwd,
        force: parsed.force,
        integrations: parsed.integrations,
      });
      if (parsed.integrations.length > 0 || parsed.dryRun) {
        const authorization = await authorizePlan(
          prepared.actions,
          parsed.yes,
          parsed.dryRun,
          io,
          terminal,
        );
        if (authorization === 'error') return EXIT_USAGE;
        if (authorization === 'stop') return EXIT_SUCCESS;
      }
      const report = await applyInitialization(prepared);
      printCompleted(report.actions, io);
      for (const note of report.notes) io.stdout('NOTE ' + note);
      return EXIT_SUCCESS;
    } catch (error: unknown) {
      if (error instanceof GraphKeeperError) {
        io.stderr(diagnostic(error.code, error.message, error.context));
        return error.exitCode;
      }
      throw error;
    }
  }

  if (command === 'integrate') {
    const parsed = parseRemoveArguments(argv.slice(1));
    if (parsed === null) {
      io.stderr(diagnostic(
        'GK002',
        'integrate accepts remove <codex|claude> followed by optional --yes and --dry-run',
      ));
      return EXIT_USAGE;
    }
    try {
      const plan = await prepareAgentRemoval(cwd, parsed.adapter);
      const authorization = await authorizePlan(
        plan.actions,
        parsed.yes,
        parsed.dryRun,
        io,
        terminal,
      );
      if (authorization === 'error') return EXIT_USAGE;
      if (authorization === 'stop') return EXIT_SUCCESS;
      await applyAgentIntegrationPlan(plan);
      printCompleted(plan.actions, io);
      return EXIT_SUCCESS;
    } catch (error: unknown) {
      if (error instanceof GraphKeeperError) {
        io.stderr(diagnostic(error.code, error.message, error.context));
        return error.exitCode;
      }
      throw error;
    }
  }

  if (command === 'check') {
    if (argv.length !== 1) {
      io.stderr(diagnostic('GK002', 'check does not accept arguments'));
      return EXIT_USAGE;
    }
    const report = await check({ cwd });
    forwardOutput(report.stdout, io.stdout);
    forwardOutput(report.stderr, io.stderr);
    return report.exitCode;
  }

  if (command === 'query') {
    if (argv.length !== 2 || argv[1] === undefined || argv[1].length === 0) {
      io.stderr(diagnostic('GK002', 'query requires exactly one non-empty subject'));
      return EXIT_USAGE;
    }
    const report = await query({ cwd, subject: argv[1] });
    forwardOutput(report.stdout, io.stdout);
    forwardOutput(report.stderr, io.stderr);
    return report.exitCode;
  }

  if (command === 'doctor') {
    if (argv.length !== 1) {
      io.stderr(diagnostic('GK002', 'doctor does not accept arguments'));
      return EXIT_USAGE;
    }
    const report = await doctor({ cwd });
    forwardOutput(report.stdout, io.stdout);
    forwardOutput(report.stderr, io.stderr);
    return report.exitCode;
  }

  if (command === 'update') {
    if (argv.length !== 1) {
      io.stderr(diagnostic('GK002', 'update does not accept arguments'));
      return EXIT_USAGE;
    }
    try {
      const report = await updateGraphKeeper({ currentVersion: VERSION });
      if (report.status === 'updated') {
        io.stdout(
          'GraphKeeper updated globally from '
            + report.currentVersion + ' to ' + report.latestVersion,
        );
      } else if (report.status === 'current') {
        io.stdout('GraphKeeper ' + report.currentVersion + ' is already current');
      } else {
        io.stdout(
          'GraphKeeper ' + report.currentVersion
            + ' is newer than npm latest ' + report.latestVersion + '; no change made',
        );
      }
      return EXIT_SUCCESS;
    } catch (error: unknown) {
      if (error instanceof GraphKeeperError) {
        io.stderr(diagnostic(error.code, error.message, error.context));
        return error.exitCode;
      }
      throw error;
    }
  }

  io.stderr('Command not implemented in this phase: ' + command);
  return EXIT_INTERNAL;
}

function isEntrypoint(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  run(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      processIO.stderr('Unexpected error: ' + message);
      process.exitCode = EXIT_INTERNAL;
    });
}
