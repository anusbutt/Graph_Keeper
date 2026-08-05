import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const skillUrl = new URL('../../../templates/SKILL.md', import.meta.url);

test('defines the vendor-neutral write, correct, resolve-identity, and exclude workflow', async () => {
  const skill = await readFile(skillUrl, 'utf8');
  for (const heading of ['Write', 'Correct', 'Resolve identity', 'Exclude']) {
    assert.match(skill, new RegExp('^## ' + heading + '$', 'm'));
  }
  assert.doesNotMatch(skill, /Claude|Codex|Cursor|Aider|OpenCode/);
});

test('teaches honest tool-output and inference sourcing', async () => {
  const skill = await readFile(skillUrl, 'utf8');
  assert.match(skill, /capture.*evidence.*before.*claim/is);
  assert.match(skill, /tool_output.*command.*exit_code.*captured.*ref/is);
  assert.match(skill, /inference.*basis/is);
  assert.match(skill, /inference.*not.*proof/is);
  assert.match(skill, /never.*invent.*evidence/is);
});

test('teaches exact alias reuse, safe new identity, and append-only correction', async () => {
  const skill = await readFile(skillUrl, 'utf8');
  assert.match(skill, /canonical ID.*exact alias/is);
  assert.match(skill, /reuse.*entity/is);
  assert.match(skill, /ambiguous.*do not guess/is);
  assert.match(skill, /new.*human-readable.*snake_case/is);
  assert.match(skill, /supersedes/is);
  assert.match(skill, /never edit or delete.*committed/is);
});

test('keeps structured detail in evidence and excludes session chatter', async () => {
  const skill = await readFile(skillUrl, 'utf8');
  assert.match(skill, /structured detail.*evidence/is);
  assert.match(skill, /claim.*flat.*short/is);
  assert.match(skill, /session chatter/is);
  assert.match(skill, /abandoned hypothes/is);
  assert.match(skill, /dead end/is);
  assert.match(skill, /progress notes/is);
});

test('labels every normative bullet as HOOK, DOCTOR, or GUIDANCE', async () => {
  const skill = await readFile(skillUrl, 'utf8');
  const bullets = skill.split(/\r?\n/).filter((line) => line.startsWith('- '));
  assert.ok(bullets.length >= 15);
  for (const bullet of bullets) {
    assert.match(bullet, /^- \[(?:HOOK|DOCTOR|GUIDANCE)\]/, 'unlabelled rule: ' + bullet);
  }
});

test('teaches the complete run and evidence lifecycle including interruption and concurrency', async () => {
  const skill = await readFile(skillUrl, 'utf8');
  assert.match(skill, /^## Track a run$/m);
  assert.match(skill, /open.*empty.*evidence.*claims_written/is);
  assert.match(skill, /append.*evidence.*claim/is);
  assert.match(skill, /close.*ended.*verdict/is);
  assert.match(skill, /interrupted.*aborted.*inconclusive/is);
  assert.match(skill, /do not\s+invent.*claim/is);
  assert.match(skill, /committed evidence.*immutable/is);
  assert.match(skill, /concurrent.*unique run ID/is);
});
