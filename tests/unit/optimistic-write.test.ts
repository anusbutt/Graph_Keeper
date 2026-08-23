import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { createRepositoryFixture } from '../helpers/repository.js';
import { mutateJsonArrayFile } from '../../src/lib/optimistic-write.js';

async function readIds(root: string): Promise<unknown> {
  const raw = await readFile(join(root, 'graph', 'claims.json'), 'utf8');
  return JSON.parse(raw) as unknown;
}

test('mutateJsonArrayFile reads, mutates, and atomically persists a JSON array', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    await fixture.writeJson('graph/claims.json', []);
    await mutateJsonArrayFile(fixture.root, 'graph/claims.json', (records) => {
      records.push({ id: 'claim_11111111' });
    });
    const onDisk = await readIds(fixture.root);
    assert.deepEqual(onDisk, [{ id: 'claim_11111111' }]);
    assert.match(await readFile(join(fixture.root, 'graph', 'claims.json'), 'utf8'), /\n$/);
  } finally {
    await fixture.cleanup();
  }
});

test('two sequential appends both persist', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    await mkJson(fixture.root);
    await mutateJsonArrayFile(fixture.root, 'graph/claims.json', (r) => { r.push({ id: 'a' }); });
    await mutateJsonArrayFile(fixture.root, 'graph/claims.json', (r) => { r.push({ id: 'b' }); });
    const onDisk = (await readIds(fixture.root)) as Array<{ id: string }>;
    assert.deepEqual(onDisk.map((r) => r.id), ['a', 'b']);
  } finally {
    await fixture.cleanup();
  }
});

test('two concurrent appends to the same file lose no records (race regression)', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    await mkJson(fixture.root);
    await Promise.all([
      mutateJsonArrayFile(fixture.root, 'graph/claims.json', (r) => { r.push({ id: 'claim_aaaa000001' }); }),
      mutateJsonArrayFile(fixture.root, 'graph/claims.json', (r) => { r.push({ id: 'claim_bbbb000002' }); }),
    ]);
    const onDisk = (await readIds(fixture.root)) as Array<{ id: string }>;
    const ids = onDisk.map((r) => r.id);
    assert.ok(ids.includes('claim_aaaa000001'), 'first append lost');
    assert.ok(ids.includes('claim_bbbb000002'), 'second append lost');
    assert.equal(ids.length, 2);
  } finally {
    await fixture.cleanup();
  }
});

test('retries and succeeds when the file changes concurrently between attempts', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    const target = join(fixture.root, 'graph', 'claims.json');
    await mkJson(fixture.root);
    let injected = false;
    await mutateJsonArrayFile(fixture.root, 'graph/claims.json', (r) => {
      if (!injected) {
        injected = true;
        void writeFile(target, JSON.stringify([{ id: 'other' }]) + '\n', 'utf8');
      }
      r.push({ id: 'mine' });
    });
    const onDisk = (await readIds(fixture.root)) as Array<{ id: string }>;
    assert.ok(onDisk.some((rec) => rec.id === 'other'), 'concurrent write not retained');
    assert.ok(onDisk.some((rec) => rec.id === 'mine'), 'our append lost on retry');
  } finally {
    await fixture.cleanup();
  }
});

test('fails loudly when the file keeps changing beyond the max attempts', async () => {
  const fixture = await createRepositoryFixture(false);
  try {
    const target = join(fixture.root, 'graph', 'claims.json');
    await mkJson(fixture.root);
    let counter = 0;
    await assert.rejects(
      mutateJsonArrayFile(fixture.root, 'graph/claims.json', (r) => {
        counter += 1;
        void writeFile(target, JSON.stringify([counter]) + '\n', 'utf8');
        r.push({ id: 'mine' });
      }, { maxAttempts: 3 }),
      (error: unknown) =>
        error instanceof Error
        && /did not stabilize|concurrent/i.test(error.message)
        && /nothing was written/i.test(error.message),
    );
    assert.equal(counter, 3, 'must stop after max attempts');
    const onDisk = (await readIds(fixture.root)) as Array<{ id: string }>;
    assert.ok(
      !onDisk.some((rec) => rec.id === 'mine'),
      'our append must not be persisted when we give up',
    );
  } finally {
    await fixture.cleanup();
  }
});

async function mkJson(root: string): Promise<void> {
  await mkdir(join(root, 'graph'), { recursive: true });
  await writeFile(join(root, 'graph', 'claims.json'), '[]\n', 'utf8');
}