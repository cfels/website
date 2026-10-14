import { afterAll, beforeAll, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { runInNewContext } from 'node:vm';
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

let server;
let origin;
let downloadOrigin;

beforeAll(async () => {
  const environment = { ...process.env, HOST: '127.0.0.1', PORT: '0', FILES_DOWNLOAD_PORT: '0', FILES_UPLOAD_TOKEN: '' };
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
      const downloads = output.match(/Downloads: (http:\/\/localhost:\d+)/);
      if (match && downloads) {
        downloadOrigin = downloads[1];
        resolveOrigin(match[1]);
      }
    });
    server.on('error', reject);
    server.on('exit', code => reject(new Error(`Server exited before listening: ${code}`)));
  });
});

test('download listener does not serve website pages, previews, or owner actions', async () => {
  for (const path of ['/', '/home.html', '/files/', '/files/example.txt?view=1', '/files/example.txt?sha256=1', '/api/files/upload']) {
    expect((await fetch(downloadOrigin + path)).status).toBe(404);
  }
  for (const path of ['/api/files/upload', '/api/files/mkdir', '/files/example.txt']) {
    expect((await fetch(downloadOrigin + path, { method: 'POST' })).status).toBe(405);
  }
  expect((await fetch(downloadOrigin + '/%zz')).status).toBe(400);
  expect((await fetch(downloadOrigin + '/files/%00')).status).toBe(403);
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
  const legacyFont = await fetch(origin + '/assets/fonts/comic.eot');
  expect(legacyFont.status).toBe(200);
  expect(legacyFont.headers.get('content-type')).toBe('application/vnd.ms-fontobject');
  expect(legacyFont.headers.get('x-content-type-options')).toBe('nosniff');
  expect((await legacyFont.arrayBuffer()).byteLength).toBeGreaterThan(82);
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

test('static serving denies hidden files and symlinks outside its public directory', async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'website-static-boundary-'));
  let fixtureServer;
  try {
    await mkdir(resolve(fixture, 'files'));
    await mkdir(resolve(fixture, 'build/assets'), { recursive: true });
    for (const file of ['server.js', 'file-host.js', 'request-policy.js', 'build/index.html', 'build/files.html', 'build/404.html']) {
      await copyFile(resolve(import.meta.dir, '..', file), resolve(fixture, file));
    }
    await writeFile(resolve(fixture, 'build/.env'), 'test-only hidden configuration');
    await writeFile(resolve(fixture, 'build/assets/.private.txt'), 'test-only private asset');
    await writeFile(resolve(fixture, 'private.txt'), 'test-only outside data');
    await symlink(resolve(fixture, 'private.txt'), resolve(fixture, 'build/assets/linked.txt'));
    await symlink(resolve(fixture, 'build/assets/.private.txt'), resolve(fixture, 'build/assets/hidden-link.txt'));
    await symlink(fixture, resolve(fixture, 'build/assets/outside'));
    await writeFile(resolve(fixture, 'build/assets/public.txt'), 'public test asset');
    await symlink(resolve(fixture, 'build/assets/public.txt'), resolve(fixture, 'build/assets/public-link.txt'));
    const testToken = 'test-only-proxy-auth-token-at-least-32-characters';
    const environment = { ...process.env, HOST: '127.0.0.1', PORT: '0', FILES_UPLOAD_TOKEN: testToken, TRUSTED_PROXY_IPS: '127.0.0.1' };
    delete environment.FILES_DOWNLOAD_PORT;
    delete environment.FILES_MAX_UPLOAD_MB;
    fixtureServer = spawn(process.execPath, [resolve(fixture, 'server.js')], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
    const fixtureOrigin = await new Promise((resolveOrigin, reject) => {
      let output = '';
      fixtureServer.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/Local: (http:\/\/localhost:\d+)/);
        if (match) resolveOrigin(match[1]);
      });
      fixtureServer.on('error', reject);
      fixtureServer.on('exit', code => reject(new Error(`Server exited before listening: ${code}`)));
    });
    for (const path of ['/.env', '/%2eenv', '/assets/.private.txt', '/assets/linked.txt', '/assets/hidden-link.txt', '/assets/outside/private.txt']) {
      const response = await fetch(fixtureOrigin + path);
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain('test-only');
      expect((await fetch(fixtureOrigin + path, { method: 'HEAD' })).status).toBe(403);
    }
    const publicAsset = await fetch(fixtureOrigin + '/assets/public-link.txt');
    expect(publicAsset.status).toBe(200);
    expect(await publicAsset.text()).toBe('public test asset');
    const requestHeaders = { Authorization: `Bearer ${testToken}`, 'X-File-Name': 'secure-folder' };
    expect((await fetch(fixtureOrigin + '/api/files/mkdir', { method: 'POST', headers: requestHeaders })).status).toBe(403);
    const insecurePage = await (await fetch(fixtureOrigin + '/files/')).text();
    expect(insecurePage).not.toContain('id="owner-tools"');
    const securePage = await fetch(fixtureOrigin + '/files/', { headers: { 'X-Forwarded-Proto': 'https' } });
    expect(securePage.headers.get('strict-transport-security')).toBe('max-age=31536000');
    expect(await securePage.text()).toContain('id="owner-tools"');
    expect((await fetch(fixtureOrigin + '/api/files/mkdir', { method: 'POST', headers: { ...requestHeaders, 'X-Forwarded-Proto': 'https' } })).status).toBe(201);
    const untrustedStatus = await new Promise((resolveStatus, reject) => {
      const url = new URL(fixtureOrigin);
      const socket = createConnection({ host: '127.0.0.1', port: Number(url.port), localAddress: '127.0.0.2' });
      socket.setTimeout(3000, () => { socket.destroy(); reject(new Error('Untrusted peer response timed out')); });
      socket.on('error', reject);
      socket.on('connect', () => socket.write(`POST /api/files/mkdir HTTP/1.1\r\nHost: ${url.host}\r\nAuthorization: Bearer ${testToken}\r\nX-File-Name: untrusted\r\nX-Forwarded-Proto: https\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`));
      let output = '';
      socket.on('data', chunk => {
        output += chunk;
        const match = output.match(/^HTTP\/1\.1 (\d+)/);
        if (match) { socket.destroy(); resolveStatus(Number(match[1])); }
      });
    });
    expect(untrustedStatus).toBe(403);
    expect(await Bun.file(resolve(fixture, 'files/untrusted')).exists()).toBe(false);
  } finally {
    if (fixtureServer && fixtureServer.exitCode === null) {
      const stopped = once(fixtureServer, 'exit');
      fixtureServer.kill();
      await stopped;
    }
    await rm(fixture, { recursive: true, force: true });
  }
});

test('production errors do not expose source code even when NODE_ENV enables development', async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'website-production-error-'));
  let fixtureServer;
  try {
    await mkdir(resolve(fixture, 'files'));
    await mkdir(resolve(fixture, 'build'));
    for (const file of ['server.js', 'file-host.js', 'request-policy.js', 'build/index.html', 'build/files.html']) {
      await copyFile(resolve(import.meta.dir, '..', file), resolve(fixture, file));
    }
    const environment = { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '0', FILES_UPLOAD_TOKEN: '' };
    delete environment.FILES_MAX_UPLOAD_MB;
    fixtureServer = spawn(process.execPath, [resolve(fixture, 'server.js')], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
    const fixtureOrigin = await new Promise((resolveOrigin, reject) => {
      let output = '';
      fixtureServer.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/Local: (http:\/\/localhost:\d+)/);
        if (match) resolveOrigin(match[1]);
      });
      fixtureServer.on('error', reject);
      fixtureServer.on('exit', code => reject(new Error(`Server exited before listening: ${code}`)));
    });
    const response = await fetch(fixtureOrigin + '/missing-page');
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain(fixture);
    expect(body).not.toContain('server.js');
    expect(body).not.toContain('FILES_UPLOAD_TOKEN');
    expect(body).not.toContain('const headers');
  } finally {
    if (fixtureServer && fixtureServer.exitCode === null) {
      const stopped = once(fixtureServer, 'exit');
      fixtureServer.kill();
      await stopped;
    }
    await rm(fixture, { recursive: true, force: true });
  }
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
