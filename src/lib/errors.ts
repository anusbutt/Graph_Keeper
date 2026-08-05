export const EXIT_CODES = {
  success: 0,
  validation: 1,
  usage: 2,
  prerequisite: 3,
  operational: 4,
  internal: 5,
} as const;

export type ErrorKind = keyof typeof EXIT_CODES;
export type ExitCode = (typeof EXIT_CODES)[ErrorKind];
export type DiagnosticCode = string;

export interface CommandResult {
  readonly exitCode: ExitCode;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
}

export class GraphKeeperError extends Error {
  readonly code: DiagnosticCode;
  readonly kind: ErrorKind;
  readonly exitCode: ExitCode;
  readonly context?: string;

  constructor(code: DiagnosticCode, kind: ErrorKind, message: string, context?: string) {
    super(message);
    this.name = 'GraphKeeperError';
    this.code = code;
    this.kind = kind;
    this.exitCode = EXIT_CODES[kind];
    if (context !== undefined) this.context = context;
  }
}

export function diagnostic(code: DiagnosticCode, message: string, context?: string): string {
  if (!/^GK[0-9]{3}$/.test(code)) throw new TypeError('Invalid GK diagnostic code: ' + code);
  return context === undefined ? code + ' ' + message : code + ' [' + context + '] ' + message;
}

export function failureResult(error: GraphKeeperError): CommandResult {
  return {
    exitCode: error.exitCode,
    stdout: [],
    stderr: [diagnostic(error.code, error.message, error.context)],
  };
}
