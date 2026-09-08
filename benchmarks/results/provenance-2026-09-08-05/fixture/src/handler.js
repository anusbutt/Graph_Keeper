import { validateInput } from './validation.js';
import { processInput } from './processor.js';

export function handleRequest(request) {
  const input = validateInput(request.body);
  return processInput(input);
}
