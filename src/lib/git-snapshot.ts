import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  runProcess,
  type ProcessResult,
  type RunProcessOptions,
} from './process.js';

export type ValidationMode = '--staged' | '--worktree';
export type GraphDocumentName = 'entities' | 'claims' | 'runs';

export interface SnapshotDocument {
  readonly path: string;
  readonly content: string;
  readonly missing: boolean;
}

export interface GraphDocuments {
  readonly entities: SnapshotDocument;
  readonly claims: SnapshotDocument;
  readonly runs: SnapshotDocument;
}

export interface SnapshotIssue {
  readonly code: 'GK004' | 'GK101';
  readonly phase: 'load' | 'evidence';
  readonly context?: string;
  readonly message: string;
}

export interface EvidenceChange {
  readonly status: string;
  readonly paths: readonly string[];
}

export interface ValidationSnapshot {
  readonly mode: ValidationMode;
  readonly current: GraphDocuments;
  readonly head: GraphDocuments | null;
  readonly evidenceChanges: readonly EvidenceChange[];
  readonly evidenceStderr: string;
  readonly issues: readonly SnapshotIssue[];
}

export type ProcessRunner = (
  command: string,
  args: readonly string[],
  options?: RunProcessOptions,
) => Promise<ProcessResult>;

export interface LoadValidationSnapshotOptions {
  readonly repositoryRoot: string;
  readonly mode: ValidationMode;
  readonly runner?: ProcessRunner;
}

const GRAPH_DOCUMENTS: readonly [GraphDocumentName, string][] = [
  ['entities', 'graph/entities.json'],
  ['claims', 'graph/claims.json'],
  ['runs', 'graph/runs.json'],
];

function emptyDocument(path: string): SnapshotDocument {
  return { path, content: '[]\n', missing: true };
}

function documentsFrom(entries: ReadonlyMap<GraphDocumentName, SnapshotDocument>): GraphDocuments {
  const entities = entries.get('entities');
  const claims = entries.get('claims');
  const runs = entries.get('runs');
  if (entities === undefined || claims === undefined || runs === undefined) {
    throw new Error('incomplete graph snapshot');
  }
  return { entities, claims, runs };
}

async function git(
  runner: ProcessRunner,
  repositoryRoot: string,
  args: readonly string[],
): Promise<ProcessResult> {
  return runner('git', args, { cwd: repositoryRoot, timeoutMs: 10_000 });
}

async function loadWorktreeDocuments(
  repositoryRoot: string,
  issues: SnapshotIssue[],
): Promise<GraphDocuments> {
  const documents = new Map<GraphDocumentName, SnapshotDocument>();
  for (const [name, path] of GRAPH_DOCUMENTS) {
    try {
      const content = await readFile(join(repositoryRoot, ...path.split('/')), 'utf8');
      documents.set(name, { path, content, missing: false });
    } catch (error: unknown) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : undefined;
      if (code === 'ENOENT') {
        issues.push({
          code: 'GK101',
          phase: 'load',
          context: path,
          message: 'required file is missing; fix: restore it or run graphkeeper init',
        });
      } else {
        issues.push({
          code: 'GK004',
          phase: 'load',
          context: path,
          message: 'cannot read file; fix: restore read permission',
        });
      }
      documents.set(name, emptyDocument(path));
    }
  }
  return documentsFrom(documents);
}

async function loadStagedDocuments(
  repositoryRoot: string,
  runner: ProcessRunner,
  issues: SnapshotIssue[],
): Promise<GraphDocuments> {
  const documents = new Map<GraphDocumentName, SnapshotDocument>();
  for (const [name, path] of GRAPH_DOCUMENTS) {
    const specifier = ':' + path;
    const exists = await git(runner, repositoryRoot, ['cat-file', '-e', specifier]);
    if (exists.exitCode !== 0) {
      issues.push({
        code: 'GK101',
        phase: 'load',
        context: path,
        message: 'required staged file is missing; fix: add and stage the required file',
      });
      documents.set(name, emptyDocument(path));
      continue;
    }

    const selected = await git(runner, repositoryRoot, ['show', specifier]);
    if (selected.exitCode !== 0) {
      issues.push({
        code: 'GK004',
        phase: 'load',
        context: path,
        message: 'cannot read staged file; fix: restage a readable file',
      });
      documents.set(name, emptyDocument(path));
      continue;
    }
    documents.set(name, { path, content: selected.stdout, missing: false });
  }
  return documentsFrom(documents);
}

async function loadHeadDocuments(
  repositoryRoot: string,
  runner: ProcessRunner,
): Promise<GraphDocuments | null> {
  const head = await git(runner, repositoryRoot, ['rev-parse', '--verify', 'HEAD']);
  if (head.exitCode !== 0) return null;

  const documents = new Map<GraphDocumentName, SnapshotDocument>();
  for (const [name, path] of GRAPH_DOCUMENTS) {
    const result = await git(runner, repositoryRoot, ['show', 'HEAD:' + path]);
    documents.set(name, result.exitCode === 0
      ? { path, content: result.stdout, missing: false }
      : emptyDocument(path));
  }
  return documentsFrom(documents);
}

export function parseEvidenceChanges(output: string): EvidenceChange[] {
  if (output.length === 0) return [];
  const fields = output.split('\0');
  if (fields.at(-1) === '') fields.pop();
  const changes: EvidenceChange[] = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index] ?? '';
    index += 1;
    const pathCount = status.startsWith('R') || status.startsWith('C') ? 2 : 1;
    const paths = fields.slice(index, index + pathCount);
    index += pathCount;
    if (status.length > 0 && paths.length === pathCount) changes.push({ status, paths });
  }
  return changes;
}

async function loadEvidenceChanges(
  repositoryRoot: string,
  mode: ValidationMode,
  runner: ProcessRunner,
  hasBaseline: boolean,
  issues: SnapshotIssue[],
): Promise<{ changes: EvidenceChange[]; stderr: string }> {
  if (!hasBaseline) return { changes: [], stderr: '' };
  const args = [
    'diff',
    ...(mode === '--staged' ? ['--cached'] : []),
    '--name-status',
    '-z',
    '--diff-filter=MDR',
    'HEAD',
    '--',
    'evidence/',
  ];
  const result = await git(runner, repositoryRoot, args);
  if (result.exitCode !== 0) {
    issues.push({
      code: 'GK004',
      phase: 'evidence',
      message: mode === '--staged'
        ? 'unable to compare staged evidence with HEAD'
        : 'unable to compare evidence with HEAD',
    });
    return { changes: [], stderr: result.stderr };
  }
  return { changes: parseEvidenceChanges(result.stdout), stderr: result.stderr };
}

export async function loadValidationSnapshot(
  options: LoadValidationSnapshotOptions,
): Promise<ValidationSnapshot> {
  const runner = options.runner ?? runProcess;
  const issues: SnapshotIssue[] = [];
  const current = options.mode === '--staged'
    ? await loadStagedDocuments(options.repositoryRoot, runner, issues)
    : await loadWorktreeDocuments(options.repositoryRoot, issues);
  const head = await loadHeadDocuments(options.repositoryRoot, runner);
  const evidence = await loadEvidenceChanges(
    options.repositoryRoot,
    options.mode,
    runner,
    head !== null,
    issues,
  );
  return {
    mode: options.mode,
    current,
    head,
    evidenceChanges: evidence.changes,
    evidenceStderr: evidence.stderr,
    issues,
  };
}
