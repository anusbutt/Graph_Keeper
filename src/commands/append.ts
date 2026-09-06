import { randomBytes } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { EXIT_CODES, GraphKeeperError, diagnostic, type ExitCode } from '../lib/errors.js';
import { findGitRoot } from '../lib/git.js';
import type {
  CommandHelpOption,
  CommandHelpTopic,
} from '../lib/command-help.js';
import {
  acquireLock,
  LockTimeoutError,
  mutateJsonArrayFile,
  OptimisticWriteError,
  writeJsonArrayUnderLock,
} from '../lib/optimistic-write.js';
import { resolveContainedPath } from '../lib/paths.js';
import {
  parseClaims,
  parseEntities,
  parseRuns,
  type Claim,
  type ClaimSource,
  type Run,
  type RunVerdict,
} from '../lib/records.js';

export interface AppendOptions {
  readonly kind: 'claim' | 'run';
  readonly claim?: ClaimArgs;
  readonly run?: RunArgs;
}

export interface AppendReport {
  readonly exitCode: ExitCode;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ClaimArgs {
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidence?: number;
  readonly kind: 'tool_output' | 'inference';
  readonly command?: string;
  readonly exit_code?: number;
  readonly ref?: string;
  readonly captured?: string;
  readonly basis?: string;
  readonly produced_by: string;
  readonly created?: string;
  readonly id?: string;
  readonly supersedes?: string;
}

export interface RunArgs {
  readonly id?: string;
  readonly started: string;
  readonly tool: string;
  readonly task?: string;
  readonly evidence?: readonly string[];
  readonly claims_written?: readonly string[];
  readonly ended?: string;
  readonly verdict?: RunVerdict;
}

export type ParsedAppend =
  | { readonly kind: 'claim' | 'run'; readonly ok: true; readonly options: AppendOptions }
  | { readonly ok: false; readonly usageError: string };

function failureResult(error: GraphKeeperError): AppendReport {
  return {
    exitCode: error.exitCode,
    stdout: '',
    stderr: diagnostic(error.code, error.message, error.context) + '\n',
  };
}

export function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function generateClaimId(): string {
  return 'claim_' + randomBytes(4).toString('hex');
}

export function generateRunId(started: string): string {
  const date = started.slice(0, 10);
  return 'run_' + date + '-' + randomBytes(2).toString('hex');
}

function claimSourceFromArgs(args: ClaimArgs): ClaimSource {
  if (args.kind === 'inference') {
    if (args.basis === undefined || args.basis.length === 0) {
      throw new GraphKeeperError('GK401', 'validation', 'inference source requires a basis');
    }
    return { kind: 'inference', basis: args.basis };
  }
  if (
    args.command === undefined
    || args.ref === undefined
    || args.captured === undefined
    || args.exit_code === undefined
  ) {
    throw new GraphKeeperError(
      'GK401',
      'validation',
      'tool_output source requires command, ref, captured, and exit_code',
    );
  }
  return {
    kind: 'tool_output',
    command: args.command,
    exit_code: args.exit_code,
    ref: args.ref,
    captured: args.captured,
  };
}

export function buildClaim(args: ClaimArgs): Claim {
  const claim: Claim = {
    id: args.id ?? generateClaimId(),
    subject: args.subject,
    predicate: args.predicate,
    object: args.object,
    source: claimSourceFromArgs(args),
    produced_by: args.produced_by,
    created: args.created ?? nowUtc(),
  };
  if (args.confidence !== undefined) {
    (claim as { confidence?: number }).confidence = args.confidence;
  }
  if (args.supersedes !== undefined) {
    (claim as { supersedes?: string }).supersedes = args.supersedes;
  }
  return claim;
}

export function buildRun(args: RunArgs): Run {
  const run: Run = {
    id: args.id ?? generateRunId(args.started),
    started: args.started,
    tool: args.tool,
    evidence: args.evidence ?? [],
    claims_written: args.claims_written ?? [],
  };
  if (args.task !== undefined) (run as { task?: string }).task = args.task;
  if (args.ended !== undefined && args.verdict !== undefined) {
    (run as { ended?: string }).ended = args.ended;
    (run as { verdict?: RunVerdict }).verdict = args.verdict;
  }
  return run;
}

async function readJson<T = unknown>(root: string, relativePath: string): Promise<T> {
  return JSON.parse(await readFile(join(root, relativePath), 'utf8')) as T;
}

async function appendClaimRecord(root: string, claim: Claim): Promise<void> {
  const claimsTarget = resolveContainedPath(root, 'graph/claims.json');
  const runsTarget = resolveContainedPath(root, 'graph/runs.json');
  await mkdir(dirname(claimsTarget), { recursive: true, mode: 0o755 });

  // Acquire both locks up front, claims.json before runs.json (consistent order
  // to avoid deadlock). The run's open-state validation AND both writes happen
  // inside this single held-lock critical section, so a concurrent writer that
  // closes or mutates the run cannot interleave between the claim write and the
  // run-link write. This makes it impossible to commit a claim whose run link
  // later fails or was concurrently invalidated.
  const releaseClaims = await acquireLock(claimsTarget);
  const releaseRuns = await acquireLock(runsTarget);
  try {
    const entities = parseEntities(await readJson<unknown>(root, 'graph/entities.json'));
    if (!entities.some((e) => e.id === claim.subject)) {
      throw new GraphKeeperError(
        'GK401',
        'validation',
        'claim subject does not resolve to a known entity: ' + claim.subject,
        claim.subject,
      );
    }

    const currentClaims = parseClaims(JSON.parse(await readFile(claimsTarget, 'utf8')) as unknown);
    if (currentClaims.some((c) => c.id === claim.id)) {
      throw new GraphKeeperError('GK401', 'validation', 'claim ID already exists: ' + claim.id, claim.id);
    }

    // Authoritative run state, read while holding the runs lock.
    const runs = parseRuns(JSON.parse(await readFile(runsTarget, 'utf8')) as unknown);
    const producingRun = runs.find((r) => r.id === claim.produced_by);
    if (producingRun === undefined) {
      throw new GraphKeeperError(
        'GK401',
        'validation',
        'claim producing run does not exist: ' + claim.produced_by,
        claim.produced_by,
      );
    }
    if (producingRun.verdict !== undefined) {
      throw new GraphKeeperError(
        'GK401',
        'validation',
        'cannot append a claim to a closed run: ' + claim.produced_by,
        claim.produced_by,
      );
    }

    parseClaims([claim, ...currentClaims]);

    await writeJsonArrayUnderLock(claimsTarget, (records) => {
      records.push(claim);
    });
    await writeJsonArrayUnderLock(runsTarget, (records) => {
      const index = records.findIndex((record) => (record as { id?: string }).id === claim.produced_by);
      if (index === -1) return;
      const target = records[index] as { claims_written?: string[]; evidence?: string[] };
      if (target.claims_written === undefined) target.claims_written = [];
      if (!target.claims_written.includes(claim.id)) target.claims_written.push(claim.id);
      if (claim.source.kind === 'tool_output') {
        const evidencePath = claim.source.ref.split('#')[0] ?? '';
        if (target.evidence === undefined) target.evidence = [];
        if (evidencePath.length > 0 && !target.evidence.includes(evidencePath)) {
          target.evidence.push(evidencePath);
        }
      }
    });
  } finally {
    await releaseRuns();
    await releaseClaims();
  }
}

async function appendRunRecord(root: string, run: Run): Promise<void> {
  const currentRuns = parseRuns(await readJson<unknown>(root, 'graph/runs.json'));
  if (currentRuns.some((r) => r.id === run.id)) {
    throw new GraphKeeperError('GK401', 'validation', 'run already exists: ' + run.id, run.id);
  }
  parseRuns([run, ...currentRuns]);
  await mutateJsonArrayFile(root, 'graph/runs.json', (records) => {
    records.push(run);
  });
}

export async function runAppend(options: AppendOptions, cwd: string = process.cwd()): Promise<AppendReport> {
  let repositoryRoot: string;
  try {
    repositoryRoot = await findGitRoot(cwd);
  } catch (error: unknown) {
    if (error instanceof GraphKeeperError) return failureResult(error);
    throw error;
  }

  try {
    if (options.kind === 'claim') {
      if (options.claim === undefined) throw new GraphKeeperError('GK401', 'validation', 'missing claim arguments');
      const claim = buildClaim(options.claim);
      await appendClaimRecord(repositoryRoot, claim);
      return { exitCode: EXIT_CODES.success, stdout: 'Appended claim ' + claim.id + '\n', stderr: '' };
    }
    if (options.run === undefined) throw new GraphKeeperError('GK401', 'validation', 'missing run arguments');
    const run = buildRun(options.run);
    await appendRunRecord(repositoryRoot, run);
    return { exitCode: EXIT_CODES.success, stdout: 'Appended run ' + run.id + '\n', stderr: '' };
  } catch (error: unknown) {
    if (error instanceof GraphKeeperError) return failureResult(error);
    if (error instanceof OptimisticWriteError) {
      return { exitCode: EXIT_CODES.operational, stdout: '', stderr: diagnostic('GK400', error.message) + '\n' };
    }
    if (error instanceof LockTimeoutError) {
      return { exitCode: EXIT_CODES.operational, stdout: '', stderr: diagnostic('GK400', error.message) + '\n' };
    }
    throw error;
  }
}

type ClaimOptionGroup =
  | 'common'
  | 'source'
  | 'tool-output'
  | 'inference'
  | 'optional';

export interface ClaimOptionDefinition extends CommandHelpOption {
  readonly group: ClaimOptionGroup;
}

export const CLAIM_OPTION_DEFINITIONS: readonly ClaimOptionDefinition[] = [
  {
    name: 'subject',
    value: 'entity-id',
    group: 'common',
    description: 'Existing canonical entity ID.',
  },
  {
    name: 'predicate',
    value: 'value',
    group: 'common',
    description: 'One flat relationship or property name.',
  },
  {
    name: 'object',
    value: 'value',
    group: 'common',
    description: 'The claimed value.',
  },
  {
    name: 'produced-by',
    value: 'run-id',
    group: 'common',
    description: 'Existing open run that produced the claim.',
  },
  {
    name: 'kind',
    value: 'tool_output|inference',
    group: 'source',
    description: 'Source kind; tool_output is the default.',
  },
  {
    name: 'command',
    value: 'text',
    group: 'tool-output',
    description: 'Command recorded as inert data.',
  },
  {
    name: 'exit-code',
    value: 'integer',
    group: 'tool-output',
    description: 'Captured command exit code.',
  },
  {
    name: 'ref',
    value: 'reference',
    group: 'tool-output',
    description: 'Inclusive evidence/<path>#L<start>-L<end> reference.',
  },
  {
    name: 'captured',
    value: 'timestamp',
    group: 'tool-output',
    description: 'Whole-second UTC evidence capture time.',
  },
  {
    name: 'basis',
    value: 'text',
    group: 'inference',
    description: 'Non-empty reasoning basis; not external proof.',
  },
  {
    name: 'confidence',
    value: 'number',
    group: 'optional',
    description: 'Schema-valid confidence; inference cannot use 1.',
  },
  {
    name: 'id',
    value: 'claim-id',
    group: 'optional',
    description: 'Unique claim ID; generated when omitted.',
  },
  {
    name: 'created',
    value: 'timestamp',
    group: 'optional',
    description: 'Whole-second UTC time; current UTC when omitted.',
  },
  {
    name: 'supersedes',
    value: 'claim-id',
    group: 'optional',
    description: 'Existing active claim corrected by this claim.',
  },
];

const CLAIM_FLAGS = new Set(CLAIM_OPTION_DEFINITIONS.map((option) => option.name));
const RUN_FLAGS = new Set<string>([
  'id', 'started', 'tool', 'task', 'evidence', 'claims-written', 'ended', 'verdict',
]);

function helpOptions(group: ClaimOptionGroup): readonly CommandHelpOption[] {
  return CLAIM_OPTION_DEFINITIONS.filter((option) => option.group === group);
}

export const APPEND_HELP_TOPIC: CommandHelpTopic = {
  path: ['append'],
  summary: 'Create a run or append one grounded claim through a safe writer.',
  usage: [
    'graphkeeper append claim [options]',
    'graphkeeper append run [options]',
  ],
  details: [
    'claim  Append a claim. Detailed help: graphkeeper append claim --help',
    'run    Create a run. See the append command reference for its complete grammar.',
  ],
  optionGroups: [],
  examples: [],
};

export const APPEND_CLAIM_HELP_TOPIC: CommandHelpTopic = {
  path: ['append', 'claim'],
  summary: [
    'Append one flat claim and link it to an existing open producing run.',
    'Recorded --command text is inert data; GraphKeeper never executes it.',
  ].join(' '),
  usage: [
    'graphkeeper append claim --subject <entity-id> --predicate <value> '
      + '--object <value> --produced-by <run-id> [source options] [optional options]',
  ],
  details: [],
  optionGroups: [
    { heading: 'Common required', options: helpOptions('common') },
    { heading: 'Source selection', options: helpOptions('source') },
    { heading: 'Tool-output required', options: helpOptions('tool-output') },
    { heading: 'Inference required', options: helpOptions('inference') },
    { heading: 'Optional', options: helpOptions('optional') },
  ],
  examples: [
    {
      label: 'Tool output',
      command: [
        'graphkeeper append claim \\',
        '  --subject test_payments_flaky --predicate has_status \\',
        '  --object passing_with_utc_default --kind tool_output \\',
        '  --command "TZ=UTC npm test -- payments" --exit-code 0 \\',
        '  --ref evidence/utc-rerun.log#L1-L3 \\',
        '  --captured 2026-09-05T09:04:00Z \\',
        '  --produced-by run_2026-09-05-investigation_a1',
      ].join('\n'),
    },
    {
      label: 'Inference',
      command: [
        'graphkeeper append claim \\',
        '  --subject test_payments_flaky --predicate may_depend_on \\',
        '  --object timezone_configuration --kind inference \\',
        '  --basis "The observed result changes when TZ changes." \\',
        '  --produced-by run_2026-09-05-investigation_a1',
      ].join('\n'),
    },
  ],
};

export const APPEND_HELP_TOPICS: readonly CommandHelpTopic[] = [
  APPEND_HELP_TOPIC,
  APPEND_CLAIM_HELP_TOPIC,
];

function splitFlags(args: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined || !argument.startsWith('--')) continue;
    const name = argument.slice(2);
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new GraphKeeperError('GK002', 'usage', 'flag --' + name + ' requires a value');
    }
    map.set(name, value);
    index += 1;
  }
  return map;
}

function splitList(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function parseClaimArgs(args: readonly string[], flags: Map<string, string>): ClaimArgs {
  const kindValue = flags.get('kind') ?? 'tool_output';
  if (kindValue !== 'tool_output' && kindValue !== 'inference') {
    throw new GraphKeeperError('GK002', 'usage', '--kind must be tool_output or inference');
  }
  const kind = kindValue === 'inference' ? 'inference' : 'tool_output';

  const confidenceValue = flags.get('confidence');
  if (confidenceValue !== undefined && !Number.isFinite(Number(confidenceValue))) {
    throw new GraphKeeperError('GK002', 'usage', '--confidence must be a number');
  }
  const exitCodeValue = flags.get('exit-code');
  if (exitCodeValue !== undefined && !Number.isInteger(Number(exitCodeValue))) {
    throw new GraphKeeperError('GK002', 'usage', '--exit-code must be an integer');
  }

  const sourceFields = kind === 'inference'
    ? { basis: flags.get('basis') }
    : {
      command: flags.get('command'),
      exit_code: exitCodeValue !== undefined ? Number(exitCodeValue) : undefined,
      ref: flags.get('ref'),
      captured: flags.get('captured'),
    };

  return {
    kind,
    ...sourceFields,
    subject: flags.get('subject') ?? '',
    predicate: flags.get('predicate') ?? '',
    object: flags.get('object') ?? '',
    produced_by: flags.get('produced-by') ?? '',
    ...(confidenceValue !== undefined ? { confidence: Number(confidenceValue) } : {}),
    ...(flags.get('created') !== undefined ? { created: flags.get('created') as string } : {}),
    ...(flags.get('id') !== undefined ? { id: flags.get('id') as string } : {}),
    ...(flags.get('supersedes') !== undefined ? { supersedes: flags.get('supersedes') as string } : {}),
  } as ClaimArgs;
}

function parseRunArgs(args: readonly string[], flags: Map<string, string>): RunArgs {
  const verdictValue = flags.get('verdict');
  if (verdictValue !== undefined
    && verdictValue !== 'passed' && verdictValue !== 'failed'
    && verdictValue !== 'inconclusive' && verdictValue !== 'aborted') {
    throw new GraphKeeperError('GK002', 'usage', '--verdict must be passed|failed|inconclusive|aborted');
  }
  const ended = flags.get('ended');
  return {
    started: flags.get('started') ?? '',
    tool: flags.get('tool') ?? '',
    ...(flags.get('id') !== undefined ? { id: flags.get('id') as string } : {}),
    ...(flags.get('task') !== undefined ? { task: flags.get('task') as string } : {}),
    ...(flags.get('evidence') !== undefined ? { evidence: splitList(flags.get('evidence') as string) } : {}),
    ...(flags.get('claims-written') !== undefined
      ? { claims_written: splitList(flags.get('claims-written') as string) }
      : {}),
    ...(ended !== undefined && verdictValue !== undefined
      ? { ended, verdict: verdictValue as RunVerdict }
      : {}),
  } as RunArgs;
}

/**
 * Parse `graphkeeper append claim|run [--flag value ...]`. Returns a discriminated
 * union: `{ ok: true, ... }` on success, or `{ ok: false, usageError }` when the
 * grammar is invalid. Required-field completeness is enforced later by build.
 */
export function parseAppendArguments(recordType: string, args: readonly string[]): ParsedAppend {
  try {
    if (recordType === 'claim') {
      for (const argument of args) {
        if (argument.startsWith('--') && !CLAIM_FLAGS.has(argument.slice(2))) {
          return { ok: false, usageError: 'unknown claim flag: ' + argument };
        }
      }
      const claim = parseClaimArgs(args, splitFlags(args));
      return { kind: 'claim', ok: true, options: { kind: 'claim', claim } };
    }
    if (recordType === 'run') {
      for (const argument of args) {
        if (argument.startsWith('--') && !RUN_FLAGS.has(argument.slice(2))) {
          return { ok: false, usageError: 'unknown run flag: ' + argument };
        }
      }
      const run = parseRunArgs(args, splitFlags(args));
      return { kind: 'run', ok: true, options: { kind: 'run', run } };
    }
    return { ok: false, usageError: 'append requires a record type: claim or run' };
  } catch (error: unknown) {
    if (error instanceof GraphKeeperError && error.code === 'GK002') {
      return { ok: false, usageError: error.message };
    }
    throw error;
  }
}
