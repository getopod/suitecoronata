const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fuzzyFile = path.join(root, 'scripts', 'fuzzy-icon-suggestions.json');
const existingFile = path.join(root, 'components', 'iconMappings.ts');

if (!fs.existsSync(fuzzyFile)) { console.error('fuzzy suggestions not found'); process.exit(1); }
if (!fs.existsSync(existingFile)) { console.error('existing mappings not found'); process.exit(1); }

const fuzzy = JSON.parse(fs.readFileSync(fuzzyFile, 'utf8'));
const existingContent = fs.readFileSync(existingFile, 'utf8');

// parse existing mapping
const objRegex = /export const ADDITIONAL_ICON_SYNONYMS:[\s\S]*?=\s*\{([\s\S]*?)\};/m;
const m = objRegex.exec(existingContent);
let existingMap = {};
if (m) {
  const body = m[1];
  const lineRe = /['"]?([a-z0-9_\-\s]+)['"]?\s*:\s*['"]([^'"]+)['"]/gi;
  let r;
  while ((r = lineRe.exec(body))) {
    existingMap[r[1].trim()] = r[2].trim();
  }
}

const merged = { ...existingMap };
for (const [k,v] of Object.entries(fuzzy.suggestions || {})) {
  if (!(k in merged)) merged[k] = v;
}

// write a generated components file content to scripts
const lines = [];
lines.push("// Auto-generated merged icon mappings (existing + fuzzy suggestions)");
lines.push("// Keep this file checked in; it's safe to re-generate from scripts/fuzzy-map.cjs");
lines.push("export const ADDITIONAL_ICON_SYNONYMS: Record<string, string> = {");
const keys = Object.keys(merged).sort();
for (const k of keys) {
  const v = merged[k].replace(/'/g, "\\'");
  lines.push(`  ${k.includes(' ') ? `'${k}'` : k}: '${v}',`);
}
lines.push("};");
lines.push("");
lines.push("export default ADDITIONAL_ICON_SYNONYMS;");

const out = path.join(root, 'scripts', 'iconMappings.merged.ts');
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log('Wrote merged iconMappings preview to', out, 'entries=', keys.length);
