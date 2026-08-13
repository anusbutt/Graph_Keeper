import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { EXIT_CODES, GraphKeeperError, diagnostic, type ExitCode } from './lib/errors.js';
import { findGitRoot } from './lib/git.js';
import { loadValidationSnapshot, type ValidationMode } from './lib/git-snapshot.js';
import { runProcess } from './lib/process.js';
import { validateSnapshot } from './lib/validation.js';

export interface StandaloneValidatorReport {
  readonly exitCode: ExitCode;
  readonly stdout: string;
  readonly stderr: string;
}

function terminal(exitCode: ExitCode, stderr: string): StandaloneValidatorReport {
  return { exitCode, stdout: '', stderr: stderr + '\n' };
}

export async function runStandaloneValidator(
  args: readonly string[],
  cwd = process.cwd(),
): Promise<StandaloneValidatorReport> {
  if (args.length !== 1) {
    return terminal(EXIT_CODES.usage, 'GK002 expected --staged or --worktree');
  }
  const selected = args[0];
  if (selected !== '--staged' && selected !== '--worktree') {
    return terminal(EXIT_CODES.usage, 'GK002 invalid validator mode');
  }
  const mode: ValidationMode = selected;

  const git = await runProcess('git', ['--version'], { cwd, timeoutMs: 10_000 });
  if (git.exitCode !== 0) {
    return terminal(EXIT_CODES.prerequisite, 'GK003 git is required');
  }

  try {
    const repositoryRoot = await findGitRoot(cwd);
    return validateSnapshot(await loadValidationSnapshot({ repositoryRoot, mode }));
  } catch (error: unknown) {
    if (error instanceof GraphKeeperError) {
      return terminal(error.exitCode, diagnostic(error.code, error.message, error.context));
    }
    const detail = error instanceof Error ? error.message : String(error);
    return terminal(EXIT_CODES.operational, diagnostic('GK004', 'unable to validate repository: ' + detail));
  }
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
  runStandaloneValidator(process.argv.slice(2))
    .then((report) => {
      if (report.stdout.length > 0) process.stdout.write(report.stdout);
      if (report.stderr.length > 0) process.stderr.write(report.stderr);
      process.exitCode = report.exitCode;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(diagnostic('GK004', 'unable to validate repository: ' + message) + '\n');
      process.exitCode = EXIT_CODES.operational;
    });
}
