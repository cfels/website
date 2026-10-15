import { readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';

const root = resolve(import.meta.dir, '../static');
const files = await readdir(root, { recursive: true });
const errors = [];
const frameNames = new Set();
const frameTargets = new Set();
let documents = 0;

for (const name of files.filter(name => name.endsWith('.html'))) {
  documents++;
  const path = resolve(root, name);
  const source = await Bun.file(path).text();
  const rewriter = new HTMLRewriter().on('*', {
    element(element) {
      for (const attribute of ['src', 'href']) {
        const value = element.getAttribute(attribute);
        if (!value || /^(https?:|mailto:|#)/.test(value)) continue;
        const localPath = value.split('#')[0];
        const target = value.startsWith('/') ? resolve(root, localPath.slice(1)) : resolve(dirname(path), localPath);
        const documentPath = value.endsWith('/') ? resolve(target, 'index.html') : target;
        if (!files.includes(relative(root, documentPath)) && localPath !== '/files/') errors.push(`${name}: missing ${value}`);
      }
      if (element.tagName === 'frame') frameNames.add(element.getAttribute('name'));
      const target = element.getAttribute('target');
      if (target && !target.startsWith('_')) frameTargets.add(target);
      if (element.tagName === 'img' && element.getAttribute('alt') === null) errors.push(`${name}: image without alt`);
    }
  });
  await rewriter.transform(new Response(source)).text();
  if (!source.includes('name="viewport"')) errors.push(`${name}: missing viewport`);
}
for (const name of ['header', 'main', 'footer']) {
  if (!frameNames.has(name)) errors.push(`Missing real frame: ${name}`);
}
for (const target of frameTargets) {
  if (!frameNames.has(target)) errors.push(`Unknown frame target: ${target}`);
}
const index = await Bun.file(resolve(root, 'index.html')).text();
if (!index.includes('<frameset ') || !index.includes('HTML 4.01 Frameset')) errors.push('Missing legacy frameset');

for (const script of ['../server.js', '../file-host.js', '../request-policy.js', 'files.js', 'frames.js', 'header.js', 'page.js', 'legacy.js', 'service-worker.js', '../scripts/build.js', '../scripts/check.js']) {
  try {
    new Bun.Transpiler({ loader: 'js' }).scan(await Bun.file(resolve(root, script)).text());
  } catch (error) {
    errors.push(`${script}: ${error.message}`);
  }
}
const css = await Bun.build({ entrypoints: [resolve(root, 'site.css'), resolve(root, 'legacy.css')], external: ['*.woff2', '*.eot', '*.png', '*.webp'], write: false });
if (!css.success) errors.push(...css.logs.map(String));

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`${documents} HTML documents checked: local paths, images, real frames, targets, JavaScript syntax, and CSS.`);
