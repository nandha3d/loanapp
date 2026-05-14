import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const css = readFileSync(join(root, 'app', 'globals.css'), 'utf8');
const materialFontPath = join(root, 'public', 'fonts', 'MaterialIconsOutlined-Regular.otf');

assert.ok(existsSync(materialFontPath), 'Material Icons font should be bundled locally');
assert.match(css, /@font-face\s*{[^}]*font-family:\s*['"]Material Icons Outlined['"]/s);
assert.match(css, /\/fonts\/MaterialIconsOutlined-Regular\.otf/);
assert.match(css, /(^|[^-])font-feature-settings:\s*['"]liga['"]/);

console.log('ui asset tests passed');
