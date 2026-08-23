#!/usr/bin/env node
// Reads the saved Swagger JSON specs and prints a compact path/operation index.
// Use after `node scripts/fetch-swagger.mjs`.
//
// Usage:
//   node scripts/index-swagger.mjs                            # all specs, summary table
//   node scripts/index-swagger.mjs oms-orders                 # just one spec
//   node scripts/index-swagger.mjs oms-orders --details       # path + operation + parameters + 200 schema name

import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const dir = path.resolve(here, '../docs/swagger');
const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json'));
const wantSpec = process.argv[2];
const showDetails = process.argv.includes('--details');

for (const f of files) {
  const name = f.replace('.json', '');
  if (wantSpec && name !== wantSpec) continue;
  const json = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
  const paths = json.paths ?? {};
  const ops = [];
  for (const [p, methods] of Object.entries(paths)) {
    for (const [m, op] of Object.entries(methods)) {
      if (typeof op !== 'object' || !op) continue;
      const params = (op.parameters ?? []).map(pa => `${pa.in}:${pa.name}${pa.required ? '*' : ''}`);
      const schema200 = op.responses?.['200']?.schema?.$ref || op.responses?.['200']?.schema?.type || '';
      ops.push({ p, m: m.toUpperCase(), summary: op.summary || '', params, schema200 });
    }
  }
  console.log(`\n=== ${name}  (${ops.length} operations) ===`);
  if (showDetails) {
    for (const op of ops) {
      console.log(`${op.m.padEnd(6)} ${op.p}`);
      if (op.summary) console.log(`       summary: ${op.summary}`);
      if (op.params.length) console.log(`       params: ${op.params.join(', ')}`);
      if (op.schema200) console.log(`       200: ${op.schema200}`);
    }
  } else {
    for (const op of ops) {
      console.log(`${op.m.padEnd(6)} ${op.p}${op.summary ? '  — ' + op.summary : ''}`);
    }
  }
}
