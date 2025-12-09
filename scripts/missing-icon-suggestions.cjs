const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const respFile = path.join(root, 'components', 'ResponsiveIcon.tsx');
const suggestionsFile = path.join(root, 'scripts', 'icon-mapping-suggestions.json');

if (!fs.existsSync(respFile)) { console.error('ResponsiveIcon not found'); process.exit(1); }
if (!fs.existsSync(suggestionsFile)) { console.error('suggestions not found'); process.exit(1); }

const resp = fs.readFileSync(respFile, 'utf8');
const suggestions = JSON.parse(fs.readFileSync(suggestionsFile, 'utf8'));

// parse keys from ICON_SYNONYMS object in the file
const objRegex = /const ICON_SYNONYMS:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)\};/m;
const m = objRegex.exec(resp);
if (!m) { console.error('Could not parse ICON_SYNONYMS'); process.exit(1); }
const body = m[1];
const keyRegex = /['"]?([a-z0-9_\-\s]+)['"]?\s*:\s*['"]/gi;
let k;
const existing = new Set();
while ((k = keyRegex.exec(body))) { existing.add(k[1]); }

const missing = {};
for (const [id, val] of Object.entries(suggestions)) {
  if (!existing.has(id)) missing[id] = val;
}
console.log('Missing suggestion count:', Object.keys(missing).length);
console.log(Object.entries(missing).slice(0,200));
fs.writeFileSync(path.join(root, 'scripts', 'icon-mapping-missing.json'), JSON.stringify(missing, null, 2));
console.log('Wrote missing list to scripts/icon-mapping-missing.json');
