#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { check } from './commands/check.js';
import { doctor } from './commands/doctor.js';
import { initialize } from './commands/init.js';
import { query } from './commands/query.js';
import { updateGraphKeeper } from './commands/update.js';
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

const VERSION = '0.1.2';
const COMMANDS = new Set(['init', 'check', 'query', 'doctor', 'update']);

const USAGE = [
  'GraphKeeper - grounded, auditable memory for coding agents',
  '',
  'Usage:',
  '  graphkeeper init [--force] [--integrate codex]',
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

export interface ParsedInitArguments {
  readonly force: boolean;
  readonly integrateCodex: boolean;
}

export function parseInitArguments(
  args: readonly string[],
): ParsedInitArguments | null {
  let force = false;
  let integrateCodex = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--force') {
      if (force) return null;
      force = true;
      continue;
    }
    if (argument === '--integrate') {
      if (integrateCodex || args[index + 1] !== 'codex') return null;
      integrateCodex = true;
      index += 1;
      continue;
    }
    return null;
  }
  return { force, integrateCodex };
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
        'init accepts --force and --integrate codex at most once each',
      ));
      return EXIT_USAGE;
    }
    try {
      const report = await initialize({
        cwd,
        force: parsed.force,
        integrateCodex: parsed.integrateCodex,
      });
      for (const action of report.actions) {
        const message = action.kind.toUpperCase() + ' ' + action.target + ': ' + action.reason;
        if (action.kind === 'warn') {
          io.stderr('WARNING ' + message);
        } else {
          io.stdout(message);
        }
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
