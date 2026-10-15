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
  const listeners = [];
  const narrow = { matches: true, addListener: listener => listeners.push(listener) };
  const compact = { matches: false, addListener: listener => listeners.push(listener) };
  runInNewContext(script, { document: { querySelector: () => frameset }, window: { matchMedia: query => query.includes('359px') ? compact : narrow } });
  expect(frameset.rows).toBe('137,*,87');
  expect(listeners).toHaveLength(2);
  compact.matches = true;
  listeners[1]();
  expect(frameset.rows).toBe('137,*,120');
  narrow.matches = false;
  listeners[0]();
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

test('standalone content keeps its navigation and footer while framed content avoids duplicate bars', async () => {
  const script = await Bun.file(resolve(root, 'page.js')).text();
  for (const framed of [false, true]) {
    const bars = [];
    const viewport = { className: '' };
    const window = {};
    window.self = window;
    window.top = framed ? {} : window;
    runInNewContext(script, {
      window,
      document: {
        documentElement: viewport,
        createElement: tag => ({ tag, setAttribute(name, value) { this[name] = value; } }),
        body: { appendChild: element => bars.push(element) }
      }
    });
    if (framed) {
      expect(bars).toHaveLength(0);
      expect(viewport.className).toBe('');
    } else {
      expect(viewport.className.trim()).toBe('standalone-page');
      expect(bars.map(bar => [bar.tag, bar.src, bar.title, bar.frameborder])).toEqual([
        ['iframe', '/header.html', 'Site navigation', '0'],
        ['iframe', '/footer.html', 'Buttons and source link', '0']
      ]);
      for (const bar of bars) {
        const links = [{ target: 'main' }, { target: 'main' }];
        bar.contentWindow = { document: { querySelectorAll: selector => selector === 'a[target="main"]' ? links : [] } };
        bar.onload();
        expect(links.map(link => link.target)).toEqual(['_top', '_top']);
      }
    }
  }
});

test('the toolbar reloads standalone content when there is no main frame', async () => {
  const buttons = { '[data-back]': {}, '[data-forward]': {}, '[data-reload]': {} };
  let reloads = 0;
  runInNewContext(await Bun.file(resolve(root, 'header.js')).text(), {
    document: { querySelector: selector => buttons[selector] },
    top: { frames: {}, location: { reload: () => reloads++ } }
  });
  buttons['[data-reload]'].onclick();
  expect(reloads).toBe(1);
});

test('menu shortcuts use the Latin font instead of the Japanese subset', async () => {
  const labels = [];
  const japanese = [];
  const rewriter = new HTMLRewriter()
    .on('.menubar a', {
      element(element) { expect(element.getAttribute('lang')).toBeNull(); },
      text(chunk) { labels.push(chunk.text); }
    })
    .on('.menubar [lang="ja"]', {
      text(chunk) { japanese.push(chunk.text); }
    });
  await rewriter.transform(new Response(await Bun.file(resolve(root, 'header.html')).text())).text();
  expect(labels.join('')).toBe('ファイル(F)表示(V)ブックマーク(B)Files');
  expect(japanese.join('')).toBe('ファイル表示ブックマーク');
});

test('legacy setup enables semantic elements and replaces unsupported artwork and gallery links', async () => {
  const elements = [];
  const images = [{ src: 'http://localhost/assets/luckybg_main.webp' }, { src: 'http://localhost/assets/logo.png' }, { src: 'http://localhost/assets/additions/1.webp', className: 'fan-stamp' }];
  const links = [{ href: 'http://localhost/assets/additions/1.webp' }, { href: 'http://localhost/home.html' }];
  const handlers = {};
  runInNewContext(await Bun.file(resolve(root, 'legacy.js')).text(), {
    document: {
      createElement: tag => elements.push(tag),
      getElementsByTagName: tag => tag === 'img' ? images : links,
      querySelector: () => null
    },
    window: { attachEvent: (event, listener) => { handlers[event] = listener; } }
  });
  expect(elements).toContain('main');
  expect(elements).toContain('figure');
  handlers.onload();
  expect(typeof handlers.onresize).toBe('function');
  expect(images.map(image => image.src)).toEqual(['http://localhost/assets/luckybg_main.png', 'http://localhost/assets/logo.png', 'http://localhost/assets/additions/1-stamp.png']);
  expect(links.map(link => link.href)).toEqual(['http://localhost/assets/additions/1.png', 'http://localhost/home.html']);
});

test('legacy navigation fits its frame on load and resize without losing body classes', async () => {
  const style = {};
  const container = { style, get clientWidth() { return parseInt(style.width, 10) - 2; } };
  const address = { style: {}, offsetLeft: 174 };
  const star = { offsetWidth: 23 };
  const body = { className: 'header-document' };
  const viewport = { clientWidth: 1024 };
  const handlers = {};
  let storedWidth = '';
  let widthWrites = 0;
  Object.defineProperty(style, 'width', {
    get: () => storedWidth,
    set(value) { storedWidth = value; widthWrites++; if (handlers.onresize) handlers.onresize(); }
  });
  const selectors = { '.site, .browser-chrome, .footer-strip': container, '.address': address, '.toolbar-star': star };
  runInNewContext(await Bun.file(resolve(root, 'legacy.js')).text(), {
    document: {
      createElement() {},
      getElementsByTagName: () => [],
      querySelector: selector => selectors[selector] || null,
      documentElement: viewport,
      body
    },
    window: { attachEvent: (event, listener) => { handlers[event] = listener; } }
  });
  handlers.onload();
  expect(style.width).toBe('800px');
  expect(widthWrites).toBe(1);
  expect(address.style.width).toBe('573px');
  expect(body.className).toBe('header-document');
  viewport.clientWidth = 780;
  handlers.onresize();
  expect(style.width).toBe('780px');
  expect(address.style.width).toBe('553px');
  handlers.onresize();
  expect(body.className.trim().split(/\s+/)).toEqual(['header-document', 'legacy-narrow']);
  expect(widthWrites).toBe(2);
  viewport.clientWidth = 1024;
  handlers.onresize();
  expect(body.className.trim()).toBe('header-document');
});

test('legacy pages fit the available height including padding after vertical resizing', async () => {
  const container = { style: {}, className: 'site' };
  const viewport = { clientWidth: 800, clientHeight: 600 };
  const handlers = {};
  runInNewContext(await Bun.file(resolve(root, 'legacy.js')).text(), {
    document: {
      createElement() {},
      getElementsByTagName: () => [],
      querySelector: selector => selector === '.site, .browser-chrome, .footer-strip' ? container : null,
      documentElement: viewport,
      body: { className: '' }
    },
    window: { attachEvent: (event, listener) => { handlers[event] = listener; } }
  });
  handlers.onload();
  expect(container.style.minHeight).toBe('577px');
  viewport.clientHeight = 480;
  handlers.onresize();
  expect(container.style.minHeight).toBe('457px');
  viewport.clientHeight = 10;
  handlers.onresize();
  expect(container.style.minHeight).toBe('0px');
  viewport.className = 'standalone-page';
  viewport.clientHeight = 600;
  handlers.onresize();
  expect(container.style.minHeight).toBe('0px');
});

test('legacy footer buttons fill a single row at desktop and narrow frame widths', async () => {
  const style = {};
  const container = { style };
  const items = Array.from({ length: 7 }, () => ({ style: {}, offsetWidth: 88 }));
  const strip = { children: items, get clientWidth() { return parseInt(style.width, 10); } };
  const viewport = { clientWidth: 1024 };
  const handlers = {};
  runInNewContext(await Bun.file(resolve(root, 'legacy.js')).text(), {
    document: {
      createElement() {},
      getElementsByTagName: () => [],
      querySelector: selector => selector === '.site, .browser-chrome, .footer-strip' ? container : selector === '.button-strip' ? strip : null,
      documentElement: viewport,
      body: { className: 'footer-document' }
    },
    window: { attachEvent: (event, listener) => { handlers[event] = listener; } }
  });
  for (const width of [1024, 780]) {
    viewport.clientWidth = width;
    handlers.onload();
    const rowWidth = items.reduce((total, item) => total + item.offsetWidth + parseFloat(item.style.margin.slice(2)) * 2, 18);
    expect(rowWidth).toBeCloseTo(Math.min(width, 800));
    expect(items.every(item => parseFloat(item.style.margin.slice(2)) >= 0)).toBe(true);
  }
});

test('legacy file search fits the input beside its button and show-all link after resizing', async () => {
  const container = { style: {}, className: 'site' };
  const viewport = { clientWidth: 1024, clientHeight: 600 };
  const input = { style: {} };
  const controls = { input, button: { offsetWidth: 56 }, a: { offsetWidth: 48 } };
  const search = { get clientWidth() { return parseInt(container.style.width, 10) - 48; }, querySelector: selector => controls[selector] };
  const handlers = {};
  const selectors = { '.site, .browser-chrome, .footer-strip': container, '.file-search': search };
  runInNewContext(await Bun.file(resolve(root, 'legacy.js')).text(), {
    document: {
      createElement() {},
      getElementsByTagName: () => [],
      querySelector: selector => selectors[selector] || null,
      documentElement: viewport,
      body: { className: '' }
    },
    window: { attachEvent: (event, listener) => { handlers[event] = listener; } }
  });
  handlers.onload();
  expect(input.style.width).toBe('636px');
  viewport.clientWidth = 780;
  handlers.onresize();
  expect(input.style.width).toBe('616px');
});

test('all PNG artwork uses XP-compatible bit depths and the sidebar crop stays short', async () => {
  const files = await readdir(resolve(root, 'assets'), { recursive: true });
  for (const path of files.filter(path => path.endsWith('.png'))) {
    const bytes = await Bun.file(resolve(root, 'assets', path)).arrayBuffer();
    const png = new DataView(bytes);
    expect(png.getUint8(24)).toBeLessThanOrEqual(8);
  }
  const crop = new DataView(await Bun.file(resolve(root, 'assets/additions/1-stamp.png')).arrayBuffer());
  expect(crop.getUint32(16)).toBe(300);
  expect(crop.getUint32(20)).toBe(83);
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
      if (name !== 'header.html' && name !== 'footer.html') expect(html).toContain('<script src="/page.js" defer></script>');
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
  }
  for (const source of legacy.matchAll(/assets\/fonts\/([^']+)\.eot/g)) {
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
