/**
 * Repair script for broken auto-replacements from strato-fix scripts.
 * Fixes patterns like:
 * 1. obj.formatNumber(prop)  -> formatNumber(obj.prop)
 * 2. obj.formatTime(prop)    -> formatTime(obj.prop)
 * 3. DateformatNumber(...)   -> formatDateTime(...)
 * 4. Math.roundformatNumber  -> formatNumber(Math.round(...))
 * 5. NumberformatNumber      -> formatNumber(Number(...))
 * 6. Duplicate formatNumber imports
 */
const fs = require('fs');
const path = require('path');

const uiDir = path.join(__dirname, '..', 'ui', 'app');
const allFiles = [];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) allFiles.push(full);
  }
}
walk(uiDir);

let totalFixes = 0;

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  const rel = path.relative(path.join(__dirname, '..'), file);

  // Fix 1: obj.formatNumber(prop) -> formatNumber(obj.prop)
  // Pattern: someExpr.formatNumber(identifier)
  // e.g. r.formatNumber(count) -> formatNumber(r.count)
  content = content.replace(/(\w+(?:\.\w+)*)\.formatNumber\((\w+)\)/g, (match, obj, prop) => {
    console.log(`  [${rel}] ${match} -> formatNumber(${obj}.${prop})`);
    return `formatNumber(${obj}.${prop})`;
  });

  // Fix 2: obj.formatTime(prop) -> formatTime(obj.prop)
  content = content.replace(/(\w+(?:\.\w+)*)\.formatTime\((\w+)\)/g, (match, obj, prop) => {
    console.log(`  [${rel}] ${match} -> formatTime(${obj}.${prop})`);
    return `formatTime(${obj}.${prop})`;
  });

  // Fix 3: DateformatNumber(...) -> formatDateTime(...)
  content = content.replace(/DateformatNumber\(/g, (match) => {
    console.log(`  [${rel}] DateformatNumber( -> formatDateTime(`);
    return 'formatDateTime(';
  });

  // Fix 4: Math.roundformatNumber(...) -> formatNumber(Math.round(...))
  // The script replaced Math.round(X).toLocaleString() with Math.roundformatNumber(X)
  content = content.replace(/Math\.roundformatNumber\(([^)]+)\)/g, (match, inner) => {
    console.log(`  [${rel}] Math.roundformatNumber -> formatNumber(Math.round(...))`);
    return `formatNumber(Math.round(${inner}))`;
  });

  // Fix 5: NumberformatNumber(...) -> formatNumber(Number(...))
  content = content.replace(/NumberformatNumber\(([^)]+)\)/g, (match, inner) => {
    console.log(`  [${rel}] NumberformatNumber -> formatNumber(Number(...))`);
    return `formatNumber(Number(${inner}))`;
  });

  // Fix 6: requests.formatNumber(...) where requests is a bare identifier that was part of `.requests.toLocaleString()`
  // Already handled by Fix 1

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    totalFixes++;
    console.log(`Fixed: ${rel}`);
  }
}

console.log(`\nTotal files fixed: ${totalFixes}`);
