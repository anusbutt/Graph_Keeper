import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const runtimeRoot = join(projectRoot, 'src');
const forbiddenModule = /(^|[\\/_.-])(telemetry|server|database|sqlite|postgres|auth|dashboard|vector(?:-?search)?|multi(?:-?(?:repository|repo)))([\\/_.-]|$)/i;
const forbiddenNetworkImport = /(?:from\s+|import\s*\()['"]node:(?:http|https|http2|net|tls)['"]/;

async function runtimeFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await runtimeFiles(path));
    if (entry.isFile() && entry.name.endsWith('.ts')) files.push(path);
  }
  return files;
}

test('v1 runtime stays local, single-repository, and free of excluded product modules', async () => {
  const files = await runtimeFiles(runtimeRoot);
  assert.ok(files.length > 0, 'runtime source must be present');
  for (const file of files) {
    const runtimePath = relative(runtimeRoot, file).replaceAll('\\', '/');
    assert.doesNotMatch(runtimePath, forbiddenModule, 'out-of-scope runtime module: ' + runtimePath);
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, forbiddenNetworkImport, 'v1 runtime must not open a server or network socket: ' + runtimePath);
    for (const match of source.matchAll(/(?:from\s+|import\s*\()['"]([^'"]+)['"]/g)) {
      assert.doesNotMatch(match[1] ?? '', forbiddenModule, 'out-of-scope runtime import in ' + runtimePath);
    }
  }

  const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8')) as {
    readonly dependencies?: Readonly<Record<string, string>>;
  };
  const runtimeDependencies = Object.keys(packageJson.dependencies ?? {});
  assert.deepEqual(runtimeDependencies, [], 'v1 must keep zero runtime dependencies');
});
