import assert from 'node:assert/strict';
import test from 'node:test';

import {
  renderCommandHelp,
  resolveContextualHelp,
  type CommandHelpTopic,
} from '../../src/lib/command-help.js';

const overview: CommandHelpTopic = {
  path: ['append'],
  summary: 'Append one supported record.',
  usage: ['graphkeeper append <record-type> [options]'],
  details: ['claim  Append a claim.', 'run    Create a run.'],
  examples: [],
  optionGroups: [],
};

const claim: CommandHelpTopic = {
  path: ['append', 'claim'],
  summary: 'Append one claim.',
  usage: ['graphkeeper append claim --subject <entity-id> [options]'],
  details: [],
  optionGroups: [{
    heading: 'Common required',
    options: [{
      name: 'subject',
      value: 'entity-id',
      description: 'Existing canonical entity ID.',
    }],
  }],
  examples: [{
    label: 'Inference',
    command: 'graphkeeper append claim --subject example --kind inference',
  }],
};

const topics = [overview, claim];

test('resolveContextualHelp selects only an exact registered leading command path', () => {
  assert.equal(resolveContextualHelp(['append', '--help'], topics), overview);
  assert.equal(resolveContextualHelp(['append', '-h'], topics), overview);
  assert.equal(resolveContextualHelp(['append', 'claim', '--help'], topics), claim);
  assert.equal(
    resolveContextualHelp(['append', 'claim', '--subject', 'x', '--help'], topics),
    claim,
  );
  assert.equal(resolveContextualHelp(['append', 'unknown', '--help'], topics), undefined);
  assert.equal(resolveContextualHelp(['append', 'claim'], topics), undefined);
  assert.equal(resolveContextualHelp(['append', 'claim', '--unknown', 'x'], topics), undefined);
});

test('renderCommandHelp renders ordered usage, details, options, and examples', () => {
  const output = renderCommandHelp(claim);

  assert.match(output, /^GraphKeeper append claim\n/);
  assert.match(output, /Append one claim\.\n\nUsage:\n  graphkeeper append claim/);
  assert.match(output, /Common required:\n  --subject <entity-id>  Existing canonical entity ID\./);
  assert.match(output, /Examples:\n  Inference:\n    graphkeeper append claim/);
  assert.equal(output.endsWith('\n'), false);
});

test('renderCommandHelp is deterministic and does not mutate topic definitions', () => {
  const before = structuredClone(claim);
  assert.equal(renderCommandHelp(claim), renderCommandHelp(claim));
  assert.deepEqual(claim, before);
});
