export function validateInput(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new TypeError('Request body must be an object');
  }
  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    throw new TypeError('message must be a nonempty string');
  }
  return { message: body.message.trim() };
}
