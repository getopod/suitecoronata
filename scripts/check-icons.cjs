const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const effectsFile = path.join(root, 'data', 'effects.ts');
const iconsDir = path.join(root, 'public', 'icons');
const optimized48 = path.join(iconsDir, 'optimized', '48');
const optimized96 = path.join(iconsDir, 'optimized', '96');

function slug(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
}
function slugWithUnderscores(s) {
  return String(s || '').replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
}

function buildCandidates(baseName) {
  const cleaned = String(baseName || '').trim();
  const candidates = [];
  if (!cleaned) return candidates;
  const lower = cleaned.toLowerCase();
  // synonyms - read from the component map if present in this file? We'll include a small set
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
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

(function main() {
  if (!fs.existsSync(effectsFile)) { console.error('effects file not found:', effectsFile); process.exit(1); }
  const txt = fs.readFileSync(effectsFile, 'utf8');
  const ids = new Set();
  const regex = /id:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = regex.exec(txt))) ids.add(m[1]);
  const idList = Array.from(ids).sort();
  console.log(`Found ${idList.length} effect ids`);
  const missing = [];
  const found = [];
  for (const id of idList) {
    const candidates = buildCandidates(id);
    const p = existsAny(candidates);
    if (p) found.push({ id, path: p, candidates: candidates.slice(0,5) });
    else missing.push({ id, candidates: candidates.slice(0,5) });
  }
  console.log('\n-- FOUND ICONS ('+found.length+') --');
  found.slice(0,200).forEach(f => console.log(f.id, '->', path.relative(root, f.path)));
  console.log('\n-- MISSING ICONS ('+missing.length+') --');
  missing.slice(0,200).forEach(m => console.log(m.id, 'candidates:', m.candidates));

  // Print stats for some sample names
  console.log('\nSample checks: maneki-neko, bait_switch, tortoiseshell');
  ['maneki-neko','bait_switch','tortoiseshell'].forEach(s => console.log(s, buildCandidates(s)));
})();
