import { randomUUID } from 'node:crypto';
import {
  chmod,
  link,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getAgentAdapter,
  planGuidanceContent,
  planGuidanceRemovalContent,
  type AgentAdapter,
  type AgentId,
} from '../lib/agent-adapters.js';
import { GraphKeeperError } from '../lib/errors.js';
import { findRepositoryRoot, resolveContainedPath } from '../lib/paths.js';

export type IntegrationActionKind =
  | 'create'
  | 'append'
  | 'refresh'
  | 'skip'
  | 'remove'
  | 'preserve'
  | 'warning';

export interface IntegrationAction {
  readonly kind: IntegrationActionKind;
  readonly target: string;
  readonly reason: string;
  readonly adapter: AgentId;
}

type FileOperation = {
  readonly type: 'write';
  readonly target: string;
  readonly relativeTarget: string;
  readonly content: string;
  readonly expected: string | null;
  readonly mode: number;
} | {
  readonly type: 'delete-file';
  readonly target: string;
  readonly relativeTarget: string;
  readonly expected: string;
} | {
  readonly type: 'remove-directory';
  readonly target: string;
  readonly relativeTarget: string;
  readonly plannedEntries: readonly string[];
  readonly applyEntries: readonly string[];
};

interface FileSnapshot {
  readonly relativeTarget: string;
  readonly content: string | null;
}

export interface AgentIntegrationPlan {
  readonly mode: 'install' | 'remove';
  readonly root: string;
  readonly adapters: readonly AgentId[];
  readonly actions: readonly IntegrationAction[];
  readonly notes: readonly string[];
  readonly operations: readonly FileOperation[];
  readonly fileSnapshots: readonly FileSnapshot[];
}

export interface IntegrationWriteHooks {
  readonly beforeCommit?: (
    target: string,
    kind: 'create' | 'refresh' | 'remove',
  ) => Promise<void>;
}

const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));

function operational(message: string, error?: unknown): GraphKeeperError {
  const detail = error instanceof Error ? ': ' + error.message : '';
  return new GraphKeeperError('GK004', 'operational', message + detail);
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function canonicalSkill(): Promise<string> {
  try {
    return await readFile(resolve(packageRoot, 'templates', 'SKILL.md'), 'utf8');
  } catch (error: unknown) {
    throw operational('Unable to load the packaged GraphKeeper skill', error);
  }
}

async function inspectSafePath(
  root: string,
  relativeTarget: string,
): Promise<Awaited<ReturnType<typeof lstat>> | null> {
  const target = resolveContainedPath(root, relativeTarget);
  const segments = relativeTarget.split(/[\\/]/);
  let current = resolve(root);
  for (let index = 0; index < segments.length; index += 1) {
    current = resolve(current, segments[index] ?? '');
    let information: Awaited<ReturnType<typeof lstat>>;
    try {
      information = await lstat(current);
    } catch (error: unknown) {
      if (isMissing(error)) return null;
      throw operational('Unable to inspect destination ' + relativeTarget, error);
    }
    if (information.isSymbolicLink()) {
      throw operational('Symbolic-link destination was preserved: ' + relativeTarget);
    }
    if (index < segments.length - 1 && !information.isDirectory()) {
      throw operational('Existing path has the wrong type and was preserved: ' + relativeTarget);
    }
    if (index === segments.length - 1) return information;
  }
  return await lstat(target);
}

async function readOptionalRegularFile(
  root: string,
  relativeTarget: string,
): Promise<string | null> {
  const information = await inspectSafePath(root, relativeTarget);
  if (information === null) return null;
  if (!information.isFile()) {
    throw operational('Existing path has the wrong type and was preserved: ' + relativeTarget);
  }
  try {
    return await readFile(resolveContainedPath(root, relativeTarget), 'utf8');
  } catch (error: unknown) {
    throw operational('Unable to read destination ' + relativeTarget, error);
  }
}

function guidanceReason(adapter: AgentAdapter, kind: IntegrationActionKind): string {
  if (kind === 'skip') return 'GraphKeeper ' + adapter.displayName + ' guidance is already current';
  if (kind === 'create') return 'GraphKeeper ' + adapter.displayName + ' guidance file will be created';
  if (kind === 'append') return 'GraphKeeper ' + adapter.displayName + ' marked block will be appended';
  return 'GraphKeeper ' + adapter.displayName + ' marked block will be refreshed';
}

export async function prepareAgentInstall(
  root: string,
  adapterIds: readonly AgentId[],
  force: boolean,
  options: { readonly skipSkillFor?: ReadonlySet<AgentId> } = {},
): Promise<AgentIntegrationPlan> {
  const skill = await canonicalSkill();
  const actions: IntegrationAction[] = [];
  const operations: FileOperation[] = [];
  const notes: string[] = [];
  const fileSnapshots: FileSnapshot[] = [];

  for (const id of adapterIds) {
    const adapter = getAgentAdapter(id);
    const existingSkill = await readOptionalRegularFile(root, adapter.skillTarget);
    fileSnapshots.push({
      relativeTarget: adapter.skillTarget,
      content: existingSkill,
    });
    if (!options.skipSkillFor?.has(id)) {
      const skillKind = existingSkill === null
        ? 'create'
        : existingSkill === skill
          ? 'skip'
          : force
            ? 'refresh'
            : 'preserve';
      actions.push({
        kind: skillKind,
        target: adapter.skillTarget,
        adapter: id,
        reason: skillKind === 'create'
          ? 'canonical GraphKeeper skill will be created'
          : skillKind === 'refresh'
            ? 'canonical GraphKeeper skill will be refreshed under --force'
            : skillKind === 'skip'
              ? 'canonical GraphKeeper skill is already current'
              : 'existing skill was preserved; use --force to replace it with the canonical template',
      });
      if (skillKind === 'create' || skillKind === 'refresh') {
        operations.push({
          type: 'write',
          target: resolveContainedPath(root, adapter.skillTarget),
          relativeTarget: adapter.skillTarget,
          content: skill,
          expected: existingSkill,
          mode: 0o644,
        });
      }
    }

    const existingGuidance = await readOptionalRegularFile(root, adapter.guidanceTarget);
    fileSnapshots.push({
      relativeTarget: adapter.guidanceTarget,
      content: existingGuidance,
    });
    const guidance = planGuidanceContent(adapter, existingGuidance);
    actions.push({
      kind: guidance.kind,
      target: adapter.guidanceTarget,
      adapter: id,
      reason: guidanceReason(adapter, guidance.kind),
    });
    if (guidance.kind !== 'skip') {
      operations.push({
        type: 'write',
        target: resolveContainedPath(root, adapter.guidanceTarget),
        relativeTarget: adapter.guidanceTarget,
        content: guidance.content,
        expected: guidance.expected,
        mode: 0o644,
      });
    }

    if (adapter.postInstallNote !== undefined) {
      const skillsRoot = adapter.skillTarget.split('/').slice(0, -2).join('/');
      if (await inspectSafePath(root, skillsRoot) === null) notes.push(adapter.postInstallNote);
    }
  }

  return {
    mode: 'install',
    root,
    adapters: [...adapterIds],
    actions,
    notes,
    operations,
    fileSnapshots,
  };
}

async function directoryEntries(
  root: string,
  relativeTarget: string,
): Promise<readonly string[] | null> {
  const information = await inspectSafePath(root, relativeTarget);
  if (information === null) return null;
  if (!information.isDirectory()) {
    throw operational('Existing path has the wrong type and was preserved: ' + relativeTarget);
  }
  try {
    return (await readdir(resolveContainedPath(root, relativeTarget))).sort();
  } catch (error: unknown) {
    throw operational('Unable to inspect directory ' + relativeTarget, error);
  }
}

export async function prepareAgentRemoval(
  cwd: string,
  adapterId: AgentId,
): Promise<AgentIntegrationPlan> {
  const discoveredRoot = await findRepositoryRoot(cwd);
  const root = discoveredRoot ?? resolve(cwd);
  const adapter = getAgentAdapter(adapterId);
  const skill = await canonicalSkill();
  const actions: IntegrationAction[] = [];
  const operations: FileOperation[] = [];
  const fileSnapshots: FileSnapshot[] = [];

  const existingGuidance = await readOptionalRegularFile(root, adapter.guidanceTarget);
  fileSnapshots.push({
    relativeTarget: adapter.guidanceTarget,
    content: existingGuidance,
  });
  const guidance = planGuidanceRemovalContent(adapter, existingGuidance);
  actions.push({
    kind: guidance.kind,
    target: adapter.guidanceTarget,
    adapter: adapterId,
    reason: guidance.kind === 'remove'
      ? 'matching GraphKeeper marked block will be removed; surrounding content is preserved'
      : 'matching GraphKeeper marked block is already absent',
  });
  if (guidance.kind === 'remove' && guidance.content !== null && guidance.expected !== null) {
    operations.push({
      type: 'write',
      target: resolveContainedPath(root, adapter.guidanceTarget),
      relativeTarget: adapter.guidanceTarget,
      content: guidance.content,
      expected: guidance.expected,
      mode: 0o644,
    });
  }

  const skillDirectory = adapter.skillTarget.split('/').slice(0, -1).join('/');
  const entries = await directoryEntries(root, skillDirectory);
  if (entries === null) {
    actions.push({
      kind: 'skip',
      target: adapter.skillTarget,
      adapter: adapterId,
      reason: 'generated GraphKeeper skill is already absent',
    });
  } else if (entries.some((entry) => entry !== 'SKILL.md')) {
    actions.push({
      kind: 'preserve',
      target: skillDirectory,
      adapter: adapterId,
      reason: 'unexpected supporting files were preserved; remove this directory manually after review',
    });
  } else if (!entries.includes('SKILL.md')) {
    actions.push({
      kind: 'remove',
      target: skillDirectory,
      adapter: adapterId,
      reason: 'empty GraphKeeper skill directory will be removed',
    });
    operations.push({
      type: 'remove-directory',
      target: resolveContainedPath(root, skillDirectory),
      relativeTarget: skillDirectory,
      plannedEntries: entries,
      applyEntries: entries,
    });
  } else {
    const existingSkill = await readOptionalRegularFile(root, adapter.skillTarget);
    fileSnapshots.push({
      relativeTarget: adapter.skillTarget,
      content: existingSkill,
    });
    if (existingSkill !== skill) {
      actions.push({
        kind: 'preserve',
        target: adapter.skillTarget,
        adapter: adapterId,
        reason: 'user-modified or unrecognized skill was preserved; remove it manually after review',
      });
    } else {
      actions.push({
        kind: 'remove',
        target: adapter.skillTarget,
        adapter: adapterId,
        reason: 'canonical generated GraphKeeper skill will be removed',
      });
      actions.push({
        kind: 'remove',
        target: skillDirectory,
        adapter: adapterId,
        reason: 'now-empty GraphKeeper skill directory will be removed',
      });
      operations.push({
        type: 'delete-file',
        target: resolveContainedPath(root, adapter.skillTarget),
        relativeTarget: adapter.skillTarget,
        expected: existingSkill,
      });
      operations.push({
        type: 'remove-directory',
        target: resolveContainedPath(root, skillDirectory),
        relativeTarget: skillDirectory,
        plannedEntries: entries,
        applyEntries: [],
      });
    }
  }

  return {
    mode: 'remove',
    root,
    adapters: [adapterId],
    actions,
    notes: [],
    operations,
    fileSnapshots,
  };
}

function temporarySibling(target: string): string {
  return resolve(dirname(target), '.' + basename(target) + '.graphkeeper-tmp-' + randomUUID());
}

async function atomicWrite(
  operation: Extract<FileOperation, { type: 'write' }>,
  hooks: IntegrationWriteHooks,
): Promise<void> {
  await mkdir(dirname(operation.target), { recursive: true, mode: 0o755 });
  const temporary = temporarySibling(operation.target);
  try {
    await writeFile(temporary, operation.content, {
      encoding: 'utf8',
      flag: 'wx',
      mode: operation.mode,
    });
    await chmod(temporary, operation.mode);
    await hooks.beforeCommit?.(
      operation.relativeTarget,
      operation.expected === null ? 'create' : 'refresh',
    );
    if (operation.expected === null) {
      try {
        await link(temporary, operation.target);
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
          throw operational(operation.relativeTarget + ' changed concurrently and was preserved');
        }
        throw error;
      }
    } else {
      let current: string;
      try {
        current = await readFile(operation.target, 'utf8');
      } catch (error: unknown) {
        throw operational(operation.relativeTarget + ' changed concurrently and was preserved', error);
      }
      if (current !== operation.expected) {
        throw operational(operation.relativeTarget + ' changed concurrently and was preserved');
      }
      await rename(temporary, operation.target);
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function validateAgentIntegrationPlan(
  plan: AgentIntegrationPlan,
  ignoreSnapshotTargets: ReadonlySet<string> = new Set(),
): Promise<void> {
  for (const snapshot of plan.fileSnapshots) {
    if (ignoreSnapshotTargets.has(snapshot.relativeTarget)) continue;
    const current = await readOptionalRegularFile(plan.root, snapshot.relativeTarget);
    if (current !== snapshot.content) {
      throw operational(snapshot.relativeTarget + ' changed after planning and was preserved');
    }
  }
  for (const operation of plan.operations) {
    if (operation.type === 'write') {
      const current = await readOptionalRegularFile(plan.root, operation.relativeTarget);
      if (current !== operation.expected) {
        throw operational(operation.relativeTarget + ' changed after planning and was preserved');
      }
      continue;
    }
    if (operation.type === 'delete-file') {
      const current = await readOptionalRegularFile(plan.root, operation.relativeTarget);
      if (current !== operation.expected) {
        throw operational(operation.relativeTarget + ' changed after planning and was preserved');
      }
      continue;
    }
    const entries = await directoryEntries(plan.root, operation.relativeTarget);
    if (entries === null || entries.join('\0') !== operation.plannedEntries.join('\0')) {
      throw operational(operation.relativeTarget + ' changed after planning and was preserved');
    }
  }
}

async function restoreWrite(
  root: string,
  operation: Extract<FileOperation, { type: 'write' }>,
): Promise<void> {
  let current: string | null;
  try {
    current = await readOptionalRegularFile(root, operation.relativeTarget);
  } catch {
    return;
  }
  if (current !== operation.content) return;
  if (operation.expected === null) {
    await rm(operation.target, { force: true });
    return;
  }
  const rollback: Extract<FileOperation, { type: 'write' }> = {
    ...operation,
    content: operation.expected,
    expected: operation.content,
  };
  await atomicWrite(rollback, {});
}

export async function applyAgentIntegrationPlan(
  plan: AgentIntegrationPlan,
  hooks: IntegrationWriteHooks = {},
  options: { readonly ignoreSnapshotTargets?: ReadonlySet<string> } = {},
): Promise<void> {
  await validateAgentIntegrationPlan(
    plan,
    options.ignoreSnapshotTargets ?? new Set(),
  );
  const completed: FileOperation[] = [];
  try {
    for (const operation of plan.operations) {
      if (operation.type === 'write') {
        await atomicWrite(operation, hooks);
      } else if (operation.type === 'delete-file') {
        await hooks.beforeCommit?.(operation.relativeTarget, 'remove');
        const current = await readOptionalRegularFile(plan.root, operation.relativeTarget);
        if (current !== operation.expected) {
          throw operational(operation.relativeTarget + ' changed concurrently and was preserved');
        }
        await rm(operation.target);
      } else {
        await hooks.beforeCommit?.(operation.relativeTarget, 'remove');
        const entries = await directoryEntries(plan.root, operation.relativeTarget);
        if (entries === null || entries.join('\0') !== operation.applyEntries.join('\0')) {
          throw operational(operation.relativeTarget + ' changed concurrently and was preserved');
        }
        await rmdir(operation.target);
      }
      completed.push(operation);
    }
  } catch (error: unknown) {
    for (const operation of [...completed].reverse()) {
      try {
        if (operation.type === 'write') {
          await restoreWrite(plan.root, operation);
        } else if (operation.type === 'delete-file') {
          await mkdir(dirname(operation.target), { recursive: true, mode: 0o755 });
          await writeFile(operation.target, operation.expected, { encoding: 'utf8', flag: 'wx', mode: 0o644 });
        } else {
          await mkdir(operation.target, { mode: 0o755 });
        }
      } catch {
        // Rollback is deliberately best-effort and never overwrites a concurrent change.
      }
    }
    if (error instanceof GraphKeeperError) throw error;
    throw operational('Agent integration stopped; the prior state was restored where safe', error);
  }
}
