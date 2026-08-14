import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const skillUrl = new URL('../../../templates/SKILL.md', import.meta.url);

test('has Codex-discoverable frontmatter with retrieval and recording triggers', async () => {
  const skill = await readFile(skillUrl, 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n/.exec(skill);
  assert.ok(match, 'skill must start with YAML frontmatter');
  const metadata = match[1]?.split('\n').filter(Boolean) ?? [];
  assert.deepEqual(metadata.map((line) => line.split(':', 1)[0]), ['name', 'description']);
  assert.equal(metadata[0], 'name: graphkeeper');
  assert.match(metadata[1] ?? '', /retrieve.*record.*durable.*evidence-backed.*repository/is);
});

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

test('teaches atomic claims, exact grounding, and bounded certainty', async () => {
  const skill = await readFile(skillUrl, 'utf8');
  assert.match(skill, /one independently changeable fact per claim/is);
  assert.match(skill, /split.*separate claims/is);
  assert.match(skill, /evidence lines directly support.*complete claim/is);
  assert.match(skill, /observation.*tool_output.*conclusion.*inference.*basis/is);
  assert.match(skill, /confidence 1.*directly evidenced.*non-inference.*exact claim/is);
  assert.match(skill, /lower confidence.*does not.*unsupported conclusion.*tool output/is);
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

test('requires retrieval-first investigation without blind trust', async () => {
  const skill = await readFile(skillUrl, 'utf8');
  assert.match(skill, /^## Retrieve before investigating$/m);
  assert.match(skill, /query relevant GraphKeeper memory before repeating.*investigation/is);
  assert.match(skill, /inspect active claims and their provenance first/is);
  assert.match(skill, /grounded claim directly addresses.*starting point/is);
  assert.match(skill, /evidence already\s+establishes the historical reasoning.*do not repeat/is);
  assert.match(skill, /limit freshness verification to current state.*relevant current files.*working-tree or HEAD changes.*contradictory evidence/is);
  assert.match(skill, /do not rerun git log, git blame, historical diffs, broad repository\s+searches, tests/is);
  assert.match(skill, /original investigation.*reconfirm evidence/is);
  assert.match(skill, /stop investigating and answer from the claim plus the\s+minimal freshness check/is);
  for (const exception of [
    'current state contradicts',
    'provenance is missing or insufficient',
    'inference-only',
    'stale, superseded, or ambiguous',
    'fresh independent verification',
  ]) {
    assert.match(skill, new RegExp(exception.replaceAll(' ', '\\s+'), 'i'));
  }
  assert.match(skill, /never treat retrieved memory as automatically true/is);
  assert.match(skill, /inspect its evidence\s+and provenance first/is);
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

test('teaches portable evidence citations and precise run-verdict reporting', async () => {
  const skill = await readFile(skillUrl, 'utf8');
  assert.match(skill, /^## Report retrieved memory$/m);
  assert.match(skill, /repository-relative source\.ref.*line range/is);
  assert.match(skill, /do not.*absolute host path/is);
  assert.match(skill, /verdict.*outcome.*producing run.*stated task/is);
  assert.match(skill, /passed.*does not imply.*test suite passed/is);
  assert.match(skill, /tool_output or inference/is);
});
