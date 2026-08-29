import { randomUUID } from 'node:crypto';
import { chmod, link, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

import { resolveContainedPath } from './paths.js';

const DEFAULT_MAX_ATTEMPTS = 5;
const FILE_MODE = 0o644;
const INDENT = 2;
const LOCK_WAIT_MS = 25;
const LOCK_TIMEOUT_MS = 5_000;
const STALE_AFTER_MS = 10_000;

export interface MutateOptions {
  readonly maxAttempts?: number;
  readonly lockTimeoutMs?: number;
}

export class OptimisticWriteError extends Error {
  constructor(relativePath: string, attempts: number) {
    super(
      relativePath + ' changed concurrently '
        + attempts + ' times without stabilizing; nothing was written',
    );
    this.name = 'OptimisticWriteError';
  }
}

export class LockTimeoutError extends Error {
  constructor(relativePath: string) {
    super('Timed out waiting for a concurrent writer to release ' + relativePath);
    this.name = 'LockTimeoutError';
  }
}

class ConcurrentChangeError extends Error {
  constructor(target: string) {
    super(target + ' changed concurrently');
    this.name = 'ConcurrentChangeError';
  }
}

function serialize(records: unknown[]): string {
  return JSON.stringify(records, null, INDENT) + '\n';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function lockAgeMs(path: string): Promise<number | null> {
  try {
    const stats = await lstat(path);
    return Date.now() - stats.mtimeMs;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Acquire an exclusive lock file next to `target` via an atomic hard-link from a
 * unique temp file. Only one writer can successfully link at a time, so the
 * read-mutate-rename critical section is serialized among cooperating writers.
 * A stale lock (holder crashed) older than `lockTimeoutMs` is broken. Returns a
 * release function; callers MUST release. Throws `LockTimeoutError` on timeout.
 */
export async function acquireLock(target: string, lockTimeoutMs: number = LOCK_TIMEOUT_MS): Promise<() => Promise<void>> {
  const lockPath = target + '.lock';
  const deadline = Date.now() + lockTimeoutMs;
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o755 });
  for (;;) {
    const holder = resolve(
      dirname(lockPath),
      '.' + basename(lockPath) + '.holder-' + randomUUID(),
    );
    try {
      await writeFile(holder, String(process.pid), { encoding: 'utf8', mode: FILE_MODE });
      await link(holder, lockPath);
      await rm(holder, { force: true });
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        await rm(lockPath, { force: true });
      };
    } catch (error: unknown) {
      await rm(holder, { force: true });
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
      const age = await lockAgeMs(lockPath);
      if (age !== null && age > lockTimeoutMs) {
        await rm(lockPath, { force: true });
        continue;
      }
      if (Date.now() >= deadline) throw new LockTimeoutError(resolve(dirname(target), '.'));
      await sleep(LOCK_WAIT_MS);
    }
  }
}

/**
 * Atomic write of `records` to `target`, but only if on-disk content still
 * matches `expected` at write time (temp-file + compare-before-rename). If it
 * changed, throw `ConcurrentChangeError` so the caller can retry.
 */
async function atomicWriteIfCurrent(target: string, expected: string, records: unknown[]): Promise<void> {
  const temporary = resolve(
    dirname(target),
    '.' + basename(target) + '.graphkeeper-tmp-' + randomUUID(),
  );
  try {
    await writeFile(temporary, serialize(records), { encoding: 'utf8', mode: FILE_MODE });
    await chmod(temporary, FILE_MODE);
    const current = await readFile(target, 'utf8');
    if (current !== expected) throw new ConcurrentChangeError(target);
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

/**
 * Mutate-and-persist a JSON-array file, assuming the caller already holds the
 * file's lock (see `acquireLock`). Reads current content, hands the parsed array
 * to `mutate`, and writes the result through an atomic temp-file +
 * compare-before-rename sequence. If an external (non-locking) writer changes the
 * file, it re-reads, re-applies `mutate`, and retries up to `maxAttempts`
 * (default 5); beyond that it throws `OptimisticWriteError` without modifying the
 * target. `target` must be an absolute, contained path.
 */
export async function writeJsonArrayUnderLock(
  target: string,
  mutate: (records: unknown[]) => void,
  options: MutateOptions = {},
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const expected = await readFile(target, 'utf8');
    let records: unknown[];
    try {
      records = JSON.parse(expected) as unknown[];
    } catch (error: unknown) {
      // A non-cooperating writer can briefly expose a truncated JSON file while
      // replacing it. Treat that transient state like any other concurrent
      // change so callers get the stable optimistic-write diagnostic rather
      // than leaking a parser error.
      if (!(error instanceof SyntaxError)) throw error;
      continue;
    }
    mutate(records);
    try {
      await atomicWriteIfCurrent(target, expected, records);
      return;
    } catch (error: unknown) {
      if (!(error instanceof ConcurrentChangeError)) throw error;
    }
  }
  throw new OptimisticWriteError(target, maxAttempts);
}

/**
 * Concurrency-safe mutate-and-persist for a repository JSON-array graph file
 * (e.g. graph/claims.json, graph/runs.json). Acquires the file's exclusive lock,
 * delegates to `writeJsonArrayUnderLock`, and releases. Use this for a single
 * file; to mutate two files atomically (e.g. a claim plus its run), acquire both
 * locks first, then call `writeJsonArrayUnderLock` for each while holding both.
 */
export async function mutateJsonArrayFile(
  root: string,
  relativePath: string,
  mutate: (records: unknown[]) => void,
  options: MutateOptions = {},
): Promise<void> {
  const lockTimeoutMs = options.lockTimeoutMs ?? LOCK_TIMEOUT_MS;
  const target = resolveContainedPath(root, relativePath);
  await mkdir(dirname(target), { recursive: true, mode: 0o755 });

  const release = await acquireLock(target, lockTimeoutMs);
  try {
    await writeJsonArrayUnderLock(target, mutate, options);
  } finally {
    await release();
  }
}
