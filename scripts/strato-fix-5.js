// Phase 5: More aggressive div→Flex, span→Text replacement, remaining locale fixes
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
  
  // Skip DavisResponse.tsx — renders markdown
  if (rel.includes('DavisResponse')) continue;

  // ── DIV replacements ──
  // Replace <div style={...}> → <Flex style={...}>  and </div> → </Flex>
  // Multi-line div patterns
  c = c.replace(/<div\s+style=\{/g, '<Flex style={');
  c = c.replace(/<div\s+key=/g, '<Flex key=');
  // Simple <div> with no attrs
  c = c.replace(/<div>/g, '<Flex>');
  // Self-closing div
  c = c.replace(/<div\s*\/>/g, '<Flex />');
  // Closing tags - replace </div> → </Flex>
  c = c.replace(/<\/div>/g, '</Flex>');

  // ── SPAN replacements (remaining) ──
  c = c.replace(/<span\s+style=\{/g, '<Text style={');
  c = c.replace(/<span\s+key=/g, '<Text key=');
  c = c.replace(/<span>/g, '<Text>');
  c = c.replace(/<\/span>/g, '</Text>');

  // ── BUTTON replacements (raw buttons → Button) ──
  // Only replace <button with <Button where it's a raw button
  // This is tricky so we only handle simple cases
  c = c.replace(/<button\s+onClick=/g, '<Button onClick=');
  c = c.replace(/<\/button>/g, '</Button>');

  // ── Fix remaining toLocaleTimeString/toLocaleString patterns ──
  // Pattern: formatTime is already called in some places, but some remaining .toLocaleTimeString()
  // exist in hooks/agent where the Date object was created differently
  c = c.replace(/(\w+)\.toLocaleTimeString\(\)/g, 'formatTime($1)');
  c = c.replace(/(\w+)\.toLocaleString\(\)/g, 'formatNumber($1)');

  // ── Fix calc(100vh ...) ──
  c = c.replace(/calc\(100vh\s*-\s*\d+px\)/g, '100%');

  // ── Ensure required imports ──
  if (c !== orig) {
    // Check if Flex import is needed
    if (c.includes('<Flex') && !c.match(/import\s[^;]*\bFlex\b[^;]*from.*layouts/)) {
      const layoutMatch = c.match(/import\s*\{([^}]*)\}\s*from\s*["']@dynatrace\/strato-components\/layouts["']/);
      if (layoutMatch) {
        if (!layoutMatch[1].includes('Flex')) {
          c = c.replace(layoutMatch[0], layoutMatch[0].replace(layoutMatch[1], layoutMatch[1] + ', Flex'));
        }
      }
    }
    
    // Check if Text import is needed  
    if (c.includes('<Text') && !c.match(/import\s[^;]*\bText\b[^;]*from.*typography/)) {
      const typoMatch = c.match(/import\s*\{([^}]*)\}\s*from\s*["']@dynatrace\/strato-components\/typography["']/);
      if (typoMatch) {
        if (!typoMatch[1].includes('Text')) {
          c = c.replace(typoMatch[0], typoMatch[0].replace(typoMatch[1], typoMatch[1] + ', Text'));
        }
      } else {
        // Add new typography import
        const lines = c.split('\n');
        let lastImportLine = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trimStart().startsWith('import ') && lines[i].includes(' from ')) lastImportLine = i;
        }
        lines.splice(lastImportLine + 1, 0, "import { Text } from '@dynatrace/strato-components/typography';");
        c = lines.join('\n');
      }
    }

    // Check if Button import is needed
    if (c.includes('<Button') && !c.match(/import\s[^;]*\bButton\b[^;]*from.*buttons/)) {
      const lines = c.split('\n');
      let lastImportLine = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trimStart().startsWith('import ') && lines[i].includes(' from ')) lastImportLine = i;
      }
      lines.splice(lastImportLine + 1, 0, "import { Button } from '@dynatrace/strato-components/buttons';");
      c = lines.join('\n');
    }
    
    // Add formatting imports if needed
    const needNum = c.includes('formatNumber(') && !c.match(/import\s[^;]*formatNumber[^;]*from.*formatting/);
    const needTime = c.includes('formatTime(') && !c.match(/import\s[^;]*formatTime[^;]*from.*formatting/);
    const needDT = c.includes('formatDateTime(') && !c.match(/import\s[^;]*formatDateTime[^;]*from.*formatting/);
    
    const funcs = [];
    if (needNum) funcs.push('formatNumber');
    if (needTime) funcs.push('formatTime');
    if (needDT) funcs.push('formatDateTime');
    
    if (funcs.length > 0) {
      const existingMatch = c.match(/import\s*\{([^}]*)\}\s*from\s*["']\.\.\/utils\/formatting["']/);
      if (existingMatch) {
        const existing = existingMatch[1].split(',').map(s => s.trim());
        const toAdd = funcs.filter(f => !existing.includes(f));
        if (toAdd.length > 0) {
          const newImports = [...existing, ...toAdd].join(', ');
          c = c.replace(existingMatch[0], `import { ${newImports} } from '../utils/formatting'`);
        }
      } else if (!c.includes("from '../utils/formatting'") && !c.includes("from '../../utils/formatting'")) {
        const importLine = `import { ${funcs.join(', ')} } from '../utils/formatting';`;
        const lines = c.split('\n');
        let lastImportLine = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trimStart().startsWith('import ') && lines[i].includes(' from ')) lastImportLine = i;
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
