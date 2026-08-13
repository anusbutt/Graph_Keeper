import { isDeepStrictEqual } from 'node:util';

import { diagnostic } from './errors.js';
import type {
  GraphDocuments,
  SnapshotDocument,
  SnapshotIssue,
  ValidationSnapshot,
} from './git-snapshot.js';
import {
  validateClaimRecords,
  validateEntityRecords,
  validateRunRecords,
} from './records.js';

export interface ValidationReport {
  readonly exitCode: 0 | 1;
  readonly stdout: string;
  readonly stderr: string;
  readonly diagnostics: readonly string[];
}

interface ParsedDocuments {
  readonly entities: unknown;
  readonly claims: unknown;
  readonly runs: unknown;
}

interface RelationProblem {
  readonly context: string;
  readonly detail: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function asObjects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function parseDocument(document: SnapshotDocument): { value?: unknown; issue?: string } {
  try {
    return { value: JSON.parse(document.content) as unknown };
  } catch {
    return {
      issue: diagnostic(
        'GK102',
        'invalid JSON; fix: restore a valid JSON array',
        document.path,
      ),
    };
  }
}

function jqText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function recordIds(value: unknown): string {
  if (!Array.isArray(value)) return 'root';
  return value.map((entry, index) => {
    if (!isObject(entry)) return 'index_' + index;
    const id = entry.id;
    return id === null || id === undefined || id === false ? 'index_' + index : jqText(id);
  }).join(',');
}

function duplicateIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const counts = new Map<string, number>();
  for (const entry of value) {
    if (!isObject(entry) || typeof entry.id !== 'string') continue;
    counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
}

function schemaDiagnostic(
  code: 'GK110' | 'GK120' | 'GK130',
  path: string,
  value: unknown,
  description: string,
  fix: string,
): string {
  const ids = recordIds(value);
  const duplicates = duplicateIds(value);
  const detail = (duplicates.length === 0 ? '' : 'duplicate_ids=' + duplicates.join(',') + '; ')
    + 'records=' + ids;
  return diagnostic(code, description + ' (' + detail + '); fix: ' + fix, path + ':' + ids);
}

function stringId(record: Record<string, unknown>): string | undefined {
  return typeof record.id === 'string' ? record.id : undefined;
}

function indexById(records: readonly Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  for (const record of records) {
    const id = stringId(record);
    if (id !== undefined) result.set(id, record);
  }
  return result;
}

function cycleMembers(
  claims: readonly Record<string, unknown>[],
  byClaim: ReadonlyMap<string, Record<string, unknown>>,
): string[] {
  const members = new Set<string>();
  for (const claim of claims) {
    const start = stringId(claim);
    if (start === undefined) continue;
    const path: string[] = [];
    let current: string | undefined = start;
    while (current !== undefined && byClaim.has(current)) {
      const repeatedAt = path.indexOf(current);
      if (repeatedAt !== -1) {
        for (const member of path.slice(repeatedAt)) members.add(member);
        break;
      }
      path.push(current);
      const next: unknown = byClaim.get(current)?.supersedes;
      current = typeof next === 'string' ? next : undefined;
    }
  }
  return [...members].sort();
}

function findRelationProblem(documents: ParsedDocuments): RelationProblem | null {
  if (!Array.isArray(documents.claims)) return null;
  const claims = asObjects(documents.claims);
  const entities = asObjects(documents.entities);
  const runs = asObjects(documents.runs);
  const byClaim = indexById(claims);
  const byEntity = indexById(entities);
  const byRun = indexById(runs);

  const successors = new Map<string, string[]>();
  for (const claim of claims) {
    if (!hasOwn(claim, 'supersedes')) continue;
    const target = claim.supersedes;
    const id = stringId(claim);
    if (typeof target === 'string' && id !== undefined) {
      const ids = successors.get(target) ?? [];
      ids.push(id);
      successors.set(target, ids);
    }
  }
  const forks = [...successors.entries()]
    .filter(([, ids]) => ids.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));
  const cycles = cycleMembers(claims, byClaim);

  let valid = claims.length === documents.claims.length
    && entities.length === (Array.isArray(documents.entities) ? documents.entities.length : 0)
    && runs.length === (Array.isArray(documents.runs) ? documents.runs.length : 0);

  for (const claim of claims) {
    if (typeof claim.subject !== 'string' || !byEntity.has(claim.subject)) valid = false;
    if (typeof claim.produced_by !== 'string' || !byRun.has(claim.produced_by)) valid = false;
    if (hasOwn(claim, 'supersedes')
      && (typeof claim.supersedes !== 'string' || !byClaim.has(claim.supersedes))) valid = false;
  }
  if (forks.length > 0 || cycles.length > 0) valid = false;

  const writtenByRun = new Map<string, Set<string>>();
  const evidenceByRun = new Map<string, Set<string>>();
  for (const run of runs) {
    const runId = stringId(run);
    if (runId === undefined || !Array.isArray(run.claims_written) || !Array.isArray(run.evidence)) {
      valid = false;
      continue;
    }
    const written = new Set(run.claims_written.filter((id): id is string => typeof id === 'string'));
    const evidence = new Set(run.evidence.filter((path): path is string => typeof path === 'string'));
    writtenByRun.set(runId, written);
    evidenceByRun.set(runId, evidence);
    for (const claimId of written) {
      const claim = byClaim.get(claimId);
      if (claim === undefined || claim.produced_by !== runId) valid = false;
    }
  }
  for (const claim of claims) {
    const id = stringId(claim);
    const runId = typeof claim.produced_by === 'string' ? claim.produced_by : undefined;
    if (id === undefined || runId === undefined || writtenByRun.get(runId)?.has(id) !== true) valid = false;
    if (isObject(claim.source) && claim.source.kind === 'tool_output') {
      const reference = claim.source.ref;
      const path = typeof reference === 'string' ? reference.split('#', 1)[0] : undefined;
      if (path === undefined || runId === undefined || evidenceByRun.get(runId)?.has(path) !== true) valid = false;
    }
  }
  if (valid) return null;

  const topology: string[] = [];
  if (forks.length > 0) {
    topology.push('forks: ' + forks.map(([target, ids]) => (
      target + ' superseded by ' + [...ids].sort().join(',')
    )).join(' | '));
  }
  if (cycles.length > 0) topology.push('cycle members: ' + cycles.join(','));
  const topologyContext = forks[0]?.[0] ?? cycles[0];
  if (topology.length > 0 && topologyContext !== undefined) {
    return { context: topologyContext, detail: topology.join('; ') };
  }

  const unknownSubject = claims.find((claim) => (
    typeof claim.subject !== 'string' || !byEntity.has(claim.subject)
  ));
  if (unknownSubject !== undefined) {
    return {
      context: stringId(unknownSubject) ?? 'graph/claims.json',
      detail: (stringId(unknownSubject) ?? 'null') + ' has unknown subject ' + jqText(unknownSubject.subject),
    };
  }
  const unknownRun = claims.find((claim) => (
    typeof claim.produced_by !== 'string' || !byRun.has(claim.produced_by)
  ));
  if (unknownRun !== undefined) {
    return {
      context: stringId(unknownRun) ?? 'graph/claims.json',
      detail: (stringId(unknownRun) ?? 'null') + ' has unknown run ' + jqText(unknownRun.produced_by),
    };
  }
  const unknownTarget = claims.find((claim) => hasOwn(claim, 'supersedes') && (
    typeof claim.supersedes !== 'string' || !byClaim.has(claim.supersedes)
  ));
  if (unknownTarget !== undefined) {
    return {
      context: stringId(unknownTarget) ?? 'graph/claims.json',
      detail: (stringId(unknownTarget) ?? 'null')
        + ' has unknown supersedes target ' + jqText(unknownTarget.supersedes),
    };
  }
  const ids = claims.map((claim) => stringId(claim) ?? 'null').join(',');
  return {
    context: stringId(claims[0] ?? {}) ?? 'graph/claims.json',
    detail: ids + ' has inconsistent cross-references, a supersession cycle, or provenance',
  };
}

function containsAll(oldValues: unknown, newValues: unknown): boolean {
  if (!Array.isArray(oldValues) || !Array.isArray(newValues)) return false;
  return oldValues.every((oldValue) => newValues.some((newValue) => isDeepStrictEqual(oldValue, newValue)));
}

function changedClaimIds(oldValue: unknown, currentValue: unknown): string[] {
  if (!Array.isArray(oldValue) || !Array.isArray(currentValue)) return ['unknown'];
  return asObjects(oldValue).filter((oldClaim) => !asObjects(currentValue).some((currentClaim) => (
    currentClaim.id === oldClaim.id && isDeepStrictEqual(currentClaim, oldClaim)
  ))).map((claim) => stringId(claim) ?? 'null');
}

function entityPreserved(oldEntity: Record<string, unknown>, current: readonly Record<string, unknown>[]): boolean {
  return current.some((entity) => entity.id === oldEntity.id
    && entity.type === oldEntity.type
    && entity.first_seen === oldEntity.first_seen
    && containsAll(oldEntity.aliases, entity.aliases)
    && containsAll(oldEntity.source_docs ?? [], entity.source_docs ?? []));
}

function changedEntityIds(oldValue: unknown, currentValue: unknown): string[] {
  if (!Array.isArray(oldValue) || !Array.isArray(currentValue)) return ['unknown'];
  const current = asObjects(currentValue);
  return asObjects(oldValue)
    .filter((oldEntity) => !entityPreserved(oldEntity, current))
    .map((entity) => stringId(entity) ?? 'null');
}

function openRunPreserved(oldRun: Record<string, unknown>, currentRun: Record<string, unknown>): boolean {
  return currentRun.started === oldRun.started
    && currentRun.tool === oldRun.tool
    && (!hasOwn(oldRun, 'task') || currentRun.task === oldRun.task)
    && containsAll(oldRun.evidence, currentRun.evidence)
    && containsAll(oldRun.claims_written, currentRun.claims_written);
}

function changedRunIds(oldValue: unknown, currentValue: unknown): string[] {
  if (!Array.isArray(oldValue) || !Array.isArray(currentValue)) return ['unknown'];
  const current = indexById(asObjects(currentValue));
  return asObjects(oldValue).filter((oldRun) => {
    const id = stringId(oldRun);
    const currentRun = id === undefined ? undefined : current.get(id);
    if (currentRun === undefined) return true;
    return hasOwn(oldRun, 'verdict')
      ? !isDeepStrictEqual(currentRun, oldRun)
      : !openRunPreserved(oldRun, currentRun);
  }).map((run) => stringId(run) ?? 'null');
}

function snapshotDiagnostic(issue: SnapshotIssue): string {
  return diagnostic(issue.code, issue.message, issue.context);
}

function parseDocuments(
  documents: GraphDocuments,
  diagnostics: string[],
): ParsedDocuments | null {
  const entities = parseDocument(documents.entities);
  const claims = parseDocument(documents.claims);
  const runs = parseDocument(documents.runs);
  if (entities.issue !== undefined) diagnostics.push(entities.issue);
  if (claims.issue !== undefined) diagnostics.push(claims.issue);
  if (runs.issue !== undefined) diagnostics.push(runs.issue);
  if (entities.issue !== undefined || claims.issue !== undefined || runs.issue !== undefined) return null;
  return { entities: entities.value, claims: claims.value, runs: runs.value };
}

export function validateSnapshot(snapshot: ValidationSnapshot): ValidationReport {
  const diagnostics: string[] = [];
  let stderr = '';
  const append = (line: string): void => {
    diagnostics.push(line);
    stderr += line + '\n';
  };

  for (const issue of snapshot.issues.filter((entry) => entry.phase === 'load')) append(snapshotDiagnostic(issue));

  const parseDiagnostics: string[] = [];
  const current = parseDocuments(snapshot.current, parseDiagnostics);
  for (const line of parseDiagnostics) append(line);
  if (current !== null) {
    if (validateEntityRecords(current.entities).length > 0) {
      append(schemaDiagnostic(
        'GK110',
        'graph/entities.json',
        current.entities,
        'entity schema or ID uniqueness violation',
        'correct the named records and keep IDs unique',
      ));
    }
    if (validateClaimRecords(current.claims).length > 0) {
      append(schemaDiagnostic(
        'GK120',
        'graph/claims.json',
        current.claims,
        'claim schema or ID uniqueness violation',
        'correct the named records and source shape',
      ));
    }
    if (validateRunRecords(current.runs).length > 0) {
      append(schemaDiagnostic(
        'GK130',
        'graph/runs.json',
        current.runs,
        'run schema, lifecycle, or ID uniqueness violation',
        'correct the named records and lifecycle fields',
      ));
    }

    const relation = findRelationProblem(current);
    if (relation !== null) {
      append(diagnostic(
        'GK140',
        relation.detail + '; fix: repair references, provenance, and use one acyclic supersession successor',
        relation.context,
      ));
    }

    if (snapshot.head !== null) {
      const headDiagnostics: string[] = [];
      const head = parseDocuments(snapshot.head, headDiagnostics);
      if (head === null) {
        append('GK150 committed graph JSON cannot be parsed');
      } else {
        const claims = changedClaimIds(head.claims, current.claims);
        if (claims.length > 0) append(diagnostic(
          'GK151',
          'committed claim changed or was removed; fix: restore it and append a superseding claim',
          claims.join(','),
        ));
        const entities = changedEntityIds(head.entities, current.entities);
        if (entities.length > 0) append(diagnostic(
          'GK152',
          'entity identity changed or an accumulated value was removed; fix: restore identity and only add aliases or source_docs',
          entities.join(','),
        ));
        const runs = changedRunIds(head.runs, current.runs);
        if (runs.length > 0) append(diagnostic(
          'GK153',
          'invalid open-run transition or closed-run mutation; fix: restore the run or close an open run exactly once',
          runs.join(','),
        ));
      }

      stderr += snapshot.evidenceStderr;
      for (const issue of snapshot.issues.filter((entry) => entry.phase === 'evidence')) {
        append(snapshotDiagnostic(issue));
      }
      const evidence = snapshot.evidenceChanges[0];
      if (evidence !== undefined) append(diagnostic(
        'GK154',
        'committed evidence changed, was deleted, or was renamed; fix: restore it and add a new evidence file',
        evidence.paths.join('\t'),
      ));
    }
  }

  if (diagnostics.length > 0) {
    stderr += 'GraphKeeper: ' + diagnostics.length + ' violation(s)\n';
    return { exitCode: 1, stdout: '', stderr, diagnostics };
  }
  return {
    exitCode: 0,
    stdout: 'GraphKeeper: validation passed\n',
    stderr,
    diagnostics,
  };
}
