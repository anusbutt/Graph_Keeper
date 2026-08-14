export interface PackManifest {
  readonly filename: string;
  readonly files?: ReadonlyArray<{ readonly path: string; readonly mode: number }>;
}

export function parsePackManifest(output: string): PackManifest {
  const parsed: unknown = JSON.parse(output);
  const candidates = Array.isArray(parsed)
    ? parsed
    : parsed !== null && typeof parsed === 'object'
      ? Object.values(parsed)
      : [];
  if (candidates.length !== 1) {
    throw new TypeError('npm pack must return exactly one manifest');
  }
  const manifest = candidates[0];
  if (
    manifest === null
    || typeof manifest !== 'object'
    || typeof (manifest as { readonly filename?: unknown }).filename !== 'string'
  ) {
    throw new TypeError('npm pack must return one manifest with a filename');
  }
  return manifest as PackManifest;
}
