const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fuzzyFile = path.join(root, 'scripts', 'fuzzy-icon-suggestions.json');
const respMappings = path.join(root, 'components', 'iconMappings.ts');

if (!fs.existsSync(fuzzyFile)) { console.error('fuzzy suggestions not found'); process.exit(1); }
if (!fs.existsSync(respMappings)) { console.error('iconMappings not found'); process.exit(1); }

const fuzzy = JSON.parse(fs.readFileSync(fuzzyFile, 'utf8'));
const content = fs.readFileSync(respMappings, 'utf8');

// parse keys in ADDITIONAL_ICON_SYNONYMS object
const objRegex = /export const ADDITIONAL_ICON_SYNONYMS:[\s\S]*?=\s*\{([\s\S]*?)\};/m;
const m = objRegex.exec(content);
if (!m) { console.error('Could not parse iconMappings object'); process.exit(1); }
const body = m[1];
const keyRegex = /['"]?([a-z0-9_\-\s]+)['"]?\s*:\s*['"]/gi;
let k;
const existing = new Set();
while ((k = keyRegex.exec(body))) { existing.add(k[1]); }

const toAdd = {};
for (const [id, val] of Object.entries(fuzzy.suggestions || {})) {
  if (!existing.has(id)) toAdd[id] = val;
}

fs.writeFileSync(path.join(root, 'scripts', 'fuzzy-to-add.json'), JSON.stringify(toAdd, null, 2));
console.log('To add count:', Object.keys(toAdd).length, 'written to scripts/fuzzy-to-add.json');
console.log('Sample:', Object.entries(toAdd).slice(0,20));
