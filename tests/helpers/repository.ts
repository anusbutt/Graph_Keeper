import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface RepositoryFixture {
  readonly root: string;
  readonly git: (args: readonly string[]) => Promise<CommandResult>;
  readonly writeJson: (relativePath: string, value: unknown) => Promise<void>;
  readonly cleanup: () => Promise<void>;
}

export async function runCommand(
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<CommandResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, [...args], {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      resolveResult({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

function containedPath(root: string, relativePath: string): string {
  const target = resolve(root, relativePath);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error('Fixture path escapes repository root: ' + relativePath);
  }
  return target;
}

export async function createRepositoryFixture(
  initializeGit = true,
  prefix = 'graphkeeper-test-',
): Promise<RepositoryFixture> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const git = (args: readonly string[]) => runCommand('git', args, root);

  if (initializeGit) {
    const initialized = await git(['init']);
    if (initialized.exitCode !== 0) {
      await rm(root, { recursive: true, force: true });
      throw new Error('Unable to initialize Git fixture: ' + initialized.stderr);
    }
    await git(['config', 'user.name', 'GraphKeeper Test']);
    await git(['config', 'user.email', 'graphkeeper@example.invalid']);
  }

  return {
    root,
    git,
    writeJson: async (relativePath, value) => {
      const target = containedPath(root, relativePath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, JSON.stringify(value, null, 2) + '\n', 'utf8');
    },
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
