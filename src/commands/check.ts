import { access } from 'node:fs/promises';
import { join } from 'node:path';

import { EXIT_CODES, GraphKeeperError, diagnostic, type ExitCode } from '../lib/errors.js';
import { findGitRoot } from '../lib/git.js';
import { runProcess, type ProcessResult, type RunProcessOptions } from '../lib/process.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export type CheckRunner = (
  command: string,
  args: readonly string[],
  options: RunProcessOptions,
) => Promise<ProcessResult>;

export interface CheckOptions {
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly runner?: CheckRunner;
}

export interface CheckReport {
  readonly exitCode: ExitCode;
  readonly stdout: string;
  readonly stderr: string;
}

function appendDiagnostic(output: string, message: string): string {
  if (output.length === 0) return message + '\n';
  return output.endsWith('\n') ? output + message + '\n' : output + '\n' + message + '\n';
}

function failure(exitCode: ExitCode, message: string, output = ''): CheckReport {
  return { exitCode, stdout: '', stderr: appendDiagnostic(output, message) };
}

function mappedExitCode(exitCode: number): ExitCode {
  if (exitCode >= EXIT_CODES.success && exitCode <= EXIT_CODES.operational) {
    return exitCode as ExitCode;
  }
  return EXIT_CODES.internal;
}

export async function check(options: CheckOptions): Promise<CheckReport> {
  let repositoryRoot: string;
  try {
    repositoryRoot = await findGitRoot(options.cwd);
  } catch (error: unknown) {
    if (error instanceof GraphKeeperError) {
      return failure(error.exitCode, diagnostic(error.code, error.message, error.context));
    }
    throw error;
  }

  const nodeValidatorPath = join(repositoryRoot, 'scripts', 'validate.mjs');
  const shellValidatorPath = join(repositoryRoot, 'scripts', 'validate.sh');
  let validatorPath = nodeValidatorPath;
  let command = process.execPath;
  try {
    await access(nodeValidatorPath);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      try {
        await access(shellValidatorPath);
        validatorPath = shellValidatorPath;
        command = 'sh';
      } catch (shellError: unknown) {
        if (shellError instanceof Error && 'code' in shellError && shellError.code === 'ENOENT') {
          return failure(
            EXIT_CODES.operational,
            diagnostic('GK004', 'repository validator is missing; run graphkeeper init', nodeValidatorPath),
          );
        }
        const message = shellError instanceof Error ? shellError.message : String(shellError);
        return failure(
          EXIT_CODES.operational,
          diagnostic('GK004', 'cannot access repository validator: ' + message, shellValidatorPath),
        );
      }
    } else {
      const message = error instanceof Error ? error.message : String(error);
      return failure(
        EXIT_CODES.operational,
        diagnostic('GK004', 'cannot access repository validator: ' + message, nodeValidatorPath),
      );
    }
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runner = options.runner ?? runProcess;
  const result = await runner(command, [validatorPath, '--worktree'], {
    cwd: repositoryRoot,
    timeoutMs,
  });

  if (result.problem === 'missing') {
    return failure(
      EXIT_CODES.prerequisite,
      command === 'sh'
        ? diagnostic('GK003', 'sh is required; use Git Bash or WSL on Windows')
        : diagnostic('GK003', 'Node.js is required to run repository validator'),
      result.stderr,
    );
  }
  if (result.problem === 'timeout') {
    return failure(
      EXIT_CODES.operational,
      diagnostic('GK004', 'validator timed out after ' + timeoutMs + ' ms'),
      result.stderr,
    );
  }
  if (result.problem === 'spawn' || result.exitCode === null) {
    const detail = result.error?.message;
    return failure(
      EXIT_CODES.operational,
      diagnostic('GK004', 'unable to run repository validator' + (detail === undefined ? '' : ': ' + detail)),
      result.stderr,
    );
  }

  const exitCode = mappedExitCode(result.exitCode);
  if (exitCode === EXIT_CODES.internal) {
    return {
      exitCode,
      stdout: result.stdout,
      stderr: appendDiagnostic(result.stderr, diagnostic('GK005', 'validator returned unexpected exit code ' + result.exitCode)),
    };
  }
  return { exitCode, stdout: result.stdout, stderr: result.stderr };
}
