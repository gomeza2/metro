import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(projectRoot, 'dist');
const html = await readFile(resolve(distRoot, 'index.html'), 'utf8');

const stylesheet = html.match(/<link\\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+\\.css)["'][^>]*>/i)
  ?? html.match(/<link\\b(?=[^>]*href=["']([^"']+\\.css)["'])[^>]*>/i);
const entryScript = html.match(/<script\\b(?=[^>]*type=["']module["'])(?=[^>]*src=["']([^"']+\\.js)["'])[^>]*>/i);

assert.ok(stylesheet, 'dist/index.html must link a compiled CSS stylesheet');
assert.ok(entryScript, 'dist/index.html must link a compiled JavaScript entry');
const stylesheetPath = stylesheet[1] ?? stylesheet[2];
const scriptPath = entryScript[1] ?? entryScript[2];

for (const [label, assetPath] of [['CSS', stylesheetPath], ['JavaScript', scriptPath]]) {
  assert.ok(assetPath.startsWith('./assets/'), label + ' path must be relative for GitHub Pages project sites');
  await stat(resolve(distRoot, assetPath));
}

console.log('Build smoke check passed: relative CSS and JavaScript assets exist in dist.');
