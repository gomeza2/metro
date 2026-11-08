import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(projectRoot, 'dist');
const html = await readFile(resolve(distRoot, 'index.html'), 'utf8');

function readAssetPath(tag, attribute, label) {
  assert.ok(tag, 'dist/index.html must include a compiled ' + label + ' asset');
  const match = tag.match(new RegExp(attribute + '="([^"]+)"', 'i'));
  assert.ok(match, label + ' tag must include its asset path');
  return match[1];
}

const stylesheetTag = /<link[^>]*\.css[^>]*>/i.exec(html)?.[0] ?? null;
const scriptTag = /<script[^>]*\.js[^>]*>/i.exec(html)?.[0] ?? null;
const stylesheetPath = readAssetPath(stylesheetTag, 'href', 'CSS stylesheet');
const scriptPath = readAssetPath(scriptTag, 'src', 'JavaScript entry');

for (const [label, assetPath] of [['CSS', stylesheetPath], ['JavaScript', scriptPath]]) {
  assert.ok(assetPath.startsWith('./assets/'), label + ' path must be relative for GitHub Pages project sites');
  await stat(resolve(distRoot, assetPath));
}

console.log('Build smoke check passed: relative CSS and JavaScript assets exist in dist.');
