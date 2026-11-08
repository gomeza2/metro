import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = process.argv.includes('--root') ? projectRoot : resolve(projectRoot, 'dist');
const html = await readFile(resolve(distRoot, 'index.html'), 'utf8');
assert.ok(!html.includes('id="loading-screen"'), 'The production entry must open the menu without a blocking loader');
assert.match(html, /<html[^>]*lang="es"/, 'The published game must declare Spanish');
assert.ok(!html.includes('media="print"'), 'Game CSS must load normally without onload/media gating');

function readAssetPath(tag, attribute, label) {
  assert.ok(tag, 'dist/index.html must include a compiled ' + label + ' asset');
  const match = tag.match(new RegExp(attribute + '="([^"]+)"', 'i'));
  assert.ok(match, label + ' tag must include its asset path');
  return match[1];
}

const stylesheetTags = html.match(/<link[^>]*\.css[^>]*>/gi) ?? [];
const scriptTags = html.match(/<script[^>]*\.js[^>]*>/gi) ?? [];
assert.ok(stylesheetTags.length > 0, 'Production HTML must load CSS');
assert.ok(scriptTags.length > 0, 'Production HTML must load JavaScript');
for (const [label, tags, attribute] of [['CSS', stylesheetTags, 'href'], ['JavaScript', scriptTags, 'src']]) {
  for (const tag of tags) {
    const assetPath = readAssetPath(tag, attribute, label);
    assert.ok(assetPath.startsWith('./assets/'), label + ' path must be relative for GitHub Pages project sites');
    await stat(resolve(distRoot, assetPath));
  }
}

console.log('Build smoke check passed: relative CSS and JavaScript assets exist in dist.');

const pkg = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'));
assert.ok(html.includes(`name="cityflow-version" content="${pkg.version}"`), 'Published HTML must identify the package version');
assert.ok(!html.includes('./src/'), 'Production HTML must not load source assets');
