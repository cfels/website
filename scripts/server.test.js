import { afterAll, beforeAll, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { runInNewContext } from 'node:vm';

let server;
let origin;

beforeAll(async () => {
  const environment = { ...process.env, HOST: '127.0.0.1', PORT: '0', FILES_UPLOAD_TOKEN: '' };
  delete environment.FILES_MAX_UPLOAD_MB;
  server = spawn(process.execPath, [resolve(import.meta.dir, '../server.js')], {
    env: environment,
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
  const paths = ['/', '/header.html', '/footer.html', '/home.html', '/profile.html', '/contact.html', '/links.html', '/gallery.html', '/donate/index.html', '/files/'];
  for (const path of paths) {
    const response = await fetch(origin + path);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain(path === '/' ? '<frameset ' : '<body');
  }
});

test('the file host is linked from navigation and uploads are disabled without a token', async () => {
  const header = await (await fetch(origin + '/header.html')).text();
  expect(header).toContain('href="/files/" target="main"');
  const files = await fetch(origin + '/files', { redirect: 'manual' });
  expect(files.status).toBe(308);
  expect(files.headers.get('location')).toBe('/files/');
  expect((await fetch(origin + '/files.html', { redirect: 'manual' })).status).toBe(308);
  expect((await fetch(origin + '/api/files/upload', { method: 'POST' })).status).toBe(503);
  expect((await fetch(origin + '/api/files/mkdir', { method: 'POST' })).status).toBe(503);
  const profile = await (await fetch(origin + '/profile.html')).text();
  for (const hardware of ['Ryzen 5 7600', 'Radeon 6800XT', '32GB DDR5', 'Lexar SSD NM790 1TB', 'Lexar SSD NM620 1TB', 'Samsung NP300E5C-A04PL', 'ThinkPad T470', 'vivo X90 Pro Plus', 'OnePlus 7 Pro', 'Huawei P60 Pro', 'Samsung A53', 'Huion H950P', 'Broken Xbox 360', '500GB Seagate', '320GB WD', '80GB WD', '1× ESP32-S3', '2× NodeMCU v3 ESP32']) expect(profile).toContain(hardware);
});

test('production accepts declared 10 GiB requests and rejects one byte over the limit', async () => {
  function declaredUpload(size) {
    return new Promise((resolveStatus, reject) => {
      const url = new URL(origin);
      const socket = createConnection({ host: '127.0.0.1', port: Number(url.port) });
      socket.setTimeout(3000, () => {
        socket.destroy();
        reject(new Error('Upload header response timed out'));
      });
      socket.on('error', reject);
      socket.on('connect', () => socket.write(`POST /api/files/upload HTTP/1.1\r\nHost: ${url.host}\r\nContent-Length: ${size}\r\nConnection: close\r\n\r\n`));
      let output = '';
      socket.on('data', chunk => {
        output += chunk;
        const match = output.match(/^HTTP\/1\.1 (\d+)/);
        if (match) {
          socket.destroy();
          resolveStatus(Number(match[1]));
        }
      });
    });
  }
  expect(await declaredUpload(10737418240)).toBe(503);
  expect(await declaredUpload(10737418241)).toBe(413);
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
