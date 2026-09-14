#!/usr/bin/env node
// Quality gates for the Material rewrite. Exit 1 on any failure. Usage: node scripts/check-gates.mjs [--list-unused-i18n]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const appDir = path.join(root, 'src/app');
const failures = [];
const fail = msg => failures.push(msg);

const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const tsFiles = walk(appDir).filter(f => f.endsWith('.ts') && !f.includes(`${path.sep}generated${path.sep}`));
const srcFiles = tsFiles.filter(f => !f.endsWith('translation-keys.ts'));

// 1. Grep gates
const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F2FF}]/u;
const banned = [
  { re: /\bngModel\b/, label: 'ngModel' },
  { re: /(^|[^.\w])confirm\(/, label: 'native confirm(' },
  { re: /(^|[^.\w])alert\(/, label: 'native alert(' },
  { re: /api-client\.service/, label: 'legacy ApiClient import' },
  { re: /\bautofocus\b/, label: 'autofocus attribute' }
];
for (const f of srcFiles) {
  const text = fs.readFileSync(f, 'utf8');
  const rel = path.relative(root, f);
  if (emoji.test(text)) fail(`${rel}: contains an emoji`);
  for (const b of banned) if (b.re.test(text) && !f.endsWith('.spec.ts')) fail(`${rel}: ${b.label}`);
}
if (fs.existsSync(path.join(root, 'src/styles/_legacy.scss'))) fail('src/styles/_legacy.scss still exists');
if (/legacy/.test(fs.readFileSync(path.join(root, 'src/styles.scss'), 'utf8'))) fail('src/styles.scss still imports the legacy stylesheet');

// 2. i18n gates
const dict = lang => JSON.parse(fs.readFileSync(path.join(root, `public/assets/i18n/${lang}.json`), 'utf8'));
const en = dict('en'), de = dict('de');
const enKeys = Object.keys(en), deKeys = Object.keys(de);
if (JSON.stringify(enKeys) !== JSON.stringify([...enKeys].sort())) fail('en.json keys are not sorted');
if (JSON.stringify(deKeys) !== JSON.stringify([...deKeys].sort())) fail('de.json keys are not sorted');
if (JSON.stringify(enKeys) !== JSON.stringify(deKeys)) fail('en.json and de.json key sets differ');
for (const [k, v] of Object.entries(en)) if (typeof v !== 'string' || !v.trim()) fail(`en.json: empty value for ${k}`);
for (const [k, v] of Object.entries(de)) if (typeof v !== 'string' || !v.trim()) fail(`de.json: empty value for ${k}`);
for (const [k, v] of [...Object.entries(en), ...Object.entries(de)]) if (emoji.test(v)) fail(`i18n value for ${k} contains an emoji`);

const DYNAMIC_PREFIXES = ['sex.', 'event.', 'rel.', 'admin.confirm.'];
const src = srcFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const unused = enKeys.filter(k =>
  !DYNAMIC_PREFIXES.some(p => k.startsWith(p)) &&
  !src.includes(`'${k}'`) && !src.includes(`"${k}"`) && !src.includes('`' + k + '`'));
if (process.argv.includes('--list-unused-i18n')) console.log(unused.join('\n'));
if (unused.length) fail(`${unused.length} unused i18n key(s): ${unused.slice(0, 8).join(', ')}${unused.length > 8 ? ', …' : ''} (run with --list-unused-i18n)`);

if (failures.length) { console.error(failures.map(f => `GATE FAIL: ${f}`).join('\n')); process.exit(1); }
console.log(`gates ok: ${srcFiles.length} source files, ${enKeys.length} i18n keys`);
