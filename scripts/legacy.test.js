import { expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = resolve(import.meta.dir, '../static');

test('IE8 initializes desktop frames without matchMedia and older media listeners still resize', async () => {
  const script = await Bun.file(resolve(root, 'frames.js')).text();
  const frameset = {};
  runInNewContext(script, { document: { querySelector: () => frameset }, window: {} });
  expect(frameset.rows).toBe('105,*,58');
  let changed;
  const media = { matches: true, addListener: listener => { changed = listener; } };
  runInNewContext(script, { document: { querySelector: () => frameset }, window: { matchMedia: () => media } });
  expect(frameset.rows).toBe('145,*,124');
  media.matches = false;
  changed();
  expect(frameset.rows).toBe('105,*,58');
});

test('frame navigation works with IE8 click handlers', async () => {
  const buttons = { '[data-back]': {}, '[data-forward]': {}, '[data-reload]': {} };
  const events = [];
  runInNewContext(await Bun.file(resolve(root, 'header.js')).text(), {
    document: { querySelector: selector => buttons[selector] },
    top: {
      history: { back: () => events.push('back'), forward: () => events.push('forward') },
      frames: { main: { location: { reload: () => events.push('reload') } } }
    }
  });
  for (const button of Object.values(buttons)) button.onclick();
  expect(events).toEqual(['back', 'forward', 'reload']);
});

test('legacy setup enables semantic elements and replaces unsupported artwork and gallery links', async () => {
  const elements = [];
  const images = [{ src: 'http://localhost/assets/luckybg_main.webp' }, { src: 'http://localhost/assets/logo.png' }];
  const links = [{ href: 'http://localhost/assets/additions/1.webp' }, { href: 'http://localhost/home.html' }];
  let loaded;
  runInNewContext(await Bun.file(resolve(root, 'legacy.js')).text(), {
    document: {
      createElement: tag => elements.push(tag),
      getElementsByTagName: tag => tag === 'img' ? images : links
    },
    window: { attachEvent: (event, listener) => { expect(event).toBe('onload'); loaded = listener; } }
  });
  expect(elements).toContain('main');
  expect(elements).toContain('figure');
  loaded();
  expect(images.map(image => image.src)).toEqual(['http://localhost/assets/luckybg_main.png', 'http://localhost/assets/logo.png']);
  expect(links.map(link => link.href)).toEqual(['http://localhost/assets/additions/1.png', 'http://localhost/home.html']);
});

test('every content document provides IE8 standards mode, UTF-8, and conditional fallbacks', async () => {
  const files = await readdir(root, { recursive: true });
  for (const name of files.filter(name => name.endsWith('.html'))) {
    const html = await Bun.file(resolve(root, name)).text();
    expect(html).toContain('http-equiv="X-UA-Compatible" content="IE=edge"');
    expect(html).toContain('http-equiv="Content-Type" content="text/html; charset=utf-8"');
    if (name !== 'index.html') {
      expect(html).toContain('<!--[if lte IE 8]>');
      expect(html).toContain('<script src="/legacy.js"></script>');
      expect(html).toContain('<link rel="stylesheet" href="/legacy.css">');
      expect(html.indexOf('/legacy.js')).toBeLessThan(html.indexOf('<body'));
    }
    for (const image of html.matchAll(/(?:src|href)="[^"\s]*assets\/([^"\s]+)\.webp"/g)) {
      const png = new Uint8Array(await Bun.file(resolve(root, 'assets', image[1] + '.png')).arrayBuffer());
      expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    }
  }
  const filesPage = await Bun.file(resolve(root, 'files.html')).text();
  expect(filesPage).toContain('<!--[if gt IE 8]><!-->\n  <script src="/files.js" defer></script>\n  <!--<![endif]-->');
});

test('all website font faces have valid self-hosted EOT fallbacks', async () => {
  const modern = await Bun.file(resolve(root, 'site.css')).text();
  const legacy = await Bun.file(resolve(root, 'legacy.css')).text();
  for (const source of modern.matchAll(/assets\/fonts\/([^']+)\.woff2/g)) {
    expect(legacy).toContain(`assets/fonts/${source[1]}.eot`);
    const bytes = await Bun.file(resolve(root, 'assets/fonts', source[1] + '.eot')).arrayBuffer();
    const header = new DataView(bytes);
    expect(header.getUint32(0, true)).toBe(bytes.byteLength);
    expect(header.getUint32(8, true)).toBe(0x20001);
    expect(header.getUint16(34, true)).toBe(0x504c);
    expect(header.getUint16(32, true) & 0x202).toBe(0);
    const fontOffset = bytes.byteLength - header.getUint32(4, true);
    expect(fontOffset).toBeGreaterThan(82);
    expect(header.getUint32(fontOffset)).toBe(0x10000);
  }
});
