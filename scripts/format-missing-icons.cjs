// Formats the missing icon list into a human-friendly Markdown table.
// Uses the same candidate generation logic as scripts/check-icons.cjs.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const effectsFile = path.join(root, 'data', 'effects.ts');
const iconsDir = path.join(root, 'public', 'icons');
const optimized48 = path.join(iconsDir, 'optimized', '48');
const optimized96 = path.join(iconsDir, 'optimized', '96');
const additionalFile = path.join(root, 'components', 'iconMappings.ts');

let ADDITIONAL_MAP = {};
if (fs.existsSync(additionalFile)) {
  const txt = fs.readFileSync(additionalFile, 'utf8');
  const objRegex = /export const ADDITIONAL_ICON_SYNONYMS:[\s\S]*?=\s*\{([\s\S]*?)\};/m;
  const m = objRegex.exec(txt);
  if (m) {
    const body = m[1];
    const lineRe = /['"]?([a-z0-9_\-\s]+)['"]?\s*:\s*['"]([^'"]+)['"]/gi;
    let r;
    while ((r = lineRe.exec(body))) {
      ADDITIONAL_MAP[r[1].trim().toLowerCase()] = r[2].trim();
    }
  }
}

function slug(s) { return String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, ''); }
function slugWithUnderscores(s) { return String(s || '').replace(/[^a-z0-9-_]/gi, '_').toLowerCase(); }

function buildCandidates(baseName) {
  const cleaned = String(baseName || '').trim();
  const candidates = [];
  if (!cleaned) return candidates;
  const lower = cleaned.toLowerCase();
  if (ADDITIONAL_MAP[lower]) candidates.push(ADDITIONAL_MAP[lower]);
  const SYN = {
    'bait_switch': 'baitandswitch',
    'stolen_valor': 'stolenvalor',
    'creative_accounting': 'creativeaccounting',
    'martial_law': 'martiallaw',
    'path_least_resistance': 'pathofleastresistance',
  };
  if (SYN[lower]) candidates.push(SYN[lower]);

  const underscoreSlug = slugWithUnderscores(cleaned);
  candidates.push(underscoreSlug);
  if (underscoreSlug.includes('_')) {
    candidates.push(underscoreSlug.replace(/_/g, '-'));
    candidates.push(underscoreSlug.replace(/_/g, ' '));
  }
  if (underscoreSlug.includes('-')) {
    candidates.push(underscoreSlug.replace(/-/g, '_'));
    candidates.push(underscoreSlug.replace(/-/g, ' '));
  }
  const baseForms = [cleaned, cleaned.replace(/\s+/g, '-'), cleaned.replace(/\s+/g, '_'), cleaned.replace(/\s+/g, '')];
  for (const f of baseForms) {
    const s = slug(f);
    if (!candidates.includes(s)) candidates.push(s);
  }
  const lowerSpaced = cleaned.toLowerCase();
  if (!candidates.includes(lowerSpaced)) candidates.push(lowerSpaced);
  for (const f of baseForms) if (!candidates.includes(f)) candidates.push(f);
  return candidates.filter(Boolean);
}

function existsAny(names) {
  for (const name of names) {
    const paths = [
      path.join(optimized48, `${name}.webp`),
      path.join(optimized96, `${name}.webp`),
      path.join(iconsDir, `${name}.png`),
      path.join(iconsDir, `${name}.svg`),
      path.join(iconsDir, 'categories', `${name}.png`),
      path.join(iconsDir, 'categories', `${name}.svg`),
    ];
    for (const p of paths) if (fs.existsSync(p)) return p;
  }
  return null;
}

function main() {
  if (!fs.existsSync(effectsFile)) {
    console.error('effects file not found:', effectsFile);
    process.exit(1);
  }
  const txt = fs.readFileSync(effectsFile, 'utf8');
  const ids = new Set();
  const regex = /id:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = regex.exec(txt))) ids.add(m[1]);
  const idList = Array.from(ids).sort();

  const missing = [];
  for (const id of idList) {
    const candidates = buildCandidates(id);
    const p = existsAny(candidates);
    if (!p) missing.push({ id, candidates: candidates.slice(0, 6) });
  }

  const lines = [];
  lines.push('# Missing Icons');
  lines.push('');
  lines.push('Effect ID | Suggested filenames (top candidates)');
  lines.push('--- | ---');
  for (const m of missing) {
    lines.push(`${m.id} | ${m.candidates.join(', ')}`);
  }
  const outPath = path.join(root, 'scripts', 'missing-icons-human.md');
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`Wrote ${missing.length} missing entries to ${outPath}`);
}

main();