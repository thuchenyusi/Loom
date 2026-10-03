import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname } from 'node:path';
const copies = [
  ['integrations/jekyll/diagram.html', 'integrations/jekyll/example/_includes/diagram.html'],
  ['dist/diagram.min.js', 'integrations/jekyll/example/assets/diagram/diagram.min.js'],
  ['examples/combo.json', 'integrations/jekyll/example/assets/diagrams/combo.json'],
  ['examples/function.json', 'integrations/jekyll/example/assets/diagrams/function.json'],
];
for (const [source, destination] of copies) {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}
console.log('Jekyll demo assets prepared');
