import { lstat, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, normalize, parse, relative, resolve, sep } from 'node:path';

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function findRepositoryRoot(start: string): Promise<string | null> {
  let current = resolve(start);
  while (true) {
    if (await exists(resolve(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current || current === parse(current).root) return null;
    current = parent;
  }
}

function safeSegments(relativePath: string): boolean {
  return relativePath.split(/[\\/]/).every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

export function resolveContainedPath(root: string, relativePath: string): string {
  if (relativePath.length === 0 || isAbsolute(relativePath)) throw new Error('Expected a non-empty relative path');
  if (relativePath.includes('\0') || !safeSegments(relativePath)) throw new Error('Refusing unsafe path: ' + relativePath);
  const normalizedRoot = resolve(root);
  const target = resolve(normalizedRoot, normalize(relativePath));
  if (target !== normalizedRoot && !target.startsWith(normalizedRoot + sep)) throw new Error('Refusing unsafe path: ' + relativePath);
  return target;
}

export function resolveEvidencePath(repositoryRoot: string, evidencePath: string): string {
  if (!evidencePath.startsWith('evidence/')) throw new Error('Evidence path must start with evidence/');
  return resolveContainedPath(repositoryRoot, evidencePath);
}

export async function assertRealPathContained(allowedRoot: string, target: string): Promise<string> {
  const [realRoot, realTarget] = await Promise.all([realpath(allowedRoot), realpath(target)]);
  const relation = relative(realRoot, realTarget);
  if (relation === '..' || relation.startsWith('..' + sep) || isAbsolute(relation)) {
    throw new Error('Resolved path escapes allowed root: ' + target);
  }
  return realTarget;
}
