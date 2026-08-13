import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createValidatorFixture, runValidator } from '../helpers/validator.js';

const template = (relativePath: string): URL => new URL('../../../templates/' + relativePath, import.meta.url);

test('starter graph records are empty top-level arrays', async () => {
  for (const name of ['entities.json', 'claims.json', 'runs.json']) {
    const text = await readFile(template('graph/' + name), 'utf8');
    assert.deepEqual(JSON.parse(text), []);
    assert.match(text, /^\s*\[\s*\]\s*$/);
  }
});

test('starter graph records pass the canonical validator', async () => {
  const fixture = await createValidatorFixture();
  try {
    await fixture.writeGraph([], [], []);
    const result = await runValidator(fixture, '--worktree');
    assert.equal(result.exitCode, 0, result.stderr);
  } finally {
    await fixture.cleanup();
  }
});

test('baseline schema and agent guidance are useful and placeholder-free', async () => {
  const schema = await readFile(template('graph/SCHEMA.md'), 'utf8');
  const skill = await readFile(template('SKILL.md'), 'utf8');
  for (const document of [schema, skill]) {
    assert.doesNotMatch(document, /\b(?:TODO|TBD|PLACEHOLDER)\b/i);
  }
  assert.match(schema, /tool_output/);
  assert.match(schema, /inference/);
  assert.match(schema, /append-only/i);
  assert.match(skill, /evidence\//);
  assert.match(skill, /never execute/i);
  assert.match(skill, /^---\nname: graphkeeper\ndescription: .+\n---\n/);
});

test('pre-commit is a minimal rule-free Node launcher for staged validation', async () => {
  const hook = await readFile(template('pre-commit'), 'utf8');
  assert.match(hook, /^#!\/usr\/bin\/env node\n/);
  assert.match(hook, /GraphKeeper managed hook/);
  assert.match(hook, /spawnSync\('git', \['rev-parse', '--show-toplevel'\]/);
  assert.match(hook, /scripts.*validate\.mjs/);
  assert.match(hook, /process\.execPath.*--staged/s);
  assert.match(hook, /shell: false/);
  assert.match(hook, /import\('node:child_process'\)/);
  assert.doesNotMatch(hook, /^import /m);
  assert.doesNotMatch(hook, /validate\.sh|\bjq\b|spawnSync\('sh'/);
  assert.ok(hook.trim().split(/\r?\n/).length <= 45, 'hook should remain a minimal launcher');
});
