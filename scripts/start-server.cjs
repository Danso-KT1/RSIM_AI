const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const serverFile = path.join(process.cwd(), 'dist', 'server.cjs');

// If dist/server.cjs does not exist, build the project automatically before starting
if (!fs.existsSync(serverFile)) {
  console.log('⚡ dist/server.cjs not found. Triggering automated production build...');
  try {
    const isBun = typeof process.versions.bun !== 'undefined' || (fs.existsSync(path.join(process.cwd(), 'bun.lock')) && !process.env.USE_NPM);
    const buildCmd = isBun ? 'bun run build' : 'npm run build';
    console.log(`🔨 Running build command: ${buildCmd}`);
    execSync(buildCmd, { stdio: 'inherit' });
    console.log('✅ Automated production build completed successfully.');
  } catch (err) {
    console.error('❌ Build failed with error:', err.message);
    process.exit(1);
  }
}

if (!fs.existsSync(serverFile)) {
  console.error(`❌ Fatal: Server build file still not found at ${serverFile}`);
  process.exit(1);
}

console.log('🚀 Launching RSIM AI Server...');
require(serverFile);
