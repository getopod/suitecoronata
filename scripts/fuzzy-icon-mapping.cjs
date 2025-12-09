/*
 * Fuzzy icon mapping helper
 *
 * Finds likely icon filename basenames for each effect id by computing
 * Levenshtein distance between normalized identifiers and available
 * icon basenames. Produces two outputs:
 *  - scripts/icon-mapping-fuzzy.json        (all candidates above MIN_SCORE)
 *  - scripts/icon-mapping-fuzzy-high.json   (high-confidence candidates only)
 *
 * This script deliberately avoids overwriting existing mappings defined in
 * ResponsiveIcon.tsx or components/iconMappings.ts.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const effectsFile = path.join(root, 'data', 'effects.ts');
const respFile = path.join(root, 'components', 'ResponsiveIcon.tsx');
const additionalMapFile = path.join(root, 'components', 'iconMappings.ts');
const iconsDir = path.join(root, 'public', 'icons');

const MIN_SCORE = 0.6;      // record anything at or above this similarity
const HIGH_SCORE = 0.82;    // treat as high-confidence suggestion

// --- Utility helpers ---
function normalizeKey(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  const na = normalizeKey(a);
  const nb = normalizeKey(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  const denom = Math.max(na.length, nb.length) || 1;
  return 1 - dist / denom;
}

// Recursively collect unique file basenames from icons directory
function collectBasenames(dir, outSet) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectBasenames(full, outSet);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.png', '.webp', '.svg', '.jpg', '.jpeg'].includes(ext)) continue;
      const base = path.basename(entry.name, ext);
      outSet.add(base);
    }
  }
}

function parseObjectMap(source, name) {
  const re = new RegExp(name + '\\s*[:=]\\s*[^=]*?\\{([\\s\\S]*?)\\}', 'm');
  const m = re.exec(source);
  if (!m) return {};
  const body = m[1];
  const map = {};
  const lineRe = /['"]?([a-z0-9_\-\s]+)['"]?\s*:\s*['"]([^'"}]+)['"]/gi;
  let r;
  while ((r = lineRe.exec(body))) {
    map[r[1].trim().toLowerCase()] = r[2].trim();
  }
  return map;
}

// --- Load data ---
if (!fs.existsSync(effectsFile)) {
  console.error('Missing data/effects.ts');
  process.exit(1);
}
const effectsTxt = fs.readFileSync(effectsFile, 'utf8');
const ids = new Set();
const idRe = /id:\s*['"]([^'"\n]+)['"]/g;
let m;
while ((m = idRe.exec(effectsTxt))) ids.add(m[1]);
const effectIds = Array.from(ids).sort();

const respTxt = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf8') : '';
const addMapTxt = fs.existsSync(additionalMapFile) ? fs.readFileSync(additionalMapFile, 'utf8') : '';
const baseMap = parseObjectMap(respTxt, 'ICON_SYNONYMS');
const additionalMap = parseObjectMap(respTxt, 'ADDITIONAL_ICON_SYNONYMS');
const externalMap = parseObjectMap(addMapTxt, 'ADDITIONAL_ICON_SYNONYMS');
const existingMapped = new Set([
  ...Object.keys(baseMap),
  ...Object.keys(additionalMap),
  ...Object.keys(externalMap),
]);

const fileBases = new Set();
collectBasenames(iconsDir, fileBases);
const baseList = Array.from(fileBases);

// --- Compute suggestions ---
const suggestions = {};
const high = {};

for (const id of effectIds) {
  if (existingMapped.has(id.toLowerCase())) continue;

  let bestBase = null;
  let bestScore = -1;

  for (const base of baseList) {
    const score = similarity(id, base);
    if (score > bestScore) {
      bestScore = score;
      bestBase = base;
    }
  }

  if (bestBase && bestScore >= MIN_SCORE) {
    suggestions[id] = { icon: bestBase, score: Number(bestScore.toFixed(4)) };
    if (bestScore >= HIGH_SCORE) {
      high[id] = suggestions[id];
    }
  }
}

const outAll = path.join(root, 'scripts', 'icon-mapping-fuzzy.json');
const outHigh = path.join(root, 'scripts', 'icon-mapping-fuzzy-high.json');
fs.writeFileSync(outAll, JSON.stringify(suggestions, null, 2));
fs.writeFileSync(outHigh, JSON.stringify(high, null, 2));

console.log(`Found ${Object.keys(suggestions).length} fuzzy suggestions (>=${MIN_SCORE})`);
console.log(`High-confidence (>=${HIGH_SCORE}): ${Object.keys(high).length}`);
console.log('Sample high-confidence entries:', Object.entries(high).slice(0, 10));