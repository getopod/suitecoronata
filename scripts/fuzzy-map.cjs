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
  return fs.readdirSync(dir).filter(f => !f.startsWith('.')).map(f => path.basename(f, path.extname(f)));
}

const files = new Set();
[listBases(iconsDir), listBases(path.join(iconsDir, 'categories')), listBases(optimized48), listBases(optimized96)].forEach(arr => arr.forEach(b => files.add(b)));
const fileBases = Array.from(files);

if (!fs.existsSync(effectsFile)) { console.error('effects file not found', effectsFile); process.exit(1); }
const txt = fs.readFileSync(effectsFile, 'utf8');
const ids = new Set();
const regex = /id:\s*['"]([^'"]+)['"]/g;
let m;
while ((m = regex.exec(txt))) ids.add(m[1]);
const idList = Array.from(ids).sort();

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
}

const suggestions = {};
const details = {};
for (const id of idList) {
  const nid = normalizeKey(id);
  let best = null;
  let bestScore = -1;
  const candidates = [];
  for (const fb of fileBases) {
    const nfb = normalizeKey(fb);
    if (!nfb) continue;
    if (nfb === nid) {
      best = fb;
      bestScore = 1;
      candidates.push({ fb, score: 1 });
      break;
    }
    const dist = levenshtein(nid, nfb);
    const maxLen = Math.max(nid.length, nfb.length);
    const score = 1 - (dist / Math.max(1, maxLen));
    candidates.push({ fb, score, dist });
    if (score > bestScore) {
      bestScore = score;
      best = fb;
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  details[id] = candidates.slice(0, 5);
  if (bestScore >= 0.82) {
    suggestions[id] = best;
  } else {
    const top = details[id][0];
    if (top && top.dist !== undefined && top.dist <= 1) suggestions[id] = top.fb;
  }
}

const outPath = path.join(root, 'scripts', 'fuzzy-icon-suggestions.json');
fs.writeFileSync(outPath, JSON.stringify({ suggestions, details }, null, 2));
console.log('Wrote fuzzy suggestions:', Object.keys(suggestions).length, 'to', outPath);
console.log('Sample:', Object.entries(suggestions).slice(0, 40));
