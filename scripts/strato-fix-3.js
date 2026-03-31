// Phase 3: Replace hardcoded hex colors with design tokens
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

// Color mapping: hex → CSS variable (theme-aware)
const colorMap = {
  // Greens (success/good)
  '#4CAF50': 'var(--dt-colors-charts-status-good-default)',
  '#4caf50': 'var(--dt-colors-charts-status-good-default)',
  '#8BC34A': 'var(--dt-colors-charts-status-good-default)',
  '#73be28': 'var(--dt-colors-charts-status-good-default)',
  '#00b4a0': 'var(--dt-colors-charts-categorical-color-03-default)',
  '#10a37f': 'var(--dt-colors-charts-categorical-color-03-default)', // OpenAI green
  
  // Reds (critical/error)
  '#f44336': 'var(--dt-colors-charts-status-critical-default)',
  '#dc172a': 'var(--dt-colors-charts-status-critical-default)',
  '#FF5722': 'var(--dt-colors-charts-status-critical-default)',
  '#ff5722': 'var(--dt-colors-charts-status-critical-default)',
  '#e53935': 'var(--dt-colors-charts-status-critical-default)',
  
  // Oranges/Yellows (warning)
  '#ff9800': 'var(--dt-colors-charts-status-warning-default)',
  '#FF9800': 'var(--dt-colors-charts-status-warning-default)',
  '#f5d30f': 'var(--dt-colors-charts-status-warning-default)',
  '#FFC107': 'var(--dt-colors-charts-status-warning-default)',
  '#ffc107': 'var(--dt-colors-charts-status-warning-default)',
  
  // Blues (categorical/accent)
  '#14a8f5': 'var(--dt-colors-charts-categorical-color-01-default)',
  '#1976d2': 'var(--dt-colors-charts-categorical-color-01-default)',
  '#2196F3': 'var(--dt-colors-charts-categorical-color-01-default)',
  '#42a5f5': 'var(--dt-colors-charts-categorical-color-01-default)',
  
  // Purples
  '#6f2da8': 'var(--dt-colors-charts-categorical-color-02-default)',
  '#7c3aed': 'var(--dt-colors-charts-categorical-color-02-default)',
  '#9c27b0': 'var(--dt-colors-charts-categorical-color-02-default)',
  '#CC785C': 'var(--dt-colors-charts-categorical-color-04-default)', // Anthropic
  
  // Grays (text/neutral) - theme-aware
  '#1f2937': 'var(--dt-colors-text-primary-default)',
  '#374151': 'var(--dt-colors-text-primary-default)',
  '#4b5563': 'var(--dt-colors-text-neutral-default)',
  '#6b7280': 'var(--dt-colors-text-neutral-default)',
  '#9ca3af': 'var(--dt-colors-text-neutral-subdued)',
  '#d1d5db': 'var(--dt-colors-border-neutral-default)',
  '#e5e7eb': 'var(--dt-colors-border-neutral-default)',
  '#e0e0e0': 'var(--dt-colors-border-neutral-default)',
  '#f3f4f6': 'var(--dt-colors-background-surface-default)',
  '#f9fafb': 'var(--dt-colors-background-surface-default)',
  '#f5f5f5': 'var(--dt-colors-background-surface-default)',
};

let totalChanges = 0;
const log = [];

for (const file of allFiles) {
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;
  const rel = path.relative(baseDir, file);
  
  // Skip providerIcons.tsx — brand colors are intentional (logos)
  if (rel.includes('providerIcons')) continue;

  for (const [hex, token] of Object.entries(colorMap)) {
    // Replace in style strings: '#hex' and "#hex"
    c = c.replace(new RegExp("'" + hex.replace('#', '\\#') + "'", 'gi'), "'" + token + "'");
    c = c.replace(new RegExp('"' + hex.replace('#', '\\#') + '"', 'gi'), "'" + token + "'");
    // Replace unquoted in object literals: #hex (but not in comments)
    // This handles: color: '#hex' → color: 'var(...)'
  }
  
  if (c !== orig) {
    fs.writeFileSync(file, c, 'utf8');
    totalChanges++;
    log.push(rel);
  }
}

console.log('Files changed: ' + totalChanges);
log.forEach(l => console.log('  ' + l));
