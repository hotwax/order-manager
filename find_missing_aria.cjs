const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.vue')) {
      results.push(file);
    }
  });
  return results;
}

const vueFiles = walk('./src');
let missing = [];

vueFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Use a regex to find <ion-button ...> ... </ion-button> blocks
  // that don't have aria-label and have icon-only

  const buttonRegex = /<ion-button[^>]*>[\s\S]*?<\/ion-button>/g;
  let match;
  while ((match = buttonRegex.exec(content)) !== null) {
    const block = match[0];
    if (block.includes('slot="icon-only"') && !block.includes('aria-label')) {
      missing.push({ file, block: block.trim() });
    }
  }
});

console.log(JSON.stringify(missing, null, 2));
