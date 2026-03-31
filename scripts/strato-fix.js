// Automated Strato Design System compliance fixer
// Handles: toLocaleString→formatDateTime, toLocaleTimeString→formatTime, responsive grids
const fs = require('fs');
const path = require('path');

const baseDir = path.resolve('ui/app');
const allFiles = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith('.tsx')) allFiles.push(f);
  }
}
walk(path.join(baseDir, 'pages'));
walk(path.join(baseDir, 'components'));

let totalChanges = 0;
const log = [];

for (const file of allFiles) {
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;
  const rel = path.relative(baseDir, file);

  // 1. toLocaleTimeString
  c = c.replace(/new Date\(([^)]+)\)\.toLocaleTimeString\(\)/g, 'formatTime($1)');
  // 2. toLocaleString on Date objects  
  c = c.replace(/new Date\(([^)]+)\)\.toLocaleString\(\)/g, 'formatDateTime($1)');
  // 3. toLocaleString with options
  c = c.replace(/new Date\(([^)]+)\)\.toLocaleString\(undefined,\s*(\{[^}]+\})\)/g, 'formatDateTime($1, $2)');
  // 4. Responsive grids
  c = c.replace(/gridTemplateColumns:\s*'repeat\(2,\s*1fr\)'/g, "gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'");
  
  if (c !== orig) {
    // Add imports for new functions
    const needTime = c.includes('formatTime(') && !c.match(/import\s.*formatTime.*from/);
    const needDT = c.includes('formatDateTime(') && !c.match(/import\s.*formatDateTime.*from/);
    
    if (needTime || needDT) {
      const funcs = [];
      if (needTime) funcs.push('formatTime');
      if (needDT) funcs.push('formatDateTime');
      
      if (!c.includes("from '../utils/formatting'")) {
        const importLine = `import { ${funcs.join(', ')} } from '../utils/formatting';`;
        // Insert after last import
        const lines = c.split('\n');
        let lastImportLine = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trimStart().startsWith('import ') && lines[i].includes(' from ')) {
            lastImportLine = i;
          }
        }
        lines.splice(lastImportLine + 1, 0, importLine);
        c = lines.join('\n');
      }
    }
    
    fs.writeFileSync(file, c, 'utf8');
    totalChanges++;
    log.push(rel);
  }
}

console.log('Files changed: ' + totalChanges);
log.forEach(l => console.log('  ' + l));
