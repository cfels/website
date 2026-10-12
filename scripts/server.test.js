import { afterAll, beforeAll, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { runInNewContext } from 'node:vm';

let server;
let origin;

beforeAll(async () => {
  server = spawn(process.execPath, [resolve(import.meta.dir, '../server.js')], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  origin = await new Promise((resolveOrigin, reject) => {
    let output = '';
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/Local: (http:\/\/localhost:\d+)/);
      if (match) resolveOrigin(match[1]);
    });
    server.on('error', reject);
    server.on('exit', code => reject(new Error(`Server exited before listening: ${code}`)));
  });
});

afterAll(async () => {
  if (server && server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.kill();
    await stopped;
  }
});

test('production serves actual frames and every separate content document', async () => {
  const paths = ['/', '/header.html', '/footer.html', '/home.html', '/profile.html', '/contact.html', '/links.html', '/gallery.html', '/donate/index.html'];
  for (const path of paths) {
    const response = await fetch(origin + path);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain(path === '/' ? '<frameset ' : '<body');
  }
});

test('old donation URL redirects to its standalone document', async () => {
  const response = await fetch(origin + '/donate', { redirect: 'manual' });
  expect(response.status).toBe(308);
  expect(response.headers.get('location')).toBe('/donate/');
  expect((await fetch(origin + '/donate/')).status).toBe(200);
});

test('assets have correct types, caching, and conditional responses', async () => {
  const response = await fetch(origin + '/assets/konata_cutout.webp');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('image/webp');
  expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
  const cached = await fetch(origin + '/assets/konata_cutout.webp', { headers: { 'If-None-Match': response.headers.get('etag') } });
  expect(cached.status).toBe(304);
  expect((await cached.arrayBuffer()).byteLength).toBe(0);
  const font = await fetch(origin + '/assets/fonts/comic.woff2');
  expect(font.headers.get('content-type')).toContain('font/woff2');
});

test('HEAD returns no body and documents revalidate', async () => {
  const response = await fetch(origin + '/profile.html', { method: 'HEAD' });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-cache');
  expect(await response.text()).toBe('');
});

test('missing pages are real 404s and unsafe paths do not expose files', async () => {
  for (const path of ['/missing/page.html', '/help.html']) {
    const missing = await fetch(origin + path);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("i don't think that page exists!");
  }
  const traversal = await fetch(origin + '/%2e%2e%2fpackage.json');
  expect(traversal.status).toBe(403);
  expect((await fetch(origin + '/%00')).status).toBe(403);
  expect((await fetch(origin + '/%zz')).status).toBe(400);
});

test('unsupported mutations are rejected and security headers allow same-origin frames', async () => {
  const response = await fetch(origin + '/', { method: 'POST' });
  expect(response.status).toBe(405);
  const page = await fetch(origin + '/');
  expect(page.headers.get('x-content-type-options')).toBe('nosniff');
  expect(page.headers.get('content-security-policy')).toContain("frame-src 'self'");
});

test('returning visitors leave the old worker without deleting unrelated caches', async () => {
  const events = new Map();
  const deleted = [];
  const navigated = [];
  let unregistered = false;
  runInNewContext(await Bun.file(resolve(import.meta.dir, '../static/service-worker.js')).text(), {
    self: {
      addEventListener: (name, listener) => events.set(name, listener),
      registration: { unregister: async () => { unregistered = true; } },
      clients: { matchAll: async () => [{ url: '/home.html', navigate: async url => navigated.push(url) }] }
    },
    caches: { keys: async () => ['uma-old', 'another-site'], delete: async name => deleted.push(name) }
  });
  let activation;
  events.get('activate')({ waitUntil: promise => { activation = promise; } });
  await activation;
  expect(deleted).toEqual(['uma-old']);
  expect(unregistered).toBe(true);
  expect(navigated).toEqual(['/home.html']);
});
