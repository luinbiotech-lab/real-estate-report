// Shared source-level checks for the browser IndexedDB schema in src/repositories/database.ts.
//
// Why this exists: CI validators used to assert `DATABASE_VERSION = 13` as a substring. When the schema moved
// to v14 (9dadc4f, spatial media stores) every Validate run failed. A loose replacement regex is also unsafe:
// `/DATABASE_VERSION\s*=\s*(\d+)/` first matches `RISK_AGENT_FOUNDATION_DATABASE_VERSION = 8`, and mixing
// `!a && b || c` silently disables the version assertion. These helpers parse the exact exported constant and
// fail closed on anything ambiguous.

const EXPORT_PATTERN = /^export const DATABASE_VERSION = (\d+);\s*$/gm;

/** Returns the integer value of the single `export const DATABASE_VERSION = N;` line, or throws. */
export function parseDatabaseVersion(source) {
  const matches = [...String(source).matchAll(EXPORT_PATTERN)];
  if (matches.length !== 1) {
    throw new Error(`IndexedDB schema: expected exactly one "export const DATABASE_VERSION = <int>;" line, found ${matches.length}.`);
  }
  const version = Number(matches[0][1]);
  if (!Number.isSafeInteger(version) || version < 1) throw new Error(`IndexedDB schema: invalid DATABASE_VERSION ${matches[0][1]}.`);
  return version;
}

/**
 * Asserts the schema is at least `minVersion` and that every required store is declared in the upgrade path.
 * Forward versions are accepted on purpose: upgrade() creates missing stores idempotently, so a store introduced
 * at vN must still exist at vN+k. Returns the parsed version.
 */
export function assertIndexedDbSchema(source, { minVersion, requiredStores = [], context = 'IndexedDB schema' }) {
  if (!Number.isSafeInteger(minVersion) || minVersion < 1) throw new Error(`${context}: minVersion must be a positive integer.`);
  const version = parseDatabaseVersion(source);
  if (version < minVersion) throw new Error(`${context}: DATABASE_VERSION ${version} is below required minimum ${minVersion}.`);
  const missing = requiredStores.filter((name) => !String(source).includes(`'${name}'`));
  if (missing.length) throw new Error(`${context}: required object stores missing at v${version}: ${missing.join(', ')}.`);
  return version;
}
