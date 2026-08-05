import { readFile, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { assertRealPathContained, resolveEvidencePath } from './paths.js';

export type EvidenceIssueKind =
  | 'shape'
  | 'unsafe'
  | 'missing'
  | 'outside'
  | 'unreadable'
  | 'non_text'
  | 'range_start'
  | 'range_order'
  | 'out_of_bounds';

export interface EvidenceIssue {
  readonly kind: EvidenceIssueKind;
  readonly message: string;
}

export interface EvidenceInspection {
  readonly reference: string;
  readonly relativePath?: string;
  readonly start?: number;
  readonly end?: number;
  readonly lineCount?: number;
  readonly issues: readonly EvidenceIssue[];
}

interface LoadedEvidence {
  readonly lineCount?: number;
  readonly issues: readonly EvidenceIssue[];
}

export function logicalLineCount(text: string): number {
  if (text.length === 0) return 0;
  const normalized = text.replace(/\r\n/g, '\n');
  const count = normalized.split('\n').length;
  return normalized.endsWith('\n') ? count - 1 : count;
}

function issue(kind: EvidenceIssueKind, message: string): EvidenceIssue {
  return { kind, message };
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

export interface EvidenceInspector {
  readonly inspect: (reference: string) => Promise<EvidenceInspection>;
}

export interface EvidenceInspectorOptions {
  readonly readBytes?: (path: string) => Promise<Buffer>;
}

export function createEvidenceInspector(
  repositoryRoot: string,
  options: EvidenceInspectorOptions = {},
): EvidenceInspector {
  const evidenceRoot = join(repositoryRoot, 'evidence');
  const cache = new Map<string, Promise<LoadedEvidence>>();
  const readBytes = options.readBytes ?? ((path: string) => readFile(path));

  const load = (relativePath: string): Promise<LoadedEvidence> => {
    const existing = cache.get(relativePath);
    if (existing !== undefined) return existing;
    const pending = (async (): Promise<LoadedEvidence> => {
      let target: string;
      try {
        target = resolveEvidencePath(repositoryRoot, relativePath);
      } catch (error: unknown) {
        return { issues: [issue('unsafe', error instanceof Error ? error.message : String(error))] };
      }
      try {
        await realpath(evidenceRoot);
        await assertRealPathContained(evidenceRoot, target);
      } catch (error: unknown) {
        if (errorCode(error) === 'ENOENT') return { issues: [issue('missing', 'referenced evidence file does not exist')] };
        if (error instanceof Error && error.message.includes('escapes allowed root')) {
          return { issues: [issue('outside', 'resolved evidence path leaves evidence/') ] };
        }
        return { issues: [issue('unreadable', error instanceof Error ? error.message : String(error))] };
      }
      try {
        const details = await stat(target);
        if (!details.isFile()) return { issues: [issue('non_text', 'evidence target is not a regular file')] };
        if ((details.mode & 0o444) === 0) return { issues: [issue('unreadable', 'evidence file has no read permission')] };
        const bytes = await readBytes(target);
        let text: string;
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
          return { issues: [issue('non_text', 'evidence is not valid UTF-8 text')] };
        }
        if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
          return { issues: [issue('non_text', 'evidence contains binary control bytes')] };
        }
        return { lineCount: logicalLineCount(text), issues: [] };
      } catch (error: unknown) {
        if (errorCode(error) === 'ENOENT') return { issues: [issue('missing', 'referenced evidence file does not exist')] };
        return { issues: [issue('unreadable', error instanceof Error ? error.message : String(error))] };
      }
    })();
    cache.set(relativePath, pending);
    return pending;
  };

  return {
    inspect: async (reference: string): Promise<EvidenceInspection> => {
      const match = /^(evidence\/[^#]+)#L([0-9]+)-L([0-9]+)$/.exec(reference);
      if (match === null || match[1] === undefined || match[2] === undefined || match[3] === undefined) {
        return { reference, issues: [issue('shape', 'expected evidence/<file>#L<start>-L<end>')] };
      }
      const relativePath = match[1];
      const start = Number(match[2]);
      const end = Number(match[3]);
      const issues: EvidenceIssue[] = [];
      if (start < 1) issues.push(issue('range_start', 'range start must be at least 1'));
      if (start > end) issues.push(issue('range_order', 'range start must not exceed range end'));
      const loaded = await load(relativePath);
      issues.push(...loaded.issues);
      if (loaded.lineCount !== undefined && end > loaded.lineCount) {
        issues.push(issue('out_of_bounds', 'range end ' + end + ' exceeds line count ' + loaded.lineCount));
      }
      return {
        reference,
        relativePath,
        start,
        end,
        ...(loaded.lineCount === undefined ? {} : { lineCount: loaded.lineCount }),
        issues,
      };
    },
  };
}
