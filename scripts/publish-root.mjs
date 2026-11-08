// Publish the verified dist output at main/root as well as through Pages Actions.
// Run explicitly after build; normal development/build does not overwrite sources.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
if (html.includes('./src/') || html.includes('./boot.ts') || !html.includes('./assets/')) {
  throw new Error('Build production output before publishing main/root.');
}
// assets/ is generated and owned by this command. Source assets belong in src/.
await rm(`${root}assets`, { recursive:true, force:true });
await mkdir(`${root}assets`, { recursive:true });
await cp(`${root}dist/assets`, `${root}assets`, { recursive:true });
await writeFile(`${root}index.html`, html);
await writeFile(`${root}.nojekyll`, '');
console.log('main/root site synchronized from the verified production build.');
