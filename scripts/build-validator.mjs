import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(projectRoot, 'scripts', 'validate.mjs');

async function bundledValidator() {
  const result = await build({
    absWorkingDir: projectRoot,
    entryPoints: ['src/validator.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: ['node18'],
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'silent',
    sourcemap: false,
    treeShaking: true,
    write: false,
    banner: { js: '#!/usr/bin/env node' },
  });
  const output = result.outputFiles?.[0];
  if (output === undefined) throw new Error('validator build produced no output');
  return output.text.replaceAll('\r\n', '\n');
}

const mode = process.argv[2];
if (mode !== undefined && mode !== '--check') {
  process.stderr.write('Usage: node scripts/build-validator.mjs [--check]\n');
  process.exitCode = 2;
} else {
  const generated = await bundledValidator();
  if (mode === '--check') {
    let committed;
    try {
      committed = await readFile(target, 'utf8');
    } catch {
      committed = '';
    }
    if (committed.replaceAll('\r\n', '\n') !== generated) {
      process.stderr.write('scripts/validate.mjs is stale; run npm run validator:build\n');
      process.exitCode = 1;
    }
  } else {
    await writeFile(target, generated, 'utf8');
    process.stdout.write('generated scripts/validate.mjs\n');
  }
}
