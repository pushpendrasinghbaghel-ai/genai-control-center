/**
 * Fix duplicate formatNumber imports.
 * Some files had both a local formatNumber function AND the formatting import added.
 * Also ensures formatDateTime is imported where DateformatNumber was repaired.
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

  // Count how many times formatNumber is declared/imported
  const formatNumberDecls = (content.match(/(?:^|\n)(?:import\s+\{[^}]*\bformatNumber\b[^}]*\}|(?:const|function|let|var)\s+formatNumber\b)/g) || []);
  
  if (formatNumberDecls.length > 1) {
    // There's both a local declaration and an import. 
    // If there's a local function/const formatNumber, keep it and remove from the formatting import
    const hasLocalDecl = /(?:const|function|let|var)\s+formatNumber\b/.test(content);
    
    if (hasLocalDecl) {
      // Remove formatNumber from the formatting import line
      // Pattern: import { formatNumber } from '../utils/formatting';
      // Or: import { formatTime, formatNumber } from '../utils/formatting';
      content = content.replace(
        /import\s*\{\s*([^}]*)\bformatNumber\b([^}]*)\}\s*from\s*['"]\.\.\/utils\/formatting['"];?\n?/,
        (match, before, after) => {
          // Remove formatNumber from the import list
          let imports = match.match(/\{([^}]*)\}/)[1];
          imports = imports.replace(/\bformatNumber\b\s*,?\s*/, '').replace(/,\s*$/, '').replace(/^\s*,\s*/, '').trim();
          if (!imports) {
            console.log(`  [${rel}] Removed empty formatting import`);
            return '';
          }
          const result = `import { ${imports} } from '../utils/formatting';\n`;
          console.log(`  [${rel}] Removed formatNumber from import, kept: ${imports}`);
          return result;
        }
      );
    }
  }

  // Same for formatTime duplicate
  const formatTimeDecls = (content.match(/(?:^|\n)(?:import\s+\{[^}]*\bformatTime\b[^}]*\}|(?:const|function|let|var)\s+formatTime\b)/g) || []);
  if (formatTimeDecls.length > 1) {
    const hasLocalDecl = /(?:const|function|let|var)\s+formatTime\b/.test(content);
    if (hasLocalDecl) {
      content = content.replace(
        /import\s*\{\s*([^}]*)\bformatTime\b([^}]*)\}\s*from\s*['"]\.\.\/utils\/formatting['"];?\n?/,
        (match, before, after) => {
          let imports = match.match(/\{([^}]*)\}/)[1];
          imports = imports.replace(/\bformatTime\b\s*,?\s*/, '').replace(/,\s*$/, '').replace(/^\s*,\s*/, '').trim();
          if (!imports) {
            console.log(`  [${rel}] Removed empty formatting import`);
            return '';
          }
          const result = `import { ${imports} } from '../utils/formatting';\n`;
          console.log(`  [${rel}] Removed formatTime from import, kept: ${imports}`);
          return result;
        }
      );
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    totalFixes++;
    console.log(`Fixed: ${rel}`);
  }
}

console.log(`\nTotal files fixed: ${totalFixes}`);
