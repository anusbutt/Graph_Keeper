import { randomUUID } from 'node:crypto';
import {
  chmod,
  link,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GraphKeeperError } from '../lib/errors.js';
import { resolveHooksPath } from '../lib/git.js';
import { findRepositoryRoot, resolveContainedPath } from '../lib/paths.js';
import { runProcess, type ProcessResult } from '../lib/process.js';

export interface InitEnvironment {
  readonly platform: NodeJS.Platform;
  readonly nodeVersion: string;
  readonly env: NodeJS.ProcessEnv;
  readonly probe: (
    command: string,
    args: readonly string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
  ) => Promise<ProcessResult>;
}

export type ScaffoldActionKind = 'create' | 'skip' | 'refresh' | 'warn';

export interface ScaffoldAction {
  readonly kind: ScaffoldActionKind;
  readonly target: string;
  readonly reason: string;
}

export interface ScaffoldPlanOptions {
  readonly force: boolean;
  readonly isGitRepository: boolean;
}

export interface InitWriteHooks {
  readonly beforeCommit?: (
    target: string,
    kind: 'create' | 'refresh',
  ) => Promise<void>;
}

export interface InitializeOptions {
  readonly cwd: string;
  readonly force: boolean;
  readonly environment?: InitEnvironment;
  readonly writeHooks?: InitWriteHooks;
}

export interface InitReport {
  readonly root: string;
  readonly isGitRepository: boolean;
  readonly actions: readonly ScaffoldAction[];
}

interface ScaffoldTarget {
  readonly target: string;
  readonly refreshable: boolean;
}

interface HookPlan {
  readonly kind: 'install' | 'skip' | 'collision';
  readonly destination: string;
  readonly content: string;
  readonly fallback: string;
  readonly fallbackKind: 'create' | 'skip' | 'blocked';
}

const scaffoldTargets: readonly ScaffoldTarget[] = [
  { target: 'graph/entities.json', refreshable: false },
  { target: 'graph/claims.json', refreshable: false },
  { target: 'graph/runs.json', refreshable: false },
  { target: 'evidence', refreshable: false },
  { target: 'graph/SCHEMA.md', refreshable: true },
  { target: 'SKILL.md', refreshable: true },
  { target: 'scripts/validate.sh', refreshable: false },
];

const defaultEnvironment: InitEnvironment = {
  platform: process.platform,
  nodeVersion: process.versions.node,
  env: process.env,
  probe: (command, args, cwd, env) =>
    runProcess(command, args, { cwd, env, timeoutMs: 10_000 }),
};

const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));

function prerequisite(message: string): GraphKeeperError {
  return new GraphKeeperError('GK003', 'prerequisite', message);
}

function parseMajor(version: string): number | null {
  const match = /^([0-9]+)/.exec(version);
  return match === null ? null : Number.parseInt(match[1] ?? '', 10);
}

function supportedJq(versionOutput: string): boolean {
  const match = /^jq-([0-9]+)\.([0-9]+)/.exec(versionOutput.trim());
  if (match === null) return false;
  const major = Number.parseInt(match[1] ?? '', 10);
  const minor = Number.parseInt(match[2] ?? '', 10);
  return major > 1 || (major === 1 && minor >= 6);
}

async function requireProbe(
  cwd: string,
  environment: InitEnvironment,
  command: string,
  args: readonly string[],
  failureMessage: string,
): Promise<ProcessResult> {
  const result = await environment.probe(command, args, cwd, environment.env);
  if (result.exitCode !== 0) throw prerequisite(failureMessage);
  return result;
}

export async function checkInitPrerequisites(
  cwd: string,
  environment: InitEnvironment = defaultEnvironment,
): Promise<void> {
  const nodeMajor = parseMajor(environment.nodeVersion);
  if (nodeMajor === null || nodeMajor < 18) {
    throw prerequisite('Node.js 18 or newer is required. Install it from https://nodejs.org/');
  }

  if (environment.platform === 'win32' && !environment.env.MSYSTEM) {
    throw prerequisite(
      'GraphKeeper v1 does not support native PowerShell. Run it through Git Bash or WSL. '
      + 'Install Git Bash from https://gitforwindows.org/',
    );
  }

  await requireProbe(
    cwd,
    environment,
    'git',
    ['--version'],
    'Git is required. Install it from https://git-scm.com/downloads',
  );
  await requireProbe(
    cwd,
    environment,
    'sh',
    ['-c', 'exit 0'],
    'A POSIX-compatible shell is required. On Windows install Git Bash from '
      + 'https://gitforwindows.org/',
  );
  const jq = await requireProbe(
    cwd,
    environment,
    'jq',
    ['--version'],
    'jq 1.6 or newer is required. Install it from https://jqlang.org/download/',
  );
  if (!supportedJq(jq.stdout || jq.stderr)) {
    throw prerequisite('jq 1.6 or newer is required. Install it from https://jqlang.org/download/');
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function planScaffold(
  root: string,
  options: ScaffoldPlanOptions,
): Promise<ScaffoldAction[]> {
  const actions: ScaffoldAction[] = [];
  for (const entry of scaffoldTargets) {
    const exists = await pathExists(resolve(root, entry.target));
    if (!exists) {
      actions.push({
        kind: 'create',
        target: entry.target,
        reason: 'missing',
      });
    } else if (options.force && entry.refreshable) {
      actions.push({
        kind: 'refresh',
        target: entry.target,
        reason: 'generated documentation refresh requested',
      });
    } else {
      actions.push({
        kind: 'skip',
        target: entry.target,
        reason: entry.refreshable
          ? 'already exists; use --force to refresh generated documentation'
          : 'already exists and is preserved',
      });
    }
  }

  if (!options.isGitRepository) {
    actions.push({
      kind: 'warn',
      target: 'git-enforcement',
      reason: 'enforcement is disabled until git init runs and GraphKeeper is initialized again',
    });
  }
  return actions;
}

function sourcePath(target: string): string {
  return target === 'scripts/validate.sh'
    ? resolve(packageRoot, 'scripts', 'validate.sh')
    : resolve(packageRoot, 'templates', target);
}

function targetMode(target: string): number {
  return target === 'scripts/validate.sh' ? 0o755 : 0o644;
}

function operational(message: string, error?: unknown): GraphKeeperError {
  const detail = error instanceof Error ? ': ' + error.message : '';
  return new GraphKeeperError('GK004', 'operational', message + detail);
}

async function validateDestinationShapes(root: string): Promise<void> {
  for (const entry of scaffoldTargets) {
    const target = resolveContainedPath(root, entry.target);
    try {
      const information = await lstat(target);
      const expectedDirectory = entry.target === 'evidence';
      if (expectedDirectory ? !information.isDirectory() : !information.isFile()) {
        throw operational(
          'Existing path has the wrong type and was preserved: ' + entry.target,
        );
      }
    } catch (error: unknown) {
      if (error instanceof GraphKeeperError) throw error;
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue;
      throw operational('Unable to inspect destination ' + entry.target, error);
    }
  }
}

async function loadRequiredAssets(
  actions: readonly ScaffoldAction[],
): Promise<Map<string, string>> {
  const contents = new Map<string, string>();
  try {
    await Promise.all(
      actions
        .filter((action) =>
          action.target !== 'evidence'
          && (action.kind === 'create' || action.kind === 'refresh'))
        .map(async (action) => {
          contents.set(action.target, await readFile(sourcePath(action.target), 'utf8'));
        }),
    );
  } catch (error: unknown) {
    throw operational('Unable to load packaged initialization assets', error);
  }
  return contents;
}

async function prepareHookPlan(root: string): Promise<HookPlan> {
  let content: string;
  try {
    content = await readFile(resolve(packageRoot, 'templates', 'pre-commit'), 'utf8');
  } catch (error: unknown) {
    throw operational('Unable to load the packaged pre-commit hook', error);
  }

  const destinationDirectory = await resolveHooksPath(root);
  const destination = resolve(destinationDirectory, 'pre-commit');
  const fallback = resolveContainedPath(root, '.githooks/pre-commit');
  let existing: string | null = null;
  try {
    const information = await lstat(destination);
    if (!information.isFile()) {
      throw operational('Existing pre-commit hook path is not a file and was preserved');
    }
    existing = await readFile(destination, 'utf8');
  } catch (error: unknown) {
    if (error instanceof GraphKeeperError) throw error;
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw operational('Unable to inspect the configured pre-commit hook', error);
    }
  }

  if (existing === null) {
    return {
      kind: 'install',
      destination,
      content,
      fallback,
      fallbackKind: 'skip',
    };
  }
  if (existing === content && existing.includes('GraphKeeper managed hook')) {
    return {
      kind: 'skip',
      destination,
      content,
      fallback,
      fallbackKind: 'skip',
    };
  }

  let fallbackKind: HookPlan['fallbackKind'] = 'create';
  try {
    const information = await lstat(fallback);
    if (!information.isFile()) {
      fallbackKind = 'blocked';
    } else {
      fallbackKind = await readFile(fallback, 'utf8') === content ? 'skip' : 'blocked';
    }
  } catch (error: unknown) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw operational('Unable to inspect the fallback hook path', error);
    }
  }
  return {
    kind: 'collision',
    destination,
    content,
    fallback,
    fallbackKind,
  };
}

function temporarySibling(target: string): string {
  return resolve(
    dirname(target),
    '.' + basename(target) + '.graphkeeper-tmp-' + randomUUID(),
  );
}

async function atomicCreate(
  target: string,
  relativeTarget: string,
  content: string,
  mode: number,
  hooks: InitWriteHooks,
): Promise<boolean> {
  await mkdir(dirname(target), { recursive: true, mode: 0o755 });
  const temporary = temporarySibling(target);
  try {
    await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode });
    await chmod(temporary, mode);
    await hooks.beforeCommit?.(relativeTarget, 'create');
    try {
      await link(temporary, target);
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
        return false;
      }
      throw error;
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

async function atomicRefresh(
  target: string,
  relativeTarget: string,
  content: string,
  mode: number,
  hooks: InitWriteHooks,
): Promise<void> {
  await mkdir(dirname(target), { recursive: true, mode: 0o755 });
  const temporary = temporarySibling(target);
  try {
    await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode });
    await chmod(temporary, mode);
    await hooks.beforeCommit?.(relativeTarget, 'refresh');
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function createEvidenceDirectory(target: string): Promise<boolean> {
  try {
    await mkdir(target, { mode: 0o755 });
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') return false;
    throw error;
  }
}

async function applyHookPlan(
  root: string,
  hookPlan: HookPlan,
  hooks: InitWriteHooks,
): Promise<ScaffoldAction[]> {
  if (hookPlan.kind === 'skip') {
    return [{
      kind: 'skip',
      target: 'pre-commit-hook',
      reason: 'GraphKeeper hook is already installed at ' + hookPlan.destination,
    }];
  }
  if (hookPlan.kind === 'install') {
    const created = await atomicCreate(
      hookPlan.destination,
      'pre-commit-hook',
      hookPlan.content,
      0o755,
      hooks,
    );
    return [{
      kind: created ? 'create' : 'skip',
      target: 'pre-commit-hook',
      reason: created
        ? 'installed at ' + hookPlan.destination
        : 'appeared during initialization and was preserved',
    }];
  }

  const actions: ScaffoldAction[] = [];
  if (hookPlan.fallbackKind === 'create') {
    const created = await atomicCreate(
      hookPlan.fallback,
      '.githooks/pre-commit',
      hookPlan.content,
      0o755,
      hooks,
    );
    actions.push({
      kind: created ? 'create' : 'skip',
      target: '.githooks/pre-commit',
      reason: created
        ? 'inspectable GraphKeeper chaining hook created'
        : 'fallback appeared during initialization and was preserved',
    });
  } else if (hookPlan.fallbackKind === 'skip') {
    actions.push({
      kind: 'skip',
      target: '.githooks/pre-commit',
      reason: 'inspectable GraphKeeper chaining hook already exists',
    });
  }

  const fallbackStatus = hookPlan.fallbackKind === 'blocked'
    ? ' The fallback path .githooks/pre-commit is also occupied and was preserved.'
    : '';
  actions.push({
    kind: 'warn',
    target: 'pre-commit-hook',
    reason: 'Existing hook at ' + hookPlan.destination
      + ' was not overwritten. To chain GraphKeeper, add this line to that hook: '
      + 'sh "$(git rev-parse --show-toplevel)/.githooks/pre-commit".'
      + fallbackStatus,
  });
  return actions;
}

export async function initialize(options: InitializeOptions): Promise<InitReport> {
  const environment = options.environment ?? defaultEnvironment;
  await checkInitPrerequisites(options.cwd, environment);

  const discoveredRoot = await findRepositoryRoot(options.cwd);
  const isGitRepository = discoveredRoot !== null;
  const root = discoveredRoot ?? resolve(options.cwd);
  const plan = await planScaffold(root, {
    force: options.force,
    isGitRepository,
  });
  await validateDestinationShapes(root);
  const assets = await loadRequiredAssets(plan);
  const hookPlan = isGitRepository ? await prepareHookPlan(root) : null;
  const hooks = options.writeHooks ?? {};
  const completed: ScaffoldAction[] = [];

  try {
    for (const action of plan) {
      if (action.kind === 'skip' || action.kind === 'warn') {
        completed.push(action);
        continue;
      }
      const target = resolveContainedPath(root, action.target);
      if (action.target === 'evidence') {
        const created = await createEvidenceDirectory(target);
        completed.push(created ? action : {
          kind: 'skip',
          target: action.target,
          reason: 'appeared during initialization and was preserved',
        });
        continue;
      }
      const content = assets.get(action.target);
      if (content === undefined) {
        throw operational('Packaged content is unavailable for ' + action.target);
      }
      if (action.kind === 'create') {
        const created = await atomicCreate(
          target,
          action.target,
          content,
          targetMode(action.target),
          hooks,
        );
        completed.push(created ? action : {
          kind: 'skip',
          target: action.target,
          reason: 'appeared during initialization and was preserved',
        });
      } else {
        await atomicRefresh(
          target,
          action.target,
          content,
          targetMode(action.target),
          hooks,
        );
        completed.push(action);
      }
    }
    if (hookPlan !== null) {
      completed.push(...await applyHookPlan(root, hookPlan, hooks));
    }
  } catch (error: unknown) {
    if (error instanceof GraphKeeperError) throw error;
    throw operational('Initialization stopped; rerun after correcting the reported cause', error);
  }

  return { root, isGitRepository, actions: completed };
}
