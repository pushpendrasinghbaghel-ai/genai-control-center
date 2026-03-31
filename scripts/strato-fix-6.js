// Phase 6: Final hex color cleanup — replace ALL remaining unique hex colors
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

// Remaining color mapping
const colorMap = {
  // Orange/amber
  '#ef8b2f': 'var(--dt-colors-charts-categorical-color-04-default)',
  '#f5a623': 'var(--dt-colors-charts-status-warning-default)',
  '#f59e0b': 'var(--dt-colors-charts-status-warning-default)',
  '#d97706': 'var(--dt-colors-charts-status-warning-default)',
  '#d29922': 'var(--dt-colors-charts-status-warning-default)',
  '#c99700': 'var(--dt-colors-charts-status-warning-default)',
  '#ff9900': 'var(--dt-colors-charts-categorical-color-04-default)', // AWS orange
  '#ff7000': 'var(--dt-colors-charts-categorical-color-04-default)',
  '#c07f4c': 'var(--dt-colors-charts-categorical-color-04-default)',
  
  // Pink/Red
  '#e6457a': 'var(--dt-colors-charts-categorical-color-05-default)',
  '#e74c3c': 'var(--dt-colors-charts-status-critical-default)',
  '#ef4444': 'var(--dt-colors-charts-status-critical-default)',
  '#dc2626': 'var(--dt-colors-charts-status-critical-default)',
  '#b91c1c': 'var(--dt-colors-charts-status-critical-default)',
  '#cf222e': 'var(--dt-colors-charts-status-critical-default)',
  
  // Blues
  '#2ab6f4': 'var(--dt-colors-charts-categorical-color-01-default)',
  '#3498db': 'var(--dt-colors-charts-categorical-color-01-default)',
  '#1b7fc4': 'var(--dt-colors-charts-categorical-color-01-default)',
  '#0078d4': 'var(--dt-colors-charts-categorical-color-01-default)', // Azure blue
  '#4285f4': 'var(--dt-colors-charts-categorical-color-01-default)', // Google blue
  '#3b82f6': 'var(--dt-colors-charts-categorical-color-01-default)',
  
  // Purples
  '#9b59b6': 'var(--dt-colors-charts-categorical-color-02-default)',
  '#6366f1': 'var(--dt-colors-charts-categorical-color-06-default)', // Indigo
  '#7b61ff': 'var(--dt-colors-charts-categorical-color-06-default)',
  
  // Greens/Teals  
  '#2ab6a4': 'var(--dt-colors-charts-categorical-color-03-default)',
  '#1abc9c': 'var(--dt-colors-charts-categorical-color-03-default)',
  '#2ea043': 'var(--dt-colors-charts-status-good-default)',
  '#39594d': 'var(--dt-colors-charts-categorical-color-07-default)',
  
  // Grays
  '#34495e': 'var(--dt-colors-text-neutral-default)',
  '#ffffff': 'var(--dt-colors-text-primary-inverse)',
};

let totalChanges = 0;
const log = [];

for (const file of allFiles) {
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;
  const rel = path.relative(baseDir, file);

  for (const [hex, token] of Object.entries(colorMap)) {
    const escaped = hex.replace('#', '\\#');
    c = c.replace(new RegExp("'" + escaped + "'", 'gi'), "'" + token + "'");
    c = c.replace(new RegExp('"' + escaped + '"', 'gi'), "'" + token + "'");
  }

  if (c !== orig) {
    fs.writeFileSync(file, c, 'utf8');
    totalChanges++;
    log.push(rel);
  }
}

console.log('Files changed: ' + totalChanges);
log.forEach(l => console.log('  ' + l));
