#!/usr/bin/env node
/**
 * Headless dev login — prints a fresh Bearer token (and the resolved Maarg base URL)
 * to stdout, so you can hit Moqui endpoints with `curl` without booting the app.
 *
 * Reads credentials from .env.local (gitignored). Never logs the password.
 *
 * Usage:
 *   node scripts/dev-login.mjs                # prints JSON: { token, expiresAt, oms, maarg }
 *   node scripts/dev-login.mjs --token        # prints only the bare token (useful for piping)
 *   node scripts/dev-login.mjs --curl         # prints a ready-to-use curl prefix
 *   eval "$(node scripts/dev-login.mjs --shell)"   # exports TOKEN, OMS_URL, MAARG_URL into shell
 *
 * Example combined:
 *   TOKEN=$(node scripts/dev-login.mjs --token)
 *   curl -sH "Authorization: Bearer $TOKEN" "$(node scripts/dev-login.mjs --shell | grep MAARG_URL | cut -d= -f2-)oms/orders?pageSize=1" | jq
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const envPath = path.join(appRoot, '.env.local');

if (!fs.existsSync(envPath)) {
  fail(`No .env.local at ${envPath}. Copy .env.example to .env.local and fill in VITE_DEV_OMS / VITE_DEV_USERNAME / VITE_DEV_PASSWORD.`);
}

const env = parseDotenv(fs.readFileSync(envPath, 'utf8'));
const omsInput = env.VITE_DEV_OMS?.trim();
const username = env.VITE_DEV_USERNAME?.trim();
const password = env.VITE_DEV_PASSWORD; // do not trim — passwords may have intentional whitespace? still don't log

if (!omsInput) fail('VITE_DEV_OMS is empty in .env.local');
if (!username) fail('VITE_DEV_USERNAME is empty in .env.local');
if (!password) fail('VITE_DEV_PASSWORD is empty in .env.local');

const omsBase = expandOmsUrl(omsInput);
const loginUrl = `${omsBase}login`;

const body = new URLSearchParams({ USERNAME: username, PASSWORD: password }).toString();
// The accxui useAuth() composable posts JSON, but the underlying OFBiz endpoint also accepts form-urlencoded.
// We try JSON first (matches the app); fall back to form if the server returns 415.
let resp;
try {
  resp = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ USERNAME: username, PASSWORD: password }),
  });
  if (resp.status === 415 || resp.status === 400) {
    resp = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    });
  }
} catch (err) {
  fail(`Network error reaching ${loginUrl}: ${err.message}`);
}

const text = await resp.text();
let payload;
try { payload = JSON.parse(text); } catch { /* leave undefined */ }

if (!resp.ok || !payload?.token) {
  // Scrub any echoed password before reporting.
  const scrubbed = (text || '').replace(password, '***');
  fail(`Login failed (${resp.status} ${resp.statusText}): ${scrubbed.slice(0, 500)}`);
}

// Resolve Maarg URL via checkLoginOptions (same flow the app uses).
let maarg = '';
try {
  const r = await fetch(`${omsBase}checkLoginOptions`, {
    headers: { Authorization: `Bearer ${payload.token}`, Accept: 'application/json' },
  });
  if (r.ok) {
    const cfg = await r.json();
    if (cfg?.maargInstanceUrl) maarg = expandMaargUrl(cfg.maargInstanceUrl);
  }
} catch {
  // Maarg lookup is best-effort; the token alone is still useful.
}

const out = {
  token: payload.token,
  expiresAt: payload.expirationTime ?? null,
  oms: omsBase,
  maarg,
};

const mode = process.argv[2];
if (mode === '--token') {
  process.stdout.write(out.token);
} else if (mode === '--curl') {
  // Prints a curl prefix you can append a URL to.
  process.stdout.write(`curl -sH "Authorization: Bearer ${out.token}" -H "Content-Type: application/json" "${out.maarg || out.oms}"`);
} else if (mode === '--shell') {
  process.stdout.write(`export TOKEN='${out.token}'\nexport OMS_URL='${out.oms}'\nexport MAARG_URL='${out.maarg}'\n`);
} else {
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

// ---------- helpers ----------

function expandOmsUrl(value) {
  if (/^https?:\/\//.test(value)) {
    return value.endsWith('/api/') ? value : value.endsWith('/api') ? value + '/' : value.replace(/\/+$/, '') + '/api/';
  }
  return `https://${value}.hotwax.io/api/`;
}

function expandMaargUrl(value) {
  if (/^https?:\/\//.test(value)) {
    return value.includes('/rest/s1') ? (value.endsWith('/') ? value : value + '/') : value.replace(/\/+$/, '') + '/rest/s1/';
  }
  return `https://${value}.hotwax.io/rest/s1/`;
}

function parseDotenv(content) {
  const out = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function fail(msg) {
  process.stderr.write(`[dev-login] ${msg}\n`);
  process.exit(1);
}
