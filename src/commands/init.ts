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
import {
  AGENT_IDS,
  getAgentAdapter,
  planGuidanceContent,
  type AgentId,
  type GuidanceContentPlan,
} from '../lib/agent-adapters.js';
import { resolveHooksPath } from '../lib/git.js';
import { findRepositoryRoot, resolveContainedPath } from '../lib/paths.js';
import { runProcess, type ProcessResult } from '../lib/process.js';
import {
  applyAgentIntegrationPlan,
  prepareAgentInstall,
  validateAgentIntegrationPlan,
  type AgentIntegrationPlan,
  type IntegrationActionKind,
} from './integrate.js';

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

export type ScaffoldActionKind = IntegrationActionKind | 'warn';

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
  readonly integrations?: readonly AgentId[];
  readonly integrateCodex?: boolean;
  readonly environment?: InitEnvironment;
  readonly writeHooks?: InitWriteHooks;
}

export interface InitReport {
  readonly root: string;
  readonly isGitRepository: boolean;
  readonly actions: readonly ScaffoldAction[];
  readonly notes: readonly string[];
}

export type CodexGuidanceActionKind = 'create' | 'append' | 'refresh' | 'skip';
export type CodexGuidanceContentPlan = GuidanceContentPlan;

interface ScaffoldTarget {
  readonly target: string;
  readonly refreshable: boolean;
}

interface HookPlan {
  readonly kind: 'install' | 'refresh' | 'skip' | 'collision';
  readonly destination: string;
  readonly content: string;
  readonly expected: string | null;
  readonly fallback: string;
  readonly fallbackKind: 'create' | 'refresh' | 'skip' | 'blocked';
  readonly fallbackExpected: string | null;
}

const LEGACY_PRE_COMMIT_HOOK = [
  '#!/bin/sh',
  '# GraphKeeper managed hook',
  'set -eu',
  'root=$(git rev-parse --show-toplevel)',
  'exec sh \u0022\u0024root/scripts/validate.sh\u0022 --staged',
  '',
].join('\n');

export interface PreparedInitialization {
  readonly root: string;
  readonly isGitRepository: boolean;
  readonly actions: readonly ScaffoldAction[];
  readonly notes: readonly string[];
  readonly scaffoldActions: readonly ScaffoldAction[];
  readonly assets: ReadonlyMap<string, string>;
  readonly hookPlan: HookPlan | null;
  readonly integrationPlan: AgentIntegrationPlan | null;
  readonly refreshExpected: ReadonlyMap<string, string>;
  readonly writeHooks: InitWriteHooks;
}


export function planCodexGuidanceContent(
  existing: string | null,
): CodexGuidanceContentPlan {
  return planGuidanceContent(getAgentAdapter('codex'), existing);
}

const scaffoldTargets: readonly ScaffoldTarget[] = [
  { target: 'graph/entities.json', refreshable: false },
  { target: 'graph/claims.json', refreshable: false },
  { target: 'graph/runs.json', refreshable: false },
  { target: 'evidence', refreshable: false },
  { target: 'graph/SCHEMA.md', refreshable: true },
  { target: '.agents/skills/graphkeeper/SKILL.md', refreshable: true },
  { target: 'scripts/validate.sh', refreshable: false },
  { target: 'scripts/validate.mjs', refreshable: false },
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

  await requireProbe(
    cwd,
    environment,
    'git',
    ['--version'],
    'Git is required. Install it from https://git-scm.com/downloads',
  );
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
      if (entry.target === 'scripts/validate.mjs') {
        const legacyPath = resolve(root, 'scripts', 'validate.sh');
        if (await pathExists(legacyPath)) {
          const [legacy, packaged] = await Promise.all([
            readFile(legacyPath, 'utf8'),
            readFile(resolve(packageRoot, 'scripts', 'validate.sh'), 'utf8'),
          ]);
          if (legacy !== packaged) {
            actions.push({
              kind: 'skip',
              target: entry.target,
              reason: 'modified legacy validator was preserved; manual migration is required',
            });
            continue;
          }
        }
      }
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

  if (await pathExists(resolve(root, 'SKILL.md'))) {
    actions.push({
      kind: 'warn',
      target: 'SKILL.md',
      reason: 'legacy root guidance was preserved; Codex discovers the generated skill under .agents/skills/graphkeeper',
    });
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
  if (target === 'scripts/validate.sh' || target === 'scripts/validate.mjs') {
    return resolve(packageRoot, target);
  }
  if (target === '.agents/skills/graphkeeper/SKILL.md') {
    return resolve(packageRoot, 'templates', 'SKILL.md');
  }
  return resolve(packageRoot, 'templates', target);
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
    resolveContainedPath(root, entry.target);
    const segments = entry.target.split(/[\\/]/);
    let current = resolve(root);
    try {
      for (let index = 0; index < segments.length; index += 1) {
        current = resolve(current, segments[index] ?? '');
        let information: Awaited<ReturnType<typeof lstat>>;
        try {
          information = await lstat(current);
        } catch (error: unknown) {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') break;
          throw error;
        }
        if (information.isSymbolicLink()) {
          throw operational('Symbolic-link destination was preserved: ' + entry.target);
        }
        if (index < segments.length - 1 && !information.isDirectory()) {
          throw operational('Existing path has the wrong type and was preserved: ' + entry.target);
        }
        if (index === segments.length - 1) {
          const expectedDirectory = entry.target === 'evidence';
          if (expectedDirectory ? !information.isDirectory() : !information.isFile()) {
            throw operational(
              'Existing path has the wrong type and was preserved: ' + entry.target,
            );
          }
        }
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
      expected: null,
      fallback,
      fallbackKind: 'skip',
      fallbackExpected: null,
    };
  }
  if (existing === content && existing.includes('GraphKeeper managed hook')) {
    return {
      kind: 'skip',
      destination,
      content,
      expected: existing,
      fallback,
      fallbackKind: 'skip',
      fallbackExpected: null,
    };
  }
  if (existing === LEGACY_PRE_COMMIT_HOOK) {
    return {
      kind: 'refresh',
      destination,
      content,
      expected: existing,
      fallback,
      fallbackKind: 'skip',
      fallbackExpected: null,
    };
  }

  let fallbackKind: HookPlan['fallbackKind'] = 'create';
  let fallbackExpected: string | null = null;
  try {
    const information = await lstat(fallback);
    if (!information.isFile()) {
      fallbackKind = 'blocked';
    } else {
      fallbackExpected = await readFile(fallback, 'utf8');
      fallbackKind = fallbackExpected === content
        ? 'skip'
        : fallbackExpected === LEGACY_PRE_COMMIT_HOOK
          ? 'refresh'
          : 'blocked';
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
    expected: existing,
    fallback,
    fallbackKind,
    fallbackExpected,
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
  expectedCurrent?: string,
): Promise<void> {
  await mkdir(dirname(target), { recursive: true, mode: 0o755 });
  const temporary = temporarySibling(target);
  try {
    await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode });
    await chmod(temporary, mode);
    await hooks.beforeCommit?.(relativeTarget, 'refresh');
    if (expectedCurrent !== undefined) {
      let current: string;
      try {
        current = await readFile(target, 'utf8');
      } catch (error: unknown) {
        throw operational(relativeTarget + ' changed concurrently and was preserved', error);
      }
      if (current !== expectedCurrent) {
        throw operational(relativeTarget + ' changed concurrently and was preserved');
      }
    }
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
    if (!created) {
      throw operational('pre-commit-hook changed concurrently and was preserved');
    }
    return [{
      kind: 'create',
      target: 'pre-commit-hook',
      reason: 'installed at ' + hookPlan.destination,
    }];
  }
  if (hookPlan.kind === 'refresh') {
    if (hookPlan.expected === null) throw operational('legacy hook migration has no expected content');
    await atomicRefresh(
      hookPlan.destination,
      'pre-commit-hook',
      hookPlan.content,
      0o755,
      hooks,
      hookPlan.expected,
    );
    return [{
      kind: 'refresh',
      target: 'pre-commit-hook',
      reason: 'migrated package-owned legacy hook at ' + hookPlan.destination,
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
    if (!created) {
      throw operational('.githooks/pre-commit changed concurrently and was preserved');
    }
    actions.push({
      kind: 'create',
      target: '.githooks/pre-commit',
      reason: 'inspectable GraphKeeper chaining hook created',
    });
  } else if (hookPlan.fallbackKind === 'skip') {
    actions.push({
      kind: 'skip',
      target: '.githooks/pre-commit',
      reason: 'inspectable GraphKeeper chaining hook already exists',
    });
  } else if (hookPlan.fallbackKind === 'refresh') {
    if (hookPlan.fallbackExpected === null) {
      throw operational('legacy fallback hook migration has no expected content');
    }
    await atomicRefresh(
      hookPlan.fallback,
      '.githooks/pre-commit',
      hookPlan.content,
      0o755,
      hooks,
      hookPlan.fallbackExpected,
    );
    actions.push({
      kind: 'refresh',
      target: '.githooks/pre-commit',
      reason: 'migrated package-owned legacy chaining hook',
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
      + 'node \u0022\u0024(git rev-parse --show-toplevel)/.githooks/pre-commit\u0022.'
      + fallbackStatus,
  });
  return actions;
}

function plannedHookActions(hookPlan: HookPlan | null): ScaffoldAction[] {
  if (hookPlan === null) return [];
  if (hookPlan.kind === 'skip') {
    return [{
      kind: 'skip',
      target: 'pre-commit-hook',
      reason: 'GraphKeeper hook is already installed at ' + hookPlan.destination,
    }];
  }
  if (hookPlan.kind === 'install') {
    return [{
      kind: 'create',
      target: 'pre-commit-hook',
      reason: 'GraphKeeper hook will be installed at ' + hookPlan.destination,
    }];
  }
  if (hookPlan.kind === 'refresh') {
    return [{
      kind: 'refresh',
      target: 'pre-commit-hook',
      reason: 'package-owned legacy GraphKeeper hook will be migrated',
    }];
  }

  const actions: ScaffoldAction[] = [];
  if (hookPlan.fallbackKind === 'create') {
    actions.push({
      kind: 'create',
      target: '.githooks/pre-commit',
      reason: 'inspectable GraphKeeper chaining hook will be created',
    });
  } else if (hookPlan.fallbackKind === 'skip') {
    actions.push({
      kind: 'skip',
      target: '.githooks/pre-commit',
      reason: 'inspectable GraphKeeper chaining hook already exists',
    });
  } else if (hookPlan.fallbackKind === 'refresh') {
    actions.push({
      kind: 'refresh',
      target: '.githooks/pre-commit',
      reason: 'package-owned legacy chaining hook will be migrated',
    });
  }
  actions.push({
    kind: 'warn',
    target: 'pre-commit-hook',
    reason: 'existing third-party hook will be preserved and chaining guidance reported',
  });
  return actions;
}

function requestedIntegrations(options: InitializeOptions): readonly AgentId[] {
  const requested = new Set(options.integrations ?? []);
  if (options.integrateCodex === true) requested.add('codex');
  return AGENT_IDS.filter((id) => requested.has(id));
}

export async function prepareInitialization(
  options: InitializeOptions,
): Promise<PreparedInitialization> {
  const environment = options.environment ?? defaultEnvironment;
  await checkInitPrerequisites(options.cwd, environment);

  const discoveredRoot = await findRepositoryRoot(options.cwd);
  const isGitRepository = discoveredRoot !== null;
  const root = discoveredRoot ?? resolve(options.cwd);
  const scaffoldActions = await planScaffold(root, {
    force: options.force,
    isGitRepository,
  });
  await validateDestinationShapes(root);
  const integrations = requestedIntegrations(options);
  const integrationPlan = integrations.length === 0
    ? null
    : await prepareAgentInstall(root, integrations, options.force, {
      skipSkillFor: new Set<AgentId>(
        AGENT_IDS.filter((id) => getAgentAdapter(id).scaffoldSkillByInit === true),
      ),
    });
  const assets = await loadRequiredAssets(scaffoldActions);
  const hookPlan = isGitRepository ? await prepareHookPlan(root) : null;
  const refreshExpected = new Map<string, string>();
  for (const action of scaffoldActions) {
    if (action.kind === 'refresh') {
      try {
        refreshExpected.set(
          action.target,
          await readFile(resolveContainedPath(root, action.target), 'utf8'),
        );
      } catch (error: unknown) {
        throw operational(action.target + ' changed while initialization was planned', error);
      }
    }
  }

  return {
    root,
    isGitRepository,
    actions: [
      ...scaffoldActions,
      ...(integrationPlan?.actions ?? []),
      ...plannedHookActions(hookPlan),
    ],
    notes: integrationPlan?.notes ?? [],
    scaffoldActions,
    assets,
    hookPlan,
    integrationPlan,
    refreshExpected,
    writeHooks: options.writeHooks ?? {},
  };
}

export async function applyInitialization(
  prepared: PreparedInitialization,
): Promise<InitReport> {
  const {
    root,
    isGitRepository,
    scaffoldActions,
    assets,
    hookPlan,
    integrationPlan,
    refreshExpected,
    writeHooks: hooks,
  } = prepared;
  const completed: ScaffoldAction[] = [];

  try {
    await validateDestinationShapes(root);
    if (integrationPlan !== null) {
      await validateAgentIntegrationPlan(integrationPlan);
    }
    for (const action of scaffoldActions) {
      const target = resolveContainedPath(root, action.target);
      if (action.kind === 'create' && await pathExists(target)) {
        throw operational(action.target + ' changed after planning and was preserved');
      }
      if (action.kind === 'refresh') {
        let current: string;
        try {
          current = await readFile(target, 'utf8');
        } catch (error: unknown) {
          throw operational(action.target + ' changed after planning and was preserved', error);
        }
        if (current !== refreshExpected.get(action.target)) {
          throw operational(action.target + ' changed after planning and was preserved');
        }
      }
    }
    for (const action of scaffoldActions) {
      if (action.kind === 'skip' || action.kind === 'warn') {
        completed.push(action);
        continue;
      }
      const target = resolveContainedPath(root, action.target);
      if (action.target === 'evidence') {
        const created = await createEvidenceDirectory(target);
        if (!created) {
          throw operational(action.target + ' changed after planning and was preserved');
        }
        completed.push(action);
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
        if (!created) {
          throw operational(action.target + ' changed after planning and was preserved');
        }
        completed.push(action);
      } else {
        await atomicRefresh(
          target,
          action.target,
          content,
          targetMode(action.target),
          hooks,
          refreshExpected.get(action.target),
        );
        completed.push(action);
      }
    }
    if (integrationPlan !== null) {
      await applyAgentIntegrationPlan(integrationPlan, {
        beforeCommit: async (target, kind) => {
          if (kind !== 'remove') await hooks.beforeCommit?.(target, kind);
        },
      }, {
        ignoreSnapshotTargets: new Set([
          getAgentAdapter('codex').skillTarget,
        ]),
      });
      completed.push(...integrationPlan.actions);
    }
    if (hookPlan !== null) {
      completed.push(...await applyHookPlan(root, hookPlan, hooks));
    }
  } catch (error: unknown) {
    if (error instanceof GraphKeeperError) throw error;
    throw operational('Initialization stopped; rerun after correcting the reported cause', error);
  }

  return {
    root,
    isGitRepository,
    actions: completed,
    notes: prepared.notes,
  };
}

export async function initialize(options: InitializeOptions): Promise<InitReport> {
  return applyInitialization(await prepareInitialization(options));
}
