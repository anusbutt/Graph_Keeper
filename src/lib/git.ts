import { isAbsolute, resolve } from 'node:path';

import { GraphKeeperError } from './errors.js';
import { resolveContainedPath } from './paths.js';
import { runProcess } from './process.js';

async function git(cwd: string, args: readonly string[]) {
  return runProcess('git', args, { cwd, timeoutMs: 10_000 });
}

function gitFailure(message: string, stderr: string): GraphKeeperError {
  const detail = stderr.trim();
  return new GraphKeeperError('GK004', 'operational', detail.length === 0 ? message : message + ': ' + detail);
}

export async function findGitRoot(cwd: string): Promise<string> {
  const result = await git(cwd, ['rev-parse', '--show-toplevel']);
  if (result.exitCode !== 0) throw gitFailure('not inside a Git repository', result.stderr);
  return resolve(result.stdout.trim());
}

export async function hasHead(repositoryRoot: string): Promise<boolean> {
  const result = await git(repositoryRoot, ['rev-parse', '--verify', 'HEAD']);
  if (result.exitCode === 0) return true;
  if (result.exitCode === 128) return false;
  throw gitFailure('unable to inspect HEAD', result.stderr);
}

export async function readStagedBlob(repositoryRoot: string, relativePath: string): Promise<string> {
  resolveContainedPath(repositoryRoot, relativePath);
  const result = await git(repositoryRoot, ['show', ':' + relativePath.replaceAll('\\', '/')]);
  if (result.exitCode !== 0) throw gitFailure('unable to read staged file ' + relativePath, result.stderr);
  return result.stdout;
}

export async function resolveHooksPath(repositoryRoot: string): Promise<string> {
  const configured = await git(repositoryRoot, ['config', '--get', 'core.hooksPath']);
  if (configured.exitCode === 0) {
    const value = configured.stdout.trim();
    if (value.length === 0) throw gitFailure('core.hooksPath is empty', configured.stderr);
    return isAbsolute(value) ? resolve(value) : resolveContainedPath(repositoryRoot, value);
  }
  if (configured.exitCode !== 1) throw gitFailure('unable to read core.hooksPath', configured.stderr);

  const normal = await git(repositoryRoot, ['rev-parse', '--git-path', 'hooks']);
  if (normal.exitCode !== 0) throw gitFailure('unable to resolve Git hook directory', normal.stderr);
  const value = normal.stdout.trim();
  return isAbsolute(value) ? resolve(value) : resolve(repositoryRoot, value);
}
