import { chmod, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runProcess, type ProcessResult } from '../../src/lib/process.js';
import { createRepositoryFixture, type RepositoryFixture } from './repository.js';

const validatorSource = fileURLToPath(new URL('../../../scripts/validate.sh', import.meta.url));

export const timestamp = '2026-07-21T09:14:22Z';

export const validEntity = {
  id: 'test_payments_flaky',
  type: 'test',
  aliases: ['payments test'],
  source_docs: ['evidence/triage.log#L1-L2'],
  first_seen: timestamp,
};

export const validClaim = {
  id: 'claim_a1b2c3d4',
  subject: validEntity.id,
  predicate: 'has_status',
  object: 'flaky',
  confidence: 0.9,
  source: {
    kind: 'tool_output',
    command: 'npm test',
    exit_code: 1,
    ref: 'evidence/triage.log#L1-L2',
    captured: timestamp,
  },
  produced_by: 'run_2026-07-21-triage_a1',
  created: timestamp,
};

export const validRun = {
  id: validClaim.produced_by,
  started: timestamp,
  tool: 'codex',
  evidence: ['evidence/triage.log'],
  claims_written: [validClaim.id],
  ended: '2026-07-21T09:15:22Z',
  verdict: 'passed',
};

export interface ValidatorFixture extends RepositoryFixture {
  readonly validator: string;
  readonly writeGraph: (
    entities?: unknown,
    claims?: unknown,
    runs?: unknown,
  ) => Promise<void>;
  readonly stageAll: () => Promise<void>;
  readonly commitAll: (message?: string) => Promise<void>;
}

export async function createValidatorFixture(
  prefix = 'graphkeeper-test-',
): Promise<ValidatorFixture> {
  const fixture = await createRepositoryFixture(true, prefix);
  const validator = join(fixture.root, 'scripts', 'validate.sh');
  await mkdir(dirname(validator), { recursive: true });
  await copyFile(validatorSource, validator);
  await chmod(validator, 0o755);

  const writeGraph = async (
    entities: unknown = [validEntity],
    claims: unknown = [validClaim],
    runs: unknown = [validRun],
  ): Promise<void> => {
    await fixture.writeJson('graph/entities.json', entities);
    await fixture.writeJson('graph/claims.json', claims);
    await fixture.writeJson('graph/runs.json', runs);
    await mkdir(join(fixture.root, 'evidence'), { recursive: true });
    await writeFile(join(fixture.root, 'evidence', 'triage.log'), 'failure\nstack\n', 'utf8');
  };

  const stageAll = async (): Promise<void> => {
    const result = await fixture.git(['add', '--all']);
    if (result.exitCode !== 0) throw new Error(result.stderr);
  };

  const commitAll = async (message = 'baseline'): Promise<void> => {
    await stageAll();
    const result = await fixture.git(['commit', '-m', message]);
    if (result.exitCode !== 0) throw new Error(result.stderr);
  };

  return { ...fixture, validator, writeGraph, stageAll, commitAll };
}

function shellExecutable(): string {
  if (process.env.GRAPHKEEPER_TEST_SH !== undefined) return process.env.GRAPHKEEPER_TEST_SH;
  return process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\sh.exe' : '/bin/sh';
}

export async function runValidator(
  fixture: ValidatorFixture,
  mode: '--staged' | '--worktree',
  env: NodeJS.ProcessEnv = process.env,
): Promise<ProcessResult> {
  const script = fixture.validator.replaceAll('\\', '/');
  return runProcess(shellExecutable(), [script, mode], {
    cwd: fixture.root,
    env,
    timeoutMs: 10_000,
  });
}
