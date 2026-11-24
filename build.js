const { execSync } = require('child_process');
const fs = require('fs');

console.log('--- Starting MeplanIQ Production Build ---');
execSync('npm --prefix frontend install', { stdio: 'inherit' });
execSync('npm --prefix frontend run build', { stdio: 'inherit' });

if (fs.existsSync('frontend/dist')) {
  fs.cpSync('frontend/dist', 'dist', { recursive: true });
  console.log('--- Successfully populated dist/ directory for Vercel ---');
}
