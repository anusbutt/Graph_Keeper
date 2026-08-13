import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schemaUrl = new URL('../../../templates/graph/SCHEMA.md', import.meta.url);

test('documents every claim and entity field with type, requirement, and enforcement', async () => {
  const schema = await readFile(schemaUrl, 'utf8');
  for (const field of [
    'id',
    'subject',
    'predicate',
    'object',
    'confidence',
    'source',
    'produced_by',
    'supersedes',
    'created',
  ]) {
    assert.match(schema, new RegExp('^\\| ' + field + ' \\|', 'm'), 'missing claim field ' + field);
  }
  for (const field of ['id', 'type', 'aliases', 'source_docs', 'first_seen']) {
    assert.match(
      schema,
      new RegExp('^\\| ' + field + ' \\|', 'm'),
      'missing entity field ' + field,
    );
  }
  assert.match(schema, /\| Enforcement \|/);
  assert.match(schema, /\[HOOK\]/);
  assert.match(schema, /\[DOCTOR\]/);
  assert.match(schema, /\[GUIDANCE\]/);
});

test('documents exact source variants, IDs, timestamps, flat objects, and evidence refs', async () => {
  const schema = await readFile(schemaUrl, 'utf8');
  assert.match(schema, /claim_\[0-9a-f\]\{8\}/);
  assert.match(schema, /YYYY-MM-DDTHH:MM:SSZ/);
  assert.match(schema, /tool_output.*kind.*command.*exit_code.*ref.*captured/is);
  assert.match(schema, /inference.*kind.*basis/is);
  assert.match(schema, /inference.*(?:must not|has no).*command.*exit_code.*ref/is);
  assert.match(schema, /object.*plain string/is);
  assert.match(schema, /structured detail.*evidence/is);
  assert.match(schema, /evidence\/.*#L.*-L/is);
  assert.match(schema, /empty.*\.\..*segment/is);
});

test('distinguishes fast hook checks, deep doctor checks, and behavioral guidance', async () => {
  const schema = await readFile(schemaUrl, 'utf8');
  assert.match(schema, /\[HOOK\].*reference shape/is);
  assert.match(schema, /\[DOCTOR\].*file.*exist.*line range/is);
  assert.match(schema, /\[GUIDANCE\].*short.*canonical/is);
  assert.match(schema, /unknown fields.*reject/is);
  assert.match(schema, /duplicate JSON object keys.*DOCTOR/is);
});

test('documents atomic claims, grounded source selection, and confidence boundaries', async () => {
  const schema = await readFile(schemaUrl, 'utf8');
  assert.match(schema, /^### Claim granularity and grounding$/m);
  assert.match(schema, /one independently changeable fact/is);
  assert.match(schema, /write multiple claims/is);
  assert.match(schema, /tool-output claim.*cited evidence lines directly/is);
  assert.match(schema, /observation.*tool output.*conclusion.*inference.*basis/is);
  assert.match(schema, /confidence: 1.*directly evidenced.*non-inference.*exact claim/is);
  assert.match(schema, /inference source contains exactly kind and basis/is);
  assert.match(schema, /inference claim must not use.*confidence: 1/is);
});

test('includes coherent examples for entity, run, tool output, and inference', async () => {
  const schema = await readFile(schemaUrl, 'utf8');
  assert.match(schema, /Example entity/);
  assert.match(schema, /Example run/);
  assert.match(schema, /Example tool-output claim/);
  assert.match(schema, /Example inference claim/);
  assert.match(schema, /claim_0a1b2c3d/);
  assert.match(schema, /run_2026-07-21-triage_a1/);
});

test('includes canonical open, closed, verdict, and evidence-provenance examples', async () => {
  const schema = await readFile(schemaUrl, 'utf8');
  for (const heading of [
    'Example open run',
    'Example closed run',
    'Allowed verdicts',
    'Evidence provenance',
  ]) {
    assert.match(schema, new RegExp('^### ' + heading + '$', 'm'));
  }
  assert.match(schema, /open run.*omit.*ended.*verdict/is);
  assert.match(schema, /closed run.*immutable/is);
  for (const verdict of ['passed', 'failed', 'inconclusive', 'aborted']) {
    assert.match(schema, new RegExp('`' + verdict + '`'));
  }
  assert.match(schema, /source\.ref.*run.*evidence/is);
  assert.match(schema, /overlap.*valid/is);
  assert.match(schema, /reproduce source\.ref exactly.*repository-relative/is);
  assert.match(schema, /do not replace it with an.*absolute host path/is);
  assert.match(schema, /verdict describes.*producing run.*stated task/is);
  assert.match(schema, /passed.*test-discovery run.*does not mean.*test suite passed/is);
});
