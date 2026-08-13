import assert from 'node:assert/strict';
import { access, copyFile, cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runProcess } from '../../src/lib/process.js';
import { createRepositoryFixture } from '../helpers/repository.js';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

function npmInvocation(args: readonly string[]): {
  readonly command: string;
  readonly args: readonly string[];
} {
  if (process.platform !== 'win32') return { command: 'npm', args };
  return {
    command: process.execPath,
    args: [join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), ...args],
  };
}

function supportedEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    ...(process.platform === 'win32' ? { MSYSTEM: 'MINGW64' } : {}),
  };
  if (process.platform === 'win32') {
    const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
    environment[pathKey] = [
      'C:\\Program Files\\Git\\bin',
      'C:\\tmp\\graphkeeper-tools',
      environment[pathKey] ?? '',
    ].join(delimiter);
  }
  return environment;
}

interface PackManifest {
  readonly filename: string;
}

test('a tarball installs in a clean directory and runs init, check, query, and doctor', {
  timeout: 120_000,
}, async (t) => {
  const packingRoot = await mkdtemp(join(tmpdir(), 'graphkeeper-install-pack-'));
  const installationRoot = await mkdtemp(join(tmpdir(), 'graphkeeper-install-clean-'));
  const repository = await createRepositoryFixture(true, 'graphkeeper installed repo with spaces ');
  t.after(async () => {
    await repository.cleanup();
    await rm(packingRoot, { recursive: true, force: true });
    await rm(installationRoot, { recursive: true, force: true });
  });

  const packInvocation = npmInvocation([
    'pack',
    '--dry-run=false',
    '--json',
    '--pack-destination',
    packingRoot,
  ]);
  const packed = await runProcess(packInvocation.command, packInvocation.args, {
    cwd: projectRoot,
    timeoutMs: 45_000,
  });
  assert.equal(packed.exitCode, 0, packed.stderr || packed.stdout);
  const manifest = (JSON.parse(packed.stdout) as PackManifest[])[0];
  assert.ok(manifest);
  const archive = join(installationRoot, manifest.filename);
  await copyFile(join(packingRoot, manifest.filename), archive);

  const installInvocation = npmInvocation([
    'install',
    '--dry-run=false',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    './' + manifest.filename,
  ]);
  const installed = await runProcess(installInvocation.command, installInvocation.args, {
    cwd: installationRoot,
    timeoutMs: 45_000,
  });
  assert.equal(installed.exitCode, 0, installed.stderr || installed.stdout);
  const installedPackage = join(installationRoot, 'node_modules', 'graphkeeper');
  const cli = join(installedPackage, 'dist', 'src', 'cli.js');
  await access(cli);
  await access(join(installationRoot, 'node_modules', '.bin', process.platform === 'win32'
    ? 'graphkeeper.cmd'
    : 'graphkeeper'));

  const runCli = (args: readonly string[], timeoutMs = 30_000) => runProcess(
    process.execPath,
    [cli, ...args],
    { cwd: repository.root, env: supportedEnvironment(), timeoutMs },
  );
  const help = await runCli(['--help']);
  assert.equal(help.exitCode, 0, help.stderr);
  assert.match(help.stdout, /graphkeeper update/);
  const version = await runCli(['--version']);
  assert.equal(version.exitCode, 0, version.stderr);
  assert.equal(version.stdout, '0.3.0\n');
  const initialized = await runCli(['init']);
  assert.equal(initialized.exitCode, 0, initialized.stderr);
  assert.match(initialized.stdout, /CREATE graph\/entities\.json/);

  await cp(join(installedPackage, 'examples', 'worked-example', 'graph'), join(repository.root, 'graph'), {
    recursive: true,
    force: true,
  });
  await cp(join(installedPackage, 'examples', 'worked-example', 'evidence'), join(repository.root, 'evidence'), {
    recursive: true,
    force: true,
  });

  const checked = await runCli(['check']);
  assert.equal(checked.exitCode, 0, checked.stderr);
  assert.match(checked.stdout, /validation passed/);
  const queried = await runCli(['query', 'test_payments_flaky']);
  assert.equal(queried.exitCode, 0, queried.stderr);
  assert.match(queried.stdout, /Claim: claim_22222222/);
  assert.doesNotMatch(queried.stdout, /Claim: claim_11111111/);
  const diagnosed = await runCli(['doctor'], 45_000);
  assert.equal(diagnosed.exitCode, 0, diagnosed.stderr);
  assert.match(diagnosed.stdout, /Summary: 0 error\(s\), 0 warning\(s\)/);
});
