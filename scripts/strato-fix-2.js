// Phase 2: Fix number .toLocaleString() calls and remaining Date patterns
const fs = require('fs');
const path = require('path');

const baseDir = path.resolve('ui/app');
const allFiles = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) allFiles.push(f);
  }
}
walk(path.join(baseDir, 'pages'));
walk(path.join(baseDir, 'components'));
walk(path.join(baseDir, 'hooks'));
walk(path.join(baseDir, 'agent'));

let totalChanges = 0;
const log = [];

for (const file of allFiles) {
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;
  const rel = path.relative(baseDir, file);

  // Fix DavisAssistant calc(100vh)
  c = c.replace(/height:\s*'calc\(100vh\s*-\s*\d+px\)'/g, "height: '100%'");
  
  // Fix remaining new Date().toLocaleString() (no arg)
  c = c.replace(/new Date\(\)\.toLocaleString\(\)/g, 'formatDateTime(new Date())');
  
  // Fix .toLocaleString() on variables that look numeric in context
  // Pattern: someVar.toLocaleString() where it's clearly in a number context
  // e.g., totalTokens.toLocaleString() or count.toLocaleString()
  // We replace with formatNumber(someVar)
  const numLocaleRegex = /(\b(?:total|count|sum|avg|max|min|tokens|requests|cost|errors|latency|value|percent|score|rate|num|n)\w*)\.toLocaleString\(\)/gi;
  c = c.replace(numLocaleRegex, 'formatNumber($1)');
  
  // Pattern: (expr).toLocaleString() 
  c = c.replace(/\(([^)]+)\)\.toLocaleString\(\)/g, 'formatNumber($1)');
  
  // Pattern: number literal toLocaleString
  c = c.replace(/(\d+)\.toLocaleString\(\)/g, 'formatNumber($1)');
  
  // Fix remaining var.toLocaleString() — generic catch-all 
  // Be careful here - only match simple identifiers
  const genericLocale = /(\w+(?:\.\w+)*)\.toLocaleString\(\)/g;
  let match;
  const remaining = [];
  while ((match = genericLocale.exec(c)) !== null) {
    remaining.push({ full: match[0], var: match[1], index: match.index });
  }
  // Replace from end to start to preserve indices
  for (let i = remaining.length - 1; i >= 0; i--) {
    const r = remaining[i];
    // Skip if it's already formatNumber or known non-number
    if (r.var.includes('format') || r.var === 'Date') continue;
    c = c.slice(0, r.index) + `formatNumber(${r.var})` + c.slice(r.index + r.full.length);
  }

  if (c !== orig) {
    // Add imports
    const needNum = c.includes('formatNumber(') && !c.match(/import\s[^;]*formatNumber[^;]*from/);
    const needDT = c.includes('formatDateTime(') && !c.match(/import\s[^;]*formatDateTime[^;]*from/);
    const needTime = c.includes('formatTime(') && !c.match(/import\s[^;]*formatTime[^;]*from/);
    
    const funcs = [];
    if (needNum) funcs.push('formatNumber');
    if (needDT) funcs.push('formatDateTime');
    if (needTime) funcs.push('formatTime');
    
    if (funcs.length > 0) {
      const isDeep = rel.includes('hooks') || rel.includes('agent');
      const importPath = isDeep ? '../utils/formatting' : '../utils/formatting';
      
      if (!c.includes("from '../utils/formatting'") && !c.includes("from '../../utils/formatting'")) {
        const importLine = `import { ${funcs.join(', ')} } from '${importPath}';`;
        const lines = c.split('\n');
        let lastImportLine = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trimStart().startsWith('import ') && lines[i].includes(' from ')) {
            lastImportLine = i;
          }
        }
        lines.splice(lastImportLine + 1, 0, importLine);
        c = lines.join('\n');
      } else {
        // Extend existing import
        const existingMatch = c.match(/import\s*\{([^}]*)\}\s*from\s*'\.\.\/utils\/formatting'/);
        if (existingMatch) {
          const existing = existingMatch[1].split(',').map(s => s.trim());
          const toAdd = funcs.filter(f => !existing.includes(f));
          if (toAdd.length > 0) {
            const newImports = [...existing, ...toAdd].join(', ');
            c = c.replace(existingMatch[0], `import { ${newImports} } from '../utils/formatting'`);
          }
        }
      }
    }

    fs.writeFileSync(file, c, 'utf8');
    totalChanges++;
    log.push(rel);
  }
}

console.log('Files changed: ' + totalChanges);
log.forEach(l => console.log('  ' + l));
