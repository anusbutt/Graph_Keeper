const CLAIM_ID = /^claim_[0-9a-f]{8}$/;
const RUN_ID = /^run_[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9][a-z0-9_-]*$/;
const SLUG = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const UTC_TIMESTAMP = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/;
const EVIDENCE_REF = /^evidence\/[^\s#]+#L[0-9]+-L[0-9]+$/;
const EVIDENCE_PATH = /^evidence\/[^\s#]+$/;

export interface ToolOutputSource {
  readonly kind: 'tool_output';
  readonly command: string;
  readonly exit_code: number;
  readonly ref: string;
  readonly captured: string;
}

export interface InferenceSource {
  readonly kind: 'inference';
  readonly basis?: string;
}

export type ClaimSource = ToolOutputSource | InferenceSource;

export interface Claim {
  readonly id: string;
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidence?: number;
  readonly source: ClaimSource;
  readonly produced_by: string;
  readonly supersedes?: string;
  readonly created: string;
}

export interface Entity {
  readonly id: string;
  readonly type: string;
  readonly aliases: readonly string[];
  readonly source_docs?: readonly string[];
  readonly first_seen: string;
}

export type RunVerdict = 'passed' | 'failed' | 'inconclusive' | 'aborted';

export interface Run {
  readonly id: string;
  readonly started: string;
  readonly tool: string;
  readonly task?: string;
  readonly evidence: readonly string[];
  readonly claims_written: readonly string[];
  readonly ended?: string;
  readonly verdict?: RunVerdict;
}

export class RecordValidationError extends Error {
  readonly recordType: string;
  readonly index?: number;

  constructor(recordType: string, message: string, index?: number) {
    super(index === undefined ? recordType + ': ' + message : recordType + '[' + index + ']: ' + message);
    this.name = 'RecordValidationError';
    this.recordType = recordType;
    if (index !== undefined) this.index = index;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function assertExactKeys(
  record: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  label: string,
): void {
  for (const key of required) {
    if (!hasOwn(record, key)) throw new Error(label + ' is missing required field ' + key);
  }
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(record).find((key) => !allowed.has(key));
  if (unknown !== undefined) throw new Error(label + ' has unknown field ' + unknown);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !UTC_TIMESTAMP.test(value)) return false;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return false;
  return new Date(milliseconds).toISOString().replace('.000Z', 'Z') === value;
}

function hasSafeSegments(path: string): boolean {
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function isEvidenceReference(value: unknown): value is string {
  return typeof value === 'string' && EVIDENCE_REF.test(value) && hasSafeSegments(value.split('#', 1)[0] ?? '');
}

function isEvidencePath(value: unknown): value is string {
  return typeof value === 'string' && EVIDENCE_PATH.test(value) && hasSafeSegments(value);
}

function isUniqueStringArray(value: unknown, item?: (value: string) => boolean): value is string[] {
  return Array.isArray(value)
    && value.every((entry) => isNonEmptyString(entry) && (item === undefined || item(entry)))
    && new Set(value).size === value.length;
}

function validateSource(value: unknown): void {
  if (!isObject(value)) throw new Error('source must be an object');
  if (value.kind === 'tool_output') {
    assertExactKeys(value, ['kind', 'command', 'exit_code', 'ref', 'captured'], [], 'tool_output source');
    if (!isNonEmptyString(value.command)) throw new Error('tool_output command must be non-empty');
    if (!Number.isInteger(value.exit_code) || (value.exit_code as number) < 0 || (value.exit_code as number) > 255) {
      throw new Error('tool_output exit_code must be an integer from 0 through 255');
    }
    if (!isEvidenceReference(value.ref)) throw new Error('tool_output ref must be a canonical evidence reference');
    if (!isUtcTimestamp(value.captured)) throw new Error('tool_output captured must be an ISO 8601 UTC timestamp');
    return;
  }
  if (value.kind === 'inference') {
    assertExactKeys(value, ['kind'], ['basis'], 'inference source');
    if (hasOwn(value, 'basis') && !isNonEmptyString(value.basis)) throw new Error('inference basis must be non-empty');
    return;
  }
  throw new Error('source kind must be tool_output or inference');
}

function validateClaim(value: unknown): void {
  if (!isObject(value)) throw new Error('claim must be an object');
  assertExactKeys(
    value,
    ['id', 'subject', 'predicate', 'object', 'source', 'produced_by', 'created'],
    ['confidence', 'supersedes'],
    'claim',
  );
  if (typeof value.id !== 'string' || !CLAIM_ID.test(value.id)) throw new Error('invalid claim ID');
  if (!isNonEmptyString(value.subject)) throw new Error('claim subject must be non-empty');
  if (typeof value.predicate !== 'string' || !SLUG.test(value.predicate)) throw new Error('claim predicate must be snake_case');
  if (!isNonEmptyString(value.object)) throw new Error('claim object must be non-empty');
  validateSource(value.source);
  if (typeof value.produced_by !== 'string' || !RUN_ID.test(value.produced_by)) throw new Error('invalid producing run ID');
  if (!isUtcTimestamp(value.created)) throw new Error('claim created must be an ISO 8601 UTC timestamp');
  if (hasOwn(value, 'confidence') && (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1)) {
    throw new Error('claim confidence must be from 0 through 1');
  }
  if (hasOwn(value, 'supersedes') && (typeof value.supersedes !== 'string' || !CLAIM_ID.test(value.supersedes))) {
    throw new Error('invalid superseded claim ID');
  }
}

function validateEntity(value: unknown): void {
  if (!isObject(value)) throw new Error('entity must be an object');
  assertExactKeys(value, ['id', 'type', 'aliases', 'first_seen'], ['source_docs'], 'entity');
  if (typeof value.id !== 'string' || !SLUG.test(value.id)) throw new Error('invalid entity ID');
  if (typeof value.type !== 'string' || !SLUG.test(value.type)) throw new Error('invalid entity type');
  if (!isUniqueStringArray(value.aliases)) throw new Error('entity aliases must be unique non-empty strings');
  if (hasOwn(value, 'source_docs') && !isUniqueStringArray(value.source_docs, isEvidenceReference)) {
    throw new Error('entity source_docs must be unique evidence references');
  }
  if (!isUtcTimestamp(value.first_seen)) throw new Error('entity first_seen must be an ISO 8601 UTC timestamp');
}

function validateRun(value: unknown): void {
  if (!isObject(value)) throw new Error('run must be an object');
  assertExactKeys(value, ['id', 'started', 'tool', 'evidence', 'claims_written'], ['task', 'ended', 'verdict'], 'run');
  if (typeof value.id !== 'string' || !RUN_ID.test(value.id)) throw new Error('invalid run ID');
  if (!isUtcTimestamp(value.started)) throw new Error('run started must be an ISO 8601 UTC timestamp');
  if (!isNonEmptyString(value.tool)) throw new Error('run tool must be non-empty');
  if (hasOwn(value, 'task') && !isNonEmptyString(value.task)) throw new Error('run task must be non-empty');
  if (!isUniqueStringArray(value.evidence, isEvidencePath)) throw new Error('run evidence must contain unique evidence paths');
  if (!isUniqueStringArray(value.claims_written, (id) => CLAIM_ID.test(id))) {
    throw new Error('run claims_written must contain unique claim IDs');
  }
  const hasEnded = hasOwn(value, 'ended');
  const hasVerdict = hasOwn(value, 'verdict');
  if (hasEnded !== hasVerdict) throw new Error('run ended and verdict must appear together');
  if (hasEnded) {
    if (!isUtcTimestamp(value.ended)) throw new Error('run ended must be an ISO 8601 UTC timestamp');
    if (Date.parse(value.ended) < Date.parse(value.started as string)) throw new Error('run ended cannot precede started');
    if (!['passed', 'failed', 'inconclusive', 'aborted'].includes(value.verdict as string)) throw new Error('invalid run verdict');
  }
}

function parseArray<T>(value: unknown, recordType: string, validate: (entry: unknown) => void): T[] {
  if (!Array.isArray(value)) throw new RecordValidationError(recordType, 'expected a top-level array');
  const ids = new Set<string>();
  value.forEach((entry, index) => {
    try {
      validate(entry);
      const id = (entry as Record<string, unknown>).id as string;
      if (ids.has(id)) throw new Error('duplicate ID ' + id);
      ids.add(id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new RecordValidationError(recordType, message, index);
    }
  });
  return value as T[];
}

export function parseClaims(value: unknown): Claim[] {
  return parseArray<Claim>(value, 'claims', validateClaim);
}

export function parseEntities(value: unknown): Entity[] {
  return parseArray<Entity>(value, 'entities', validateEntity);
}

export function parseRuns(value: unknown): Run[] {
  return parseArray<Run>(value, 'runs', validateRun);
}
