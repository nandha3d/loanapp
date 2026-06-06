const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');

if (fs.existsSync(standaloneDir)) {
  console.log('[POSTBUILD] Copying static assets for standalone server...');
  
  // Copy public/ to .next/standalone/public/
  const publicSrc = path.join(rootDir, 'public');
  const publicDest = path.join(standaloneDir, 'public');
  try {
    fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });
    console.log('[POSTBUILD] Copied public/ to standalone/public/');
  } catch (err) {
    console.warn('[POSTBUILD] Warning: Failed to copy public/ to standalone/', err.message);
  }
  
  // Copy .next/static/ to .next/standalone/.next/static/
  const staticSrc = path.join(rootDir, '.next', 'static');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  try {
    fs.cpSync(staticSrc, staticDest, { recursive: true, force: true });
    console.log('[POSTBUILD] Copied .next/static/ to standalone/.next/static/');
  } catch (err) {
    console.warn('[POSTBUILD] Warning: Failed to copy .next/static/ to standalone/', err.message);
  }
} else {
  console.log('[POSTBUILD] Standalone directory not found, skipping asset copy.');
}
