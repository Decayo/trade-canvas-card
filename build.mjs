// Build kcard.js, the T3 card shell (p1.50), from trade-canvas-p1 sources:
//   node scripts/build-card.mjs [out]      (npm run build:card -> ../trade-canvas-card/kcard.js)
// A tiny bundler for our own ES modules: each module becomes a function in __M keyed by its repo path;
// `import { a, b as c } from './x.js'` becomes a destructure, `export function|const|let|class` a return entry.
// Only relative imports are allowed, so nothing outside these files (no host, account or broker code) gets in.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = 'card/shell.js';
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '..', 'trade-canvas-card', 'kcard.js'));
const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*'(\.{1,2}\/[^']+\.js)';?[ \t]*$/gm;

const order = [], seen = new Set();
function visit(rel) {
  if (seen.has(rel)) return;
  seen.add(rel);
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const m of src.matchAll(IMPORT)) visit(path.posix.join(path.posix.dirname(rel), m[2]));
  order.push(rel);
}
visit(ENTRY);

const out = order.map((rel) => {
  let src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const names = [];
  src = src.replace(IMPORT, (_, list, spec) => `const {${list.replace(/\s+as\s+/g, ': ')}} = __M['${path.posix.join(path.posix.dirname(rel), spec)}'];`);
  src = src.replace(/^export (async function|function|const|let|class) (\w+)/gm, (_, kw, n) => { names.push(n); return `${kw} ${n}`; });
  if (/^\s*(import|export)\b/m.test(src)) throw new Error(`unsupported import/export in ${rel}`);
  src = src.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//')).join('\n');
  return `__M['${rel}'] = (() => {\n${src}\nreturn { ${names.join(', ')} };\n})();`;
}).join('\n');

const bundle = `/*! kcard — trade-canvas T3 card shell. Built from ${order.length} modules: ${order.join(', ')} */
(function () {
window.__kcardScript = document.currentScript;
var __M = {};
${out}
})();
`;
// Guard: the public bundle must not carry tailnet hosts, IPs or account ids.
const bad = [/ts\.net/i, /\b100\.\d+\.\d+\.\d+\b/, /\bU\d{6,}\b/, /\bDU\d{5,}\b/].find((re) => re.test(bundle));
if (bad) throw new Error(`refusing to write: bundle matches ${bad}`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, bundle);
console.log(`kcard.js ${(bundle.length / 1024).toFixed(1)} KB, ${order.length} modules -> ${OUT}`);
