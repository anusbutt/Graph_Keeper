import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { check, type CheckRunner } from './check.js';
import { EXIT_CODES, GraphKeeperError, diagnostic, type ExitCode } from '../lib/errors.js';
import { findGitRoot } from '../lib/git.js';
import { parseClaims, parseEntities, type Claim, type Entity } from '../lib/records.js';
import { runProcess } from '../lib/process.js';

const DEFAULT_TIMEOUT_MS = 15_000;
export interface ResolvedEntity {
  readonly kind: 'resolved';
  readonly subject: string;
  readonly entity: Entity;
  readonly matchedBy: 'id' | 'alias';
}

export interface AmbiguousEntity {
  readonly kind: 'ambiguous';
  readonly subject: string;
  readonly candidateIds: readonly string[];
}

export interface EntityNotFound {
  readonly kind: 'not_found';
  readonly subject: string;
}

export type EntityResolution = ResolvedEntity | AmbiguousEntity | EntityNotFound;

export interface QueryOptions {
  readonly cwd: string;
  readonly subject: string;
  readonly timeoutMs?: number;
  readonly runner?: CheckRunner;
}

export interface QueryReport {
  readonly exitCode: ExitCode;
  readonly stdout: string;
  readonly stderr: string;
}

function appendLine(output: string, message: string): string {
  if (output.length === 0) return message + '\n';
  return output.endsWith('\n') ? output + message + '\n' : output + '\n' + message + '\n';
}

function failure(exitCode: ExitCode, code: string, message: string, context?: string, existing = ''): QueryReport {
  return {
    exitCode,
    stdout: '',
    stderr: appendLine(existing, diagnostic(code, message, context)),
  };
}

export function resolveEntity(entities: readonly Entity[], subject: string): EntityResolution {
  const canonical = entities.find((entity) => entity.id === subject);
  if (canonical !== undefined) {
    return { kind: 'resolved', subject, entity: canonical, matchedBy: 'id' };
  }

  const aliases = entities
    .filter((entity) => entity.aliases.includes(subject))
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  if (aliases.length === 0) return { kind: 'not_found', subject };
  if (aliases.length > 1) {
    return {
      kind: 'ambiguous',
      subject,
      candidateIds: aliases.map((entity) => entity.id),
    };
  }
  return { kind: 'resolved', subject, entity: aliases[0] as Entity, matchedBy: 'alias' };
}

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function selectActiveClaims(claims: readonly Claim[], subject: string): Claim[] {
  const superseded = new Set(
    claims.flatMap((claim) => claim.supersedes === undefined ? [] : [claim.supersedes]),
  );
  return claims
    .filter((claim) => claim.subject === subject && !superseded.has(claim.id))
    .sort((left, right) => compareOrdinal(left.created, right.created) || compareOrdinal(left.id, right.id));
}

function quoted(value: string): string {
  return JSON.stringify(value);
}

export function formatQueryOutput(resolution: ResolvedEntity, claims: readonly Claim[]): string {
  const lines = [
    'Entity: ' + resolution.entity.id,
    resolution.matchedBy === 'id'
      ? 'Matched by: canonical ID'
      : 'Matched by alias: ' + quoted(resolution.subject),
    'Active claims: ' + claims.length,
  ];

  if (claims.length === 0) {
    lines.push('No active claims.');
    return lines.join('\n') + '\n';
  }

  for (const claim of claims) {
    lines.push(
      '',
      'Claim: ' + claim.id,
      '  Predicate: ' + claim.predicate,
      '  Object: ' + quoted(claim.object),
      '  Source: ' + claim.source.kind,
    );
    if (claim.source.kind === 'tool_output') {
      lines.push(
        '  Command: ' + quoted(claim.source.command),
        '  Exit code: ' + claim.source.exit_code,
        '  Evidence: ' + claim.source.ref,
        '  Captured: ' + claim.source.captured,
      );
    } else if (claim.source.basis !== undefined) {
      lines.push('  Basis: ' + quoted(claim.source.basis));
    }
    lines.push(
      '  Producer: ' + claim.produced_by,
      '  Created: ' + claim.created,
    );
  }
  return lines.join('\n') + '\n';
}

export async function query(options: QueryOptions): Promise<QueryReport> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runner = options.runner ?? runProcess;
  const validation = await check({ cwd: options.cwd, timeoutMs, runner });
  if (validation.exitCode !== EXIT_CODES.success) return validation;

  let repositoryRoot: string;
  try {
    repositoryRoot = await findGitRoot(options.cwd);
  } catch (error: unknown) {
    if (error instanceof GraphKeeperError) {
      return failure(error.exitCode, error.code, error.message, error.context);
    }
    throw error;
  }

  let entities: Entity[];
  try {
    const raw = await readFile(join(repositoryRoot, 'graph', 'entities.json'), 'utf8');
    entities = parseEntities(JSON.parse(raw) as unknown);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return failure(
      EXIT_CODES.operational,
      'GK004',
      'graph changed or became unreadable after validation: ' + message,
      'graph/entities.json',
    );
  }

  const resolution = resolveEntity(entities, options.subject);
  if (resolution.kind === 'not_found') {
    return failure(EXIT_CODES.validation, 'GK202', 'no entity found for exact ID or alias', options.subject);
  }
  if (resolution.kind === 'ambiguous') {
    return failure(
      EXIT_CODES.validation,
      'GK201',
      'ambiguous alias; candidates: ' + resolution.candidateIds.join(', '),
      options.subject,
    );
  }

  let claims: Claim[];
  try {
    const raw = await readFile(join(repositoryRoot, 'graph', 'claims.json'), 'utf8');
    claims = parseClaims(JSON.parse(raw) as unknown);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return failure(
      EXIT_CODES.operational,
      'GK004',
      'graph changed or became unreadable after validation: ' + message,
      'graph/claims.json',
    );
  }

  return {
    exitCode: EXIT_CODES.success,
    stdout: formatQueryOutput(resolution, selectActiveClaims(claims, resolution.entity.id)),
    stderr: '',
  };
}
