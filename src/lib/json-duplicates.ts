export interface DuplicateJsonKey {
  readonly path: string;
  readonly key: string;
}

export class JsonScanError extends Error {
  readonly offset: number;

  constructor(message: string, offset: number) {
    super('invalid JSON at offset ' + offset + ': ' + message);
    this.name = 'JsonScanError';
    this.offset = offset;
  }
}

class Scanner {
  private index = 0;
  private readonly duplicates: DuplicateJsonKey[] = [];

  constructor(private readonly text: string) {}

  scan(): DuplicateJsonKey[] {
    this.skipWhitespace();
    this.value('$');
    this.skipWhitespace();
    if (this.index !== this.text.length) this.fail('unexpected trailing content');
    return this.duplicates;
  }

  private fail(message: string): never {
    throw new JsonScanError(message, this.index);
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.text[this.index] ?? '') && this.index < this.text.length) this.index += 1;
  }

  private value(path: string): void {
    this.skipWhitespace();
    const token = this.text[this.index];
    if (token === '{') return this.object(path);
    if (token === '[') return this.array(path);
    if (token === '"') {
      this.string();
      return;
    }
    if (token === '-' || (token !== undefined && /[0-9]/.test(token))) return this.number();
    for (const literal of ['true', 'false', 'null']) {
      if (this.text.startsWith(literal, this.index)) {
        this.index += literal.length;
        return;
      }
    }
    this.fail('expected a JSON value');
  }

  private object(path: string): void {
    this.index += 1;
    this.skipWhitespace();
    const keys = new Set<string>();
    if (this.text[this.index] === '}') {
      this.index += 1;
      return;
    }
    while (true) {
      this.skipWhitespace();
      if (this.text[this.index] !== '"') this.fail('expected an object key');
      const key = this.string();
      if (keys.has(key)) this.duplicates.push({ path, key });
      keys.add(key);
      this.skipWhitespace();
      if (this.text[this.index] !== ':') this.fail('expected a colon');
      this.index += 1;
      this.value(path + '[' + JSON.stringify(key) + ']');
      this.skipWhitespace();
      const separator = this.text[this.index];
      if (separator === '}') {
        this.index += 1;
        return;
      }
      if (separator !== ',') this.fail('expected a comma or closing brace');
      this.index += 1;
    }
  }

  private array(path: string): void {
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === ']') {
      this.index += 1;
      return;
    }
    let item = 0;
    while (true) {
      this.value(path + '[' + item + ']');
      item += 1;
      this.skipWhitespace();
      const separator = this.text[this.index];
      if (separator === ']') {
        this.index += 1;
        return;
      }
      if (separator !== ',') this.fail('expected a comma or closing bracket');
      this.index += 1;
    }
  }

  private string(): string {
    const start = this.index;
    this.index += 1;
    while (this.index < this.text.length) {
      const character = this.text[this.index];
      if (character === '"') {
        this.index += 1;
        try {
          return JSON.parse(this.text.slice(start, this.index)) as string;
        } catch {
          this.fail('invalid string escape');
        }
      }
      if (character === '\\') {
        this.index += 2;
      } else {
        if (character !== undefined && character.charCodeAt(0) < 0x20) this.fail('unescaped control character');
        this.index += 1;
      }
    }
    this.fail('unterminated string');
  }

  private number(): void {
    const remaining = this.text.slice(this.index);
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(remaining);
    if (match === null) this.fail('invalid number');
    this.index += match[0].length;
  }
}

export function findDuplicateJsonKeys(text: string): DuplicateJsonKey[] {
  return new Scanner(text).scan();
}
