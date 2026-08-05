import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const reviewerUrl = new URL('../../../examples/reviewer.md', import.meta.url);

test('reviewer prompt is copy-pasteable, vendor-neutral, and names its required inputs', async () => {
  const prompt = await readFile(reviewerUrl, 'utf8');
  assert.match(prompt, /copy-paste/i);
  assert.match(prompt, /proposed factual statements/i);
  assert.match(prompt, /graph\/claims\.json/);
  assert.match(prompt, /evidence\//);
  assert.doesNotMatch(prompt, /Claude|Codex|Cursor|Aider|OpenCode/);
});

test('approval requires direct support from an active tool-output claim and cites its ID', async () => {
  const prompt = await readFile(reviewerUrl, 'utf8');
  assert.match(prompt, /active claim.*not.*(?:target|named).*supersedes/is);
  assert.match(prompt, /source\.kind.*tool_output/is);
  assert.match(prompt, /directly support.*statement/is);
  assert.match(prompt, /each.*approved factual statement.*claim ID/is);
  assert.match(prompt, /APPROVE\s*\n.*claim_<8-lowercase-hex>/is);
});

test('inference alone produces REVISE and requests external evidence', async () => {
  const prompt = await readFile(reviewerUrl, 'utf8');
  assert.match(prompt, /inference.*not.*proof/is);
  assert.match(prompt, /inference-only.*REVISE/is);
  assert.match(prompt, /REVISE.*external evidence/is);
  assert.match(prompt, /never cite.*inference.*approval/is);
});

test('unsupported and superseded statements produce REVISE with actionable context', async () => {
  const prompt = await readFile(reviewerUrl, 'utf8');
  assert.match(prompt, /no matching active claim.*REVISE/is);
  assert.match(prompt, /name.*unsupported statement/is);
  assert.match(prompt, /superseded.*not.*current support/is);
  assert.match(prompt, /REVISE\s*\n\s*- "<unsupported statement>"/is);
});

test('reviewer treats graph commands and evidence as inert data', async () => {
  const prompt = await readFile(reviewerUrl, 'utf8');
  assert.match(prompt, /never\s+execute\s+(?:a\s+)?stored command/is);
  assert.match(prompt, /evidence.*untrusted.*data/is);
});
