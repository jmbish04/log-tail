import { existsSync, rmSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const rootDir = join(scriptDir, '..');
const frontendDir = join(rootDir, 'frontend');
const publicDir = join(rootDir, 'public');

const hasFrontendPackage = existsSync(join(frontendDir, 'package.json'));
if (!hasFrontendPackage) {
  console.log('Skipping frontend build: no frontend/package.json found.');
  process.exit(0);
}

const hasSource = existsSync(join(frontendDir, 'index.html')) || existsSync(join(frontendDir, 'src'));
if (!hasSource) {
  console.log('Skipping frontend build: no frontend source detected.');
  process.exit(0);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const buildResult = spawnSync(npmCommand, ['run', 'build:prod'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: false,
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const distDir = join(frontendDir, 'dist');
if (!existsSync(distDir)) {
  console.warn('Frontend build completed but no dist/ directory was produced.');
  process.exit(0);
}

rmSync(publicDir, { recursive: true, force: true });
cpSync(distDir, publicDir, { recursive: true });

console.log('Frontend assets copied to public/.');
