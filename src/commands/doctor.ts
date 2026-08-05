import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { check, type CheckRunner } from './check.js';
import { createEvidenceInspector, type EvidenceInspection, type EvidenceIssueKind } from '../lib/evidence.js';
import { EXIT_CODES, GraphKeeperError, type ExitCode } from '../lib/errors.js';
import { findGitRoot } from '../lib/git.js';
import { findDuplicateJsonKeys } from '../lib/json-duplicates.js';
import { parseClaims, parseEntities, parseRuns, type Claim, type Entity, type Run } from '../lib/records.js';
import { runProcess } from '../lib/process.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export type DoctorSeverity = 'error' | 'warning';

export interface DoctorFinding {
  readonly severity: DoctorSeverity;
  readonly code: string;
  readonly context: string;
  readonly message: string;
}

export interface EvidenceOwner {
  readonly ownerKind: 'claim' | 'entity';
  readonly ownerId: string;
  readonly reference: string;
}

export interface DoctorOptions {
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly runner?: CheckRunner;
}

export interface DoctorReport {
  readonly exitCode: ExitCode;
  readonly stdout: string;
  readonly stderr: string;
  readonly findings: readonly DoctorFinding[];
}

function finding(severity: DoctorSeverity, code: string, context: string, message: string): DoctorFinding {
  return { severity, code, context, message };
}

export function inspectGraphReferences(
  entities: readonly Entity[],
  claims: readonly Claim[],
  runs: readonly Run[],
): DoctorFinding[] {
  const findings: DoctorFinding[] = [];
  const entityIds = new Set(entities.map((entity) => entity.id));
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  const runById = new Map(runs.map((run) => [run.id, run]));

  for (const claim of claims) {
    if (!entityIds.has(claim.subject)) {
      findings.push(finding('error', 'GK320', claim.id, 'subject does not resolve: ' + claim.subject));
    }
    if (!runById.has(claim.produced_by)) {
      findings.push(finding('error', 'GK321', claim.id, 'producing run does not resolve: ' + claim.produced_by));
    }
    if (claim.supersedes !== undefined && !claimById.has(claim.supersedes)) {
      findings.push(finding('error', 'GK322', claim.id, 'supersedes target does not resolve: ' + claim.supersedes));
    }
  }

  for (const run of runs) {
    for (const claimId of run.claims_written) {
      const claim = claimById.get(claimId);
      if (claim === undefined) {
        findings.push(finding('error', 'GK323', run.id, 'claims_written target does not resolve: ' + claimId));
      } else if (claim.produced_by !== run.id) {
        findings.push(finding('error', 'GK324', run.id, 'claim ' + claimId + ' names producer ' + claim.produced_by));
      }
    }
  }

  for (const claim of claims) {
    const producer = runById.get(claim.produced_by);
    if (producer !== undefined && !producer.claims_written.includes(claim.id)) {
      findings.push(finding('error', 'GK325', claim.id, 'producing run does not list this claim'));
    }
  }

  const usedEntities = new Set(claims.map((claim) => claim.subject));
  for (const entity of entities) {
    if (!usedEntities.has(entity.id)) {
      findings.push(finding('warning', 'GK390', entity.id, 'entity is not referenced by any claim'));
    }
  }
  return findings;
}

export function collectEvidenceReferences(
  entities: readonly Entity[],
  claims: readonly Claim[],
): EvidenceOwner[] {
  const references: EvidenceOwner[] = [];
  for (const entity of entities) {
    for (const reference of entity.source_docs ?? []) {
      references.push({ ownerKind: 'entity', ownerId: entity.id, reference });
    }
  }
  for (const claim of claims) {
    if (claim.source.kind === 'tool_output') {
      references.push({ ownerKind: 'claim', ownerId: claim.id, reference: claim.source.ref });
    }
  }
  return references;
}

const evidenceCodes: Record<EvidenceIssueKind, string> = {
  shape: 'GK310',
  unsafe: 'GK310',
  outside: 'GK310',
  missing: 'GK311',
  unreadable: 'GK312',
  non_text: 'GK313',
  range_start: 'GK314',
  range_order: 'GK315',
  out_of_bounds: 'GK316',
};

export function evidenceFindings(owner: EvidenceOwner, inspection: EvidenceInspection): DoctorFinding[] {
  const context = owner.ownerKind + ':' + owner.ownerId + ' ' + owner.reference;
  return inspection.issues.map((issue) => finding('error', evidenceCodes[issue.kind], context, issue.message));
}

function parseValidatorFindings(stderr: string): DoctorFinding[] {
  const findings: DoctorFinding[] = [];
  for (const line of stderr.replace(/\r\n/g, '\n').split('\n')) {
    const match = /^(GK[0-9]{3})(?: \[([^\]]+)\])? (.+)$/.exec(line);
    if (match !== null && match[1] !== undefined && match[3] !== undefined) {
      findings.push(finding('error', match[1], match[2] ?? 'validator', match[3]));
    }
  }
  return findings;
}

function formatReport(findings: readonly DoctorFinding[]): { stdout: string; stderr: string } {
  const errors = findings.filter((item) => item.severity === 'error');
  const warnings = findings.filter((item) => item.severity === 'warning');
  const stdout = [
    'GraphKeeper doctor',
    'Warnings (' + warnings.length + '):',
    ...warnings.map((item) => '- ' + item.code + ' [' + item.context + '] ' + item.message),
    'Summary: ' + errors.length + ' error(s), ' + warnings.length + ' warning(s)',
    errors.length === 0 ? 'GraphKeeper: doctor healthy' : 'GraphKeeper: doctor found integrity errors',
  ].join('\n') + '\n';
  const stderr = errors.length === 0 ? '' : [
    'Errors (' + errors.length + '):',
    ...errors.map((item) => '- ' + item.code + ' [' + item.context + '] ' + item.message),
  ].join('\n') + '\n';
  return { stdout, stderr };
}

function terminalReport(exitCode: ExitCode, stdout: string, stderr: string): DoctorReport {
  return { exitCode, stdout, stderr, findings: [] };
}

export async function doctor(options: DoctorOptions): Promise<DoctorReport> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runner = options.runner ?? runProcess;
  const validation = await check({ cwd: options.cwd, timeoutMs, runner });
  if (validation.exitCode >= EXIT_CODES.usage) {
    return terminalReport(validation.exitCode, validation.stdout, validation.stderr);
  }

  let repositoryRoot: string;
  try {
    repositoryRoot = await findGitRoot(options.cwd);
  } catch (error: unknown) {
    if (error instanceof GraphKeeperError) return terminalReport(error.exitCode, '', error.message + '\n');
    throw error;
  }

  const findings = validation.exitCode === EXIT_CODES.validation
    ? parseValidatorFindings(validation.stderr)
    : [];
  const names = ['entities', 'claims', 'runs'] as const;
  const raw = new Map<(typeof names)[number], string>();
  for (const name of names) {
    const relativePath = 'graph/' + name + '.json';
    try {
      const text = await readFile(join(repositoryRoot, relativePath), 'utf8');
      raw.set(name, text);
      try {
        for (const duplicate of findDuplicateJsonKeys(text)) {
          findings.push(finding(
            'error',
            'GK301',
            relativePath + ':' + duplicate.path,
            'duplicate JSON key ' + JSON.stringify(duplicate.key),
          ));
        }
      } catch {
        // Canonical validation already reports malformed JSON; deeper parsing is unsafe.
      }
    } catch (error: unknown) {
      if (validation.exitCode === EXIT_CODES.success) {
        findings.push(finding('error', 'GK300', relativePath, error instanceof Error ? error.message : String(error)));
      }
    }
  }

  let entities: Entity[] | undefined;
  let claims: Claim[] | undefined;
  let runs: Run[] | undefined;
  try {
    const entitiesRaw = raw.get('entities');
    const claimsRaw = raw.get('claims');
    const runsRaw = raw.get('runs');
    if (entitiesRaw !== undefined && claimsRaw !== undefined && runsRaw !== undefined) {
      entities = parseEntities(JSON.parse(entitiesRaw) as unknown);
      claims = parseClaims(JSON.parse(claimsRaw) as unknown);
      runs = parseRuns(JSON.parse(runsRaw) as unknown);
      raw.clear();
    }
  } catch {
    // Canonical validation owns schema diagnostics; continue with raw duplicate findings.
  }

  if (entities !== undefined && claims !== undefined && runs !== undefined) {
    findings.push(...inspectGraphReferences(entities, claims, runs));
    const inspector = createEvidenceInspector(repositoryRoot);
    const owners = collectEvidenceReferences(entities, claims);
    const batchSize = 256;
    for (let offset = 0; offset < owners.length; offset += batchSize) {
      const batch = owners.slice(offset, offset + batchSize);
      const inspected = await Promise.all(batch.map(async (owner) => ({
        owner,
        inspection: await inspector.inspect(owner.reference),
      })));
      for (const item of inspected) findings.push(...evidenceFindings(item.owner, item.inspection));
    }
  }

  const formatted = formatReport(findings);
  return {
    exitCode: findings.some((item) => item.severity === 'error')
      ? EXIT_CODES.validation
      : EXIT_CODES.success,
    ...formatted,
    findings,
  };
}
