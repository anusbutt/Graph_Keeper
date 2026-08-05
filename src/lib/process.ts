import { spawn } from 'node:child_process';

export type ProcessProblem = 'missing' | 'timeout' | 'spawn';

export interface ProcessResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly problem?: ProcessProblem;
  readonly error?: Error;
}

export interface RunProcessOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
}

export async function runProcess(
  command: string,
  args: readonly string[],
  options: RunProcessOptions = {},
): Promise<ProcessResult> {
  return new Promise((resolveResult) => {
    let settled = false;
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const finish = (result: ProcessResult): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolveResult(result);
    };

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', (error: NodeJS.ErrnoException) => {
      finish({
        exitCode: null,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        problem: error.code === 'ENOENT' ? 'missing' : 'spawn',
        error,
      });
    });
    child.once('close', (code) => {
      finish({
        exitCode: timedOut ? null : code,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        ...(timedOut ? { problem: 'timeout' as const } : {}),
      });
    });

    if (options.timeoutMs !== undefined) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, options.timeoutMs);
    }
  });
}

export interface CommandProbe {
  readonly available: boolean;
  readonly version?: string;
  readonly problem?: ProcessProblem;
}

export async function probeCommand(command: string, versionArgs: readonly string[]): Promise<CommandProbe> {
  const result = await runProcess(command, versionArgs, { timeoutMs: 10_000 });
  if (result.exitCode !== 0) {
    return {
      available: false,
      ...(result.problem === undefined ? {} : { problem: result.problem }),
    };
  }
  return { available: true, version: (result.stdout || result.stderr).trim() };
}
