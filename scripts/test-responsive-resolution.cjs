const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const respFile = path.join(root, 'components', 'ResponsiveIcon.tsx');
const optimized48 = path.join(root, 'public', 'icons', 'optimized', '48');

const txt = fs.readFileSync(respFile, 'utf8');

function parseObjectBlock(source, blockName) {
  const re = new RegExp(blockName + '\\s*[:=][\\s\\S]*?\\{([\\s\\S]*?)\\};', 'm');
  const m = re.exec(source);
  if (!m) return null;
  const body = m[1];
  const map = {};
  const lineRe = /['"]?([a-z0-9_\-\s]+)['"]?\s*:\s*['"]([^'"]+)['"]/gi;
  let r;
  while ((r = lineRe.exec(body))) {
    map[r[1].trim()] = r[2].trim();
  }
  return map;
}

const ICON_SYNONYMS = parseObjectBlock(txt, 'const ICON_SYNONYMS') || {};
const ADDITIONAL = parseObjectBlock(txt, 'const ADDITIONAL_ICON_SYNONYMS') || {};

const merged = Object.assign({}, ICON_SYNONYMS);
for (const k of Object.keys(ADDITIONAL)) {
  if (!(k in merged)) merged[k] = ADDITIONAL[k];
}

function slugWithUnderscores(s) { return String(s || '').replace(/[^a-z0-9-_]/gi, '_').toLowerCase(); }
function slug(s) { return String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, ''); }
function buildCandidates(baseName) {
  const cleaned = String(baseName || '').trim();
  const candidates = [];
  if (!cleaned) return candidates;
  const syn = merged[cleaned.toLowerCase()];
  if (syn) candidates.push(syn);
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
    const p = path.join(optimized48, `${name}.webp`);
    if (fs.existsSync(p)) return p;
    // also check variant with hyphens
    const p2 = path.join(optimized48, `${name.replace(/ /g,'-')}.webp`);
    if (fs.existsSync(p2)) return p2;
  }
  return null;
}

const tests = ['angel_investor','bag_of_holding','bait_switch','maneki-neko','stolen_valor','alchemist','creative_accounting'];
for (const t of tests) {
  const c = buildCandidates(t);
  const p = existsAny(c);
  console.log(t, 'candidates:', c.slice(0,6), '->', p ? path.relative(root, p) : 'NOT FOUND');
}

fs.writeFileSync(path.join(root,'scripts','merged-icon-mapping.json'), JSON.stringify(merged, null, 2));
console.log('Wrote merged mapping to scripts/merged-icon-mapping.json');
