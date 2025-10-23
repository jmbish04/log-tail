import { existsSync, rmSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Get directory paths
const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const rootDir = join(scriptDir, '..');
const frontendDir = join(rootDir, 'frontend');
const publicDir = join(rootDir, 'public');

console.log('Starting cross-platform frontend build...');

// Check if frontend/package.json exists
const hasFrontendPackage = existsSync(join(frontendDir, 'package.json'));
if (!hasFrontendPackage) {
  console.log('Skipping frontend build: no frontend/package.json found.');
  process.exit(0);
}

// Check if frontend source files exist
const hasSource = existsSync(join(frontendDir, 'index.html')) || existsSync(join(frontendDir, 'src'));
if (!hasSource) {
  console.log('Skipping frontend build: no frontend source detected.');
  process.exit(0);
}

// Run the frontend build command
console.log('Running npm run build:prod in /frontend...');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const buildResult = spawnSync(npmCommand, ['run', 'build:prod'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: false,
});

// Exit if build fails
if (buildResult.status !== 0) {
  console.error('Frontend build failed.');
  process.exit(buildResult.status ?? 1);
}
console.log('Frontend build successful.');

// Check if dist directory was created
const distDir = join(frontendDir, 'dist');
if (!existsSync(distDir)) {
  console.warn('Frontend build completed but no dist/ directory was produced.');
  process.exit(0);
}

// Clean public directory
console.log(`Cleaning public directory: ${publicDir}`);
rmSync(publicDir, { recursive: true, force: true });

// Copy built assets from dist to public
console.log(`Copying frontend/dist to public/`);
cpSync(distDir, publicDir, { recursive: true });

console.log('Frontend assets copied to public/.');
