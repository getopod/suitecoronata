const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const effectsFile = path.join(root, 'data', 'effects.ts');
const iconsDir = path.join(root, 'public', 'icons');
const optimized48 = path.join(iconsDir, 'optimized', '48');
const optimized96 = path.join(iconsDir, 'optimized', '96');

function normalizeKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function listBases(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => !f.startsWith('.')).map(f => {
    const ext = path.extname(f);
    return path.basename(f, ext);
  });
}

const files = new Set();
[listBases(iconsDir), listBases(path.join(iconsDir, 'categories')), listBases(optimized48), listBases(optimized96)].forEach(arr => arr.forEach(b => files.add(b)));
const fileBases = Array.from(files);

if (!fs.existsSync(effectsFile)) { console.error('effects file not found'); process.exit(1); }
const txt = fs.readFileSync(effectsFile, 'utf8');
const ids = new Set();
const regex = /id:\s*['"]([^'"]+)['"]/g;
let m;
while ((m = regex.exec(txt))) ids.add(m[1]);
const idList = Array.from(ids).sort();

const suggestions = {};
for (const id of idList) {
  const nid = normalizeKey(id);
  // Find file with same normalized key
  const match = fileBases.find(b => normalizeKey(b) === nid);
  if (match) suggestions[id] = match;
}

const out = path.join(root, 'scripts', 'icon-mapping-suggestions.json');
fs.writeFileSync(out, JSON.stringify(suggestions, null, 2));
console.log('Wrote suggestions for', Object.keys(suggestions).length, 'ids to', out);
console.log('Sample suggestions:', Object.entries(suggestions).slice(0,20));
