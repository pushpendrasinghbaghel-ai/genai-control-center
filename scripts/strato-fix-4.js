// Phase 4: Replace raw HTML elements with Strato components
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
  
  // Skip DavisResponse.tsx — it renders markdown, raw HTML is intentional there
  if (rel.includes('DavisResponse')) continue;

  // 1. Replace simple <span style={{...}}>text</span> → <Text style={{...}}>text</Text>
  // Only for simple cases where span contains text or JSX expressions
  c = c.replace(/<span style=\{(\{[^}]+\})\}>([^<]*(?:<[^/][^>]*>[^<]*<\/[^>]*>)*[^<]*)<\/span>/g, '<Text style={$1}>$2</Text>');
  
  // 2. Replace <span>text</span> (no style) → <Text>text</Text>
  c = c.replace(/<span>([^<]{1,200})<\/span>/g, '<Text>$1</Text>');
  
  // 3. Replace simple <div style={{...}}> ... </div> → <Flex style={{...}}> ... </Flex>
  // Only for simple non-nested divs (color dots, wrappers)
  // Pattern: div with width/height that's a color dot
  c = c.replace(/<div style=\{(\{[^}]*(?:width|height)[^}]*\})\}\s*\/>/g, '<Flex style={$1} />');
  
  // 4. Replace <button ...> with <Button ...> in component files
  // Only in specific patterns where it's clearly a standalone button
  // Already handled in AskAIButton - skip this for safety

  if (c !== orig) {
    // Ensure Text import exists
    if (c.includes('<Text ') || c.includes('<Text>')) {
      if (!c.match(/import\s[^;]*\bText\b[^;]*from.*typography/)) {
        // Check if there's any typography import to extend
        const typoMatch = c.match(/import\s*\{([^}]*)\}\s*from\s*["']@dynatrace\/strato-components\/typography["']/);
        if (typoMatch) {
          if (!typoMatch[1].includes('Text')) {
            c = c.replace(typoMatch[0], typoMatch[0].replace(typoMatch[1], typoMatch[1] + ', Text'));
          }
        } else {
          // Add new import
          const lines = c.split('\n');
          let lastImportLine = 0;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trimStart().startsWith('import ') && lines[i].includes(' from ')) lastImportLine = i;
          }
          lines.splice(lastImportLine + 1, 0, "import { Text } from '@dynatrace/strato-components/typography';");
          c = lines.join('\n');
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
