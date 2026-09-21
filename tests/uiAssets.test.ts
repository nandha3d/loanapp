import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const css = readFileSync(join(root, 'app', 'globals.css'), 'utf8');
const materialFontPath = join(root, 'public', 'fonts', 'MaterialIconsOutlined-Regular.otf');

assert.ok(existsSync(materialFontPath), 'Material Icons font should be bundled locally');
assert.match(css, /@font-face\s*{[\s\S]*?font-family:\s*['"]Material Icons Outlined['"]/);
assert.match(css, /\/fonts\/MaterialIconsOutlined-Regular\.otf/);
// Brand logo variants: horizontal & square for dark & light themes
const expectedLogos = [
  join(root, 'public', 'assets', 'logo-horizontal-dark.png'),
  join(root, 'public', 'assets', 'logo-horizontal-light.png'),
  join(root, 'public', 'assets', 'logo-square-dark.png'),
  join(root, 'public', 'assets', 'logo-square-light.png'),
  join(root, 'public', 'logo.png'),
  join(root, 'public', 'favicon.ico'),
  join(root, 'public', 'apple-touch-icon.png'),
  join(root, 'mobile', 'assets', 'images', 'logo-horizontal-dark.png'),
  join(root, 'mobile', 'assets', 'images', 'logo-horizontal-light.png'),
  join(root, 'mobile', 'assets', 'images', 'logo-square-dark.png'),
  join(root, 'mobile', 'assets', 'images', 'logo-square-light.png'),
  join(root, 'mobile', 'assets', 'images', 'app_icon.png'),
  join(root, 'mobile', 'assets', 'images', 'logo.png'),
  join(root, 'mobile', 'android', 'app', 'src', 'main', 'res', 'drawable', 'ic_notification.png'),
  join(root, 'mobile', 'android', 'app', 'src', 'main', 'res', 'mipmap-hdpi', 'launcher_icon.png'),
];

for (const logoPath of expectedLogos) {
  assert.ok(existsSync(logoPath), `Brand asset should exist at: ${logoPath}`);
}

console.log('ui asset tests passed');
