// @quad/config — environment shape + lightweight validator (T5 skeleton).
// NO process.env reads here and NO secrets/values — only the key list, the typed shape, and a
// non-validating presence-check stub that takes an EXPLICIT record. Real validation (e.g. a
// schema validator) + secrets handling land later (see docs/DEPLOYMENT.md §10, SECURITY.md).

/** Canonical environment variable keys (categories mirror .env.example). */
export const ENV_KEYS = [
  'NODE_ENV',
  'WEB_BASE_URL',
  'API_BASE_URL',
  'API_PROXY_ORIGIN',
  'DATABASE_URL',
  'REDIS_URL',
  'AUTH_SECRET',
  'SESSION_COOKIE_NAME',
  'CSRF_SECRET',
  'EMAIL_PROVIDER',
  'EMAIL_API_KEY',
  'EMAIL_FROM',
  'OBJECT_STORAGE_ENDPOINT',
  'OBJECT_STORAGE_BUCKET',
  'OBJECT_STORAGE_ACCESS_KEY',
  'OBJECT_STORAGE_SECRET_KEY',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'LOG_LEVEL',
  'ALLOWED_ORIGINS',
  'QUAD_TENANT_HOSTS',
] as const;

export type EnvKey = (typeof ENV_KEYS)[number];

/** The expected (string-valued) environment shape. Parsing/coercion is deferred. */
export type EnvShape = {
  readonly [K in EnvKey]?: string;
};

/** Keys that must be present for the app to boot (placeholder set; finalized at impl). */
export const REQUIRED_ENV_KEYS: readonly EnvKey[] = [
  'DATABASE_URL',
  'REDIS_URL',
  'AUTH_SECRET',
];

export interface EnvValidationResult {
  readonly ok: boolean;
  readonly missing: readonly EnvKey[];
}

/**
 * Lightweight, NON-validating presence check over an EXPLICIT record (no `process.env` read,
 * no value/secret inspection). A real validator replaces this at implementation.
 */
export function validateEnv(input: Readonly<Record<string, string | undefined>>): EnvValidationResult {
  const missing = REQUIRED_ENV_KEYS.filter((k) => {
    const v = input[k];
    return v === undefined || v === '';
  });
  return { ok: missing.length === 0, missing };
}
