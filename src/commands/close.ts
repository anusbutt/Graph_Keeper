import { EXIT_CODES, GraphKeeperError, diagnostic, type ExitCode } from '../lib/errors.js';
import { findGitRoot } from '../lib/git.js';
import {
  LockTimeoutError,
  mutateJsonArrayFile,
  OptimisticWriteError,
} from '../lib/optimistic-write.js';
import {
  parseRuns,
  RecordValidationError,
  type Run,
  type RunVerdict,
} from '../lib/records.js';

const CLOSE_FLAGS = new Set(['id', 'ended', 'verdict']);
const VERDICTS = new Set<RunVerdict>(['passed', 'failed', 'inconclusive', 'aborted']);

export interface CloseRunOptions {
  readonly id: string;
  readonly ended: string;
  readonly verdict: RunVerdict;
}

export interface CloseReport {
  readonly exitCode: ExitCode;
  readonly stdout: string;
  readonly stderr: string;
}

export type ParsedClose =
  | { readonly ok: true; readonly options: CloseRunOptions }
  | { readonly ok: false; readonly usageError: string };

function rejected(usageError: string): ParsedClose {
  return { ok: false, usageError };
}

export function parseCloseArguments(
  recordType: string | undefined,
  args: readonly string[],
): ParsedClose {
  if (recordType !== 'run') return rejected('close requires a record type: run');

  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined || !argument.startsWith('--')) {
      return rejected('unexpected close argument: ' + (argument ?? ''));
    }
    const name = argument.slice(2);
    if (!CLOSE_FLAGS.has(name)) return rejected('unknown close flag: ' + argument);
    if (values.has(name)) return rejected('duplicate close flag: ' + argument);

    const value = args[index + 1];
    if (value === undefined || value.length === 0 || value.startsWith('--')) {
      return rejected(argument + ' requires a value');
    }
    values.set(name, value);
    index += 1;
  }

  for (const required of ['id', 'ended', 'verdict']) {
    if (!values.has(required)) return rejected('--' + required + ' is required');
  }
  const verdict = values.get('verdict') as string;
  if (!VERDICTS.has(verdict as RunVerdict)) {
    return rejected('--verdict must be passed|failed|inconclusive|aborted');
  }

  return {
    ok: true,
    options: {
      id: values.get('id') as string,
      ended: values.get('ended') as string,
      verdict: verdict as RunVerdict,
    },
  };
}

function failureResult(error: GraphKeeperError): CloseReport {
  return {
    exitCode: error.exitCode,
    stdout: '',
    stderr: diagnostic(error.code, error.message, error.context) + '\n',
  };
}

function parseExistingRuns(records: unknown[], context: string): Run[] {
  try {
    return parseRuns(records);
  } catch (error: unknown) {
    if (error instanceof RecordValidationError) {
      throw new GraphKeeperError(
        'GK401',
        'validation',
        'existing run data is invalid: ' + error.message,
        context,
      );
    }
    throw error;
  }
}

function validateClosedCandidate(runs: Run[], index: number, closed: Run, context: string): void {
  const candidate = [...runs];
  candidate[index] = closed;
  try {
    parseRuns(candidate);
  } catch (error: unknown) {
    if (error instanceof RecordValidationError) {
      throw new GraphKeeperError('GK401', 'validation', error.message, context);
    }
    throw error;
  }
}

export async function runClose(
  options: CloseRunOptions,
  cwd: string = process.cwd(),
): Promise<CloseReport> {
  let repositoryRoot: string;
  try {
    repositoryRoot = await findGitRoot(cwd);
  } catch (error: unknown) {
    if (error instanceof GraphKeeperError) return failureResult(error);
    throw error;
  }

  try {
    await mutateJsonArrayFile(repositoryRoot, 'graph/runs.json', (records) => {
      const runs = parseExistingRuns(records, options.id);
      const index = runs.findIndex((run) => run.id === options.id);
      if (index === -1) {
        throw new GraphKeeperError('GK401', 'validation', 'run does not exist', options.id);
      }
      const current = runs[index] as Run;
      if (current.ended !== undefined || current.verdict !== undefined) {
        throw new GraphKeeperError('GK401', 'validation', 'run is already closed', options.id);
      }

      const closed: Run = {
        ...current,
        ended: options.ended,
        verdict: options.verdict,
      };
      validateClosedCandidate(runs, index, closed, options.id);
      records[index] = closed;
    });
    return {
      exitCode: EXIT_CODES.success,
      stdout: 'Closed run ' + options.id + '\n',
      stderr: '',
    };
  } catch (error: unknown) {
    if (error instanceof GraphKeeperError) return failureResult(error);
    if (error instanceof OptimisticWriteError || error instanceof LockTimeoutError) {
      return {
        exitCode: EXIT_CODES.operational,
        stdout: '',
        stderr: diagnostic('GK400', error.message) + '\n',
      };
    }
    throw error;
  }
}
