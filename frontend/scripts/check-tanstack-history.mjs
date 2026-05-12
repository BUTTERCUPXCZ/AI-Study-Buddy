#!/usr/bin/env node
// S14 — guard against accidentally pulling a known-malicious build of
// @tanstack/history. We allowlist advisory GHSA-rmmr-r34h-pfm5 in
// audit-ci.jsonc because the *specific* malicious versions were 1.161.9
// and 1.161.12 and they're unpublished — but the allowlist is broad
// (entire advisory ID), so this guard is the narrow check that prevents
// a future install or lockfile update from silently pulling one of them.
//
// Run after `npm ci` in CI. Exits non-zero on a match.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KNOWN_MALICIOUS = new Set(['1.161.9', '1.161.12']);

const here = dirname(fileURLToPath(import.meta.url));
const lockPath = join(here, '..', 'package-lock.json');

let lock;
try {
  lock = JSON.parse(readFileSync(lockPath, 'utf8'));
} catch (err) {
  console.error(`Could not read ${lockPath}:`, err.message);
  process.exit(2);
}

const offenders = [];
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (!path.endsWith('node_modules/@tanstack/history')) continue;
  const v = entry?.version;
  if (v && KNOWN_MALICIOUS.has(v)) {
    offenders.push({ path, version: v });
  }
}

if (offenders.length > 0) {
  console.error(
    '[31m[FATAL][0m @tanstack/history resolved to a known-malicious version:',
  );
  for (const o of offenders) console.error(`  - ${o.path}@${o.version}`);
  console.error(
    'Remove the lockfile entry / pin to a clean version before merging.',
  );
  process.exit(1);
}

console.log('@tanstack/history check: no known-malicious version installed.');
