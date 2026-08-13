import type { InitEnvironment } from '../../src/commands/init.js';
import type { ProcessResult } from '../../src/lib/process.js';

export function successfulProbe(command: string): ProcessResult {
  return {
    exitCode: 0,
    stdout: command === 'git' ? 'git version 2.50.0\n' : '',
    stderr: '',
  };
}

export function supportedInitEnvironment(): InitEnvironment {
  return {
    platform: 'linux',
    nodeVersion: '18.20.0',
    env: process.env,
    probe: async (command) => successfulProbe(command),
  };
}
