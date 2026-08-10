import { GraphKeeperError } from '../lib/errors.js';
import { runProcess, type ProcessResult } from '../lib/process.js';

export type StableVersion = readonly [number, number, number];

export interface UpdateEnvironment {
  readonly platform: NodeJS.Platform;
  readonly env: NodeJS.ProcessEnv;
  readonly run: (
    command: string,
    args: readonly string[],
    timeoutMs: number,
    env: NodeJS.ProcessEnv,
  ) => Promise<ProcessResult>;
}

export interface UpdateOptions {
  readonly currentVersion: string;
  readonly environment?: UpdateEnvironment;
}

export type UpdateStatus = 'current' | 'ahead' | 'updated';

export interface UpdateReport {
  readonly status: UpdateStatus;
  readonly currentVersion: string;
  readonly latestVersion: string;
}

const defaultEnvironment: UpdateEnvironment = {
  platform: process.platform,
  env: process.env,
  run: (command, args, timeoutMs, env) =>
    runProcess(command, args, { env, timeoutMs }),
};

function prerequisite(message: string): GraphKeeperError {
  return new GraphKeeperError('GK003', 'prerequisite', message);
}

function operational(message: string): GraphKeeperError {
  return new GraphKeeperError('GK004', 'operational', message);
}

export function parseStableVersion(version: string): StableVersion | null {
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.exec(version);
  if (match === null) return null;
  const values = match.slice(1).map((value) => Number.parseInt(value, 10));
  if (!values.every(Number.isSafeInteger)) return null;
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];
}

export function compareStableVersions(left: string, right: string): -1 | 0 | 1 {
  const leftParts = parseStableVersion(left);
  const rightParts = parseStableVersion(right);
  if (leftParts === null || rightParts === null) {
    throw new TypeError('Stable semantic versions are required');
  }
  for (let index = 0; index < leftParts.length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }
  return 0;
}

function registryVersion(output: string): string | null {
  const trimmed = output.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return parseStableVersion(trimmed) === null ? null : trimmed;
  }
}

export async function updateGraphKeeper(options: UpdateOptions): Promise<UpdateReport> {
  const environment = options.environment ?? defaultEnvironment;
  if (environment.platform === 'win32' && !environment.env.MSYSTEM) {
    throw prerequisite(
      'GraphKeeper v1 does not support native PowerShell. Run update through Git Bash or WSL.',
    );
  }
  if (parseStableVersion(options.currentVersion) === null) {
    throw operational('The running GraphKeeper version is invalid; reinstall GraphKeeper with npm.');
  }

  const lookup = await environment.run(
    'npm',
    ['view', 'graphkeeper@latest', 'version', '--json'],
    30_000,
    environment.env,
  );
  if (lookup.problem === 'missing') {
    throw prerequisite('npm is required to update GraphKeeper. Install npm, then retry.');
  }
  if (lookup.exitCode !== 0) {
    throw operational('Unable to check the npm registry for GraphKeeper updates; retry when npm registry access is available.');
  }

  const latestVersion = registryVersion(lookup.stdout);
  if (latestVersion === null || parseStableVersion(latestVersion) === null) {
    throw operational('The npm registry returned an invalid stable GraphKeeper version; no update was installed.');
  }
  const comparison = compareStableVersions(options.currentVersion, latestVersion);
  if (comparison >= 0) {
    return {
      status: comparison === 0 ? 'current' : 'ahead',
      currentVersion: options.currentVersion,
      latestVersion,
    };
  }

  const installation = await environment.run(
    'npm',
    ['install', '--global', 'graphkeeper@' + latestVersion],
    120_000,
    environment.env,
  );
  if (installation.exitCode !== 0) {
    throw operational(
      'Unable to install GraphKeeper ' + latestVersion
        + ' globally; check npm permissions and retry the update.',
    );
  }
  return {
    status: 'updated',
    currentVersion: options.currentVersion,
    latestVersion,
  };
}
