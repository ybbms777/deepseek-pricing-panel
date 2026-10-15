// Install a self-contained skill in a NEW destination, from any working directory.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'skills', 'deepseek-pricing-tier');
try {
  if (process.argv.length !== 3 || process.argv[2].startsWith('-')) {
    throw new Error('usage: node install-skill.mjs <new-skill-directory>');
  }
  const destination = path.resolve(process.argv[2]);
  if (existsSync(destination)) throw new Error('destination already exists; choose a new directory: ' + destination);
  if (destination.startsWith(source + path.sep)) throw new Error('destination must be outside the source skill');
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true, errorOnExist: true, force: false });
  cpSync(path.join(root, 'index.html'), path.join(destination, 'index.html'));
  console.log('Installed skill with index.html: ' + destination);
} catch (error) {
  console.error('error: ' + error.message);
  process.exitCode = 2;
}
