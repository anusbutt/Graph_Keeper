import { readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

async function collectTests(path) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTests(child));
    } else if (
      entry.isFile()
      && (entry.name.endsWith('.test.js') || entry.name.endsWith('.bench.js'))
    ) {
      files.push(child);
    }
  }
  return files;
}

const roots = process.argv.length > 2
  ? process.argv.slice(2).map((path) => resolve(path))
  : [resolve('dist/tests')];
const files = (await Promise.all(roots.map(collectTests))).flat().sort();
const isPerformanceTest = (file) => file.endsWith('.bench.js')
  || file.includes(sep + 'performance' + sep);
const benchmarks = files.filter(isPerformanceTest);
const tests = files.filter((file) => !isPerformanceTest(file));

function run(filesToRun, extraArgs = []) {
  if (filesToRun.length === 0) return 0;
  const result = spawnSync(process.execPath, ['--test', ...extraArgs, ...filesToRun], {
    stdio: 'inherit',
    windowsHide: true,
  });
  return result.status ?? 1;
}

if (files.length === 0) {
  process.stdout.write('No compiled test files found.\n');
  process.exitCode = 0;
} else {
  const testStatus = run(tests);
  process.exitCode = testStatus === 0
    ? run(benchmarks, ['--test-concurrency=1'])
    : testStatus;
}
