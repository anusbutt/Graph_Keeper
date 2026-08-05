import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

test('release README covers onboarding, operation, recovery, limits, and future storage', async () => {
  const readme = await readFile(join(projectRoot, 'README.md'), 'utf8');
  for (const contract of [
    /grounded, auditable memory/i,
    /## Prerequisites/,
    /## Two-minute quickstart/,
    /## Before and after/,
    /graphkeeper init \[--force\]/,
    /graphkeeper check/,
    /graphkeeper query <subject>/,
    /graphkeeper doctor/,
    /Native PowerShell is not supported/i,
    /## Recovery and adoption/,
    /10,000 claims, 2,000 entities, and 1,000 runs/,
    /SQLite or PostgreSQL/,
  ]) assert.match(readme, contract);
});

test('release carries the MIT terms for GraphKeeper contributors', async () => {
  const license = await readFile(join(projectRoot, 'LICENSE'), 'utf8');
  assert.match(license, /^MIT License/);
  assert.match(license, /Copyright \(c\) 2026 GraphKeeper contributors/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
});
