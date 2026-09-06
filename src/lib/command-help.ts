export interface CommandHelpOption {
  readonly name: string;
  readonly value: string;
  readonly description: string;
}

export interface CommandHelpOptionGroup {
  readonly heading: string;
  readonly options: readonly CommandHelpOption[];
}

export interface CommandHelpExample {
  readonly label: string;
  readonly command: string;
}

export interface CommandHelpTopic {
  readonly path: readonly string[];
  readonly summary: string;
  readonly usage: readonly string[];
  readonly details: readonly string[];
  readonly optionGroups: readonly CommandHelpOptionGroup[];
  readonly examples: readonly CommandHelpExample[];
}

function isHelpToken(argument: string): boolean {
  return argument === '--help' || argument === '-h';
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && left.every((part, index) => part === right[index]);
}

/**
 * Resolve help only for an exact registered leading command path. Once the path is
 * recognized, an explicit help token takes precedence over any trailing options so
 * help remains informational and never reaches command validation.
 */
export function resolveContextualHelp(
  argv: readonly string[],
  topics: readonly CommandHelpTopic[],
): CommandHelpTopic | undefined {
  if (!argv.some(isHelpToken)) return undefined;

  const firstOption = argv.findIndex((argument) => argument.startsWith('-'));
  const path = argv.slice(0, firstOption === -1 ? argv.length : firstOption);
  return topics.find((topic) => samePath(topic.path, path));
}

function optionSyntax(option: CommandHelpOption): string {
  return '--' + option.name + ' <' + option.value + '>';
}

/** Render stable plain text without reading process or repository state. */
export function renderCommandHelp(topic: CommandHelpTopic): string {
  const lines = [
    'GraphKeeper ' + topic.path.join(' '),
    '',
    topic.summary,
    '',
    'Usage:',
    ...topic.usage.map((usage) => '  ' + usage),
  ];

  if (topic.details.length > 0) {
    lines.push('', 'Commands:', ...topic.details.map((detail) => '  ' + detail));
  }

  for (const group of topic.optionGroups) {
    const width = Math.max(...group.options.map((option) => optionSyntax(option).length));
    lines.push('', group.heading + ':');
    for (const option of group.options) {
      lines.push('  ' + optionSyntax(option).padEnd(width) + '  ' + option.description);
    }
  }

  if (topic.examples.length > 0) {
    lines.push('', 'Examples:');
    for (const example of topic.examples) {
      lines.push('  ' + example.label + ':');
      lines.push(...example.command.split('\n').map((line) => '    ' + line));
    }
  }

  return lines.join('\n');
}
