import { afterAll, beforeAll, expect, test } from 'bun:test';
import { link, mkdir, mkdtemp, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createFileHost, defaultMaxUploadBytes } from '../file-host.js';

let fixture;
let root;
let host;
let server;
let origin;
const token = 'test-only-owner-token-with-at-least-32-characters';
const limit = 1024;

beforeAll(async () => {
  fixture = await mkdtemp(resolve(tmpdir(), 'website-files-'));
  root = resolve(fixture, 'files');
  await mkdir(resolve(root, 'nested'), { recursive: true });
  await writeFile(resolve(fixture, 'private.txt'), 'outside secret');
  await writeFile(resolve(root, 'hello.txt'), 'hello ☆');
  await writeFile(resolve(root, 'nested', 'inside.txt'), 'nested download');
  await writeFile(resolve(root, '<script>&".html'), '<script>alert(1)</script>');
  await writeFile(resolve(root, '空 file #%.txt'), 'unicode file');
  await writeFile(resolve(root, '.secret'), 'hidden file');
  await symlink(resolve(fixture, 'private.txt'), resolve(root, 'outside-link'));
  await symlink(fixture, resolve(root, 'outside-directory'));
  await symlink(resolve(root, 'hello.txt'), resolve(root, 'inside-link'));
  await link(resolve(fixture, 'private.txt'), resolve(root, 'outside-hardlink'));
  host = await createFileHost(root, await Bun.file(resolve(import.meta.dir, '../static/files.html')).text(), { uploadToken: token, maxUploadBytes: limit });
  server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === '/api/files/upload') return host.upload(request);
      if (url.pathname === '/api/files/mkdir') return host.createFolder(request);
      try {
        return host.download(request, decodeURIComponent(url.pathname));
      } catch {
        return new Response('Bad request', { status: 400 });
      }
    }
  });
  origin = server.url.origin;
});

afterAll(async () => {
  if (server) await server.stop(true);
  if (host) await host.close();
  if (fixture) await rm(fixture, { recursive: true, force: true });
});

function upload(name, body = 'uploaded file', authorization = `Bearer ${token}`, headers = {}) {
  return fetch(origin + '/api/files/upload', {
    method: 'POST',
    headers: { Authorization: authorization, 'X-File-Name': encodeURIComponent(name), ...headers },
    body
  });
}

function createFolder(name, folder = '', authorization = `Bearer ${token}`) {
  return fetch(origin + '/api/files/mkdir', {
    method: 'POST',
    headers: { Authorization: authorization, 'X-File-Name': encodeURIComponent(name), 'X-File-Folder': encodeURIComponent(folder) }
  });
}

test('lists folders and files, escapes names, and excludes hidden entries and links', async () => {
  const response = await fetch(origin + '/files/');
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const html = await response.text();
  expect(html).toContain('id="folder-path">C:\\files\\</h2>');
  expect(html).toContain('/files/nested/');
  expect(html).toContain('hello.txt');
  expect(html).toContain('&lt;script&gt;&amp;&quot;.html');
  expect(html).not.toContain('<script>&');
  for (const name of ['.secret', 'outside-link', 'outside-directory', 'inside-link', 'outside-hardlink']) expect(html).not.toContain(name);
  expect(html).toContain('id="upload-form"');
  expect(html).not.toContain(token);
  const nested = await (await fetch(origin + '/files/nested/')).text();
  expect(nested).toContain('inside.txt');
  expect(nested).toContain('href="/files/">..\\');
  expect(nested).toContain('id="folder-path">C:\\files\\nested\\</h2>');
  expect(nested).toContain('id="upload-form"');
  expect(nested).toContain('id="folder-form"');
  expect(nested).toContain('data-folder="nested"');
  expect(nested).toContain('href="/files/nested/">Refresh');
});

test('search filters names in the current folder without changing download URLs', async () => {
  const response = await fetch(origin + '/files/?q=HELLO');
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain('href="/files/hello.txt"');
  expect(html).toContain('1 match for “HELLO”');
  expect(html).not.toContain('href="/files/nested/"');
  expect(html).not.toContain('空 file #%.txt');
  const folders = await (await fetch(origin + '/files/?q=NESTED')).text();
  expect(folders).toContain('href="/files/nested/"');
  expect(folders).not.toContain('href="/files/hello.txt"');
  const unicode = await (await fetch(origin + '/files/?q=' + encodeURIComponent('空'))).text();
  expect(unicode).toContain('空 file #%.txt');
  expect(unicode).toContain('1 match for “空”');
});

test('nested search stays in its folder and supports clearing or empty results', async () => {
  const root = await (await fetch(origin + '/files/?q=inside')).text();
  expect(root).toContain('No matching files or folders.');
  const nested = await (await fetch(origin + '/files/nested/?q=INSIDE')).text();
  expect(nested).toContain('href="/files/nested/inside.txt"');
  expect(nested).toContain('action="/files/nested/"');
  expect(nested).toContain('id="search-clear" href="/files/nested/"');
  expect(nested).toContain('href="/files/">..\\');
  const noMatches = await (await fetch(origin + '/files/nested/?q=missing')).text();
  expect(noMatches).toContain('No matching files or folders.');
  expect(noMatches).toContain('0 matches for “missing”');
  const cleared = await (await fetch(origin + '/files/?q=%20%20')).text();
  expect(cleared).toContain('href="/files/hello.txt"');
  expect(cleared).toContain('href="/files/nested/"');
});

test('search preserves hidden-file restrictions and safely renders untrusted query text', async () => {
  const privateSearch = await (await fetch(origin + '/files/?q=secret')).text();
  expect(privateSearch).toContain('No matching files or folders.');
  for (const name of ['.secret', 'outside secret']) expect(privateSearch).not.toContain(name);
  const linkSearch = await (await fetch(origin + '/files/?q=outside')).text();
  expect(linkSearch).toContain('No matching files or folders.');
  const query = '<script>alert(1)</script>" onfocus="evil &amp;';
  const html = await (await fetch(origin + '/files/?q=' + encodeURIComponent(query))).text();
  expect(html).not.toContain('<script>alert(1)</script>');
  let injectedAttribute = false;
  await new HTMLRewriter().on('*', { element(element) {
    if (element.getAttribute('onfocus') !== null) injectedAttribute = true;
  } }).transform(new Response(html)).text();
  expect(injectedAttribute).toBe(false);
  expect((await fetch(origin + '/files/?q=' + 'x'.repeat(256))).status).toBe(400);
});

test('downloads stream original bytes with attachment headers and support HEAD', async () => {
  const response = await fetch(origin + '/files/hello.txt');
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('hello ☆');
  expect(response.headers.get('content-disposition')).toContain("filename*=UTF-8''hello.txt");
  expect(response.headers.get('content-type')).toBe('application/octet-stream');
  expect(response.headers.get('content-security-policy')).toContain('sandbox');
  const head = await fetch(origin + '/files/hello.txt', { method: 'HEAD' });
  expect(head.status).toBe(200);
  expect(head.headers.get('content-length')).toBe(String(Buffer.byteLength('hello ☆')));
  expect(await head.text()).toBe('');
  const unicode = await fetch(origin + '/files/' + encodeURIComponent('空 file #%.txt'));
  expect(await unicode.text()).toBe('unicode file');
  const redirect = await fetch(origin + '/files/nested', { redirect: 'manual' });
  expect(redirect.status).toBe(308);
  expect(redirect.headers.get('location')).toBe('/files/nested/');
});

test('rejects traversal, hidden paths, links, unsupported methods, and nonexistent files', async () => {
  for (const path of ['%2e%2e%2fprivate.txt', '%2fetc%2fpasswd', 'nested%2f..%2f..%2fprivate.txt', 'nested%5c..%5cprivate.txt', '%00', '.secret', '//hello.txt']) {
    expect((await fetch(origin + '/files/' + path)).status).toBe(403);
  }
  for (const path of ['outside-link', 'outside-directory/private.txt', 'inside-link', 'outside-hardlink', 'missing', 'hello.txt/']) {
    const response = await fetch(origin + '/files/' + path);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('outside secret');
  }
  expect((await fetch(origin + '/files/', { method: 'DELETE' })).status).toBe(405);
  expect((await fetch(origin + '/api/files/upload')).status).toBe(405);
});

test('owner authentication is required before creating uploads', async () => {
  for (const authorization of ['', 'Bearer incorrect', `Basic ${token}`]) {
    expect((await upload('unauthorized.txt', 'not allowed', authorization)).status).toBe(401);
  }
  expect(await Bun.file(resolve(root, 'unauthorized.txt')).exists()).toBe(false);
  expect((await upload('cross-site.txt', 'not allowed', undefined, { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403);
  expect((await createFolder('unauthorized-folder', '', 'Bearer incorrect')).status).toBe(401);
  expect((await fetch(origin + '/api/files/mkdir')).status).toBe(405);
});

test('owners can create folders and upload files into nested folders without replacing entries', async () => {
  const response = await createFolder('new folder ☆');
  expect(response.status).toBe(201);
  const created = await response.json();
  expect((await fetch(origin + created.url)).status).toBe(200);
  expect((await createFolder('child', 'new folder ☆')).status).toBe(201);
  expect((await createFolder('child', 'new folder ☆')).status).toBe(409);
  expect((await createFolder('hello.txt')).status).toBe(409);
  const uploaded = await upload('inside.txt', 'nested owner upload', undefined, { 'X-File-Folder': encodeURIComponent('new folder ☆/child') });
  expect(uploaded.status).toBe(201);
  const result = await uploaded.json();
  expect(await (await fetch(origin + result.url)).text()).toBe('nested owner upload');
  expect(await Bun.file(resolve(root, 'new folder ☆', 'child', 'inside.txt')).text()).toBe('nested owner upload');
  expect((await upload('inside.txt', 'replacement', undefined, { 'X-File-Folder': encodeURIComponent('new folder ☆/child') })).status).toBe(409);
});

test('folder creation and nested uploads reject unsafe names and parent paths', async () => {
  for (const name of ['../escape', '/tmp/escape', 'nested/escape', 'nested\\escape', '.hidden', '', 'bad\0name']) {
    expect((await createFolder(name)).status).toBe(400);
  }
  for (const folder of ['../', '/tmp', 'nested/../../', 'nested\\..', '.hidden', 'nested//child', 'bad\0folder']) {
    expect((await createFolder('escape', folder)).status).toBe(400);
    expect((await upload('escape.txt', 'bad', undefined, { 'X-File-Folder': encodeURIComponent(folder) })).status).toBe(400);
  }
  for (const folder of ['outside-directory', 'inside-link', 'outside-hardlink', 'hello.txt', 'missing']) {
    expect((await createFolder('escape', folder)).status).toBe(404);
    expect((await upload('escape.txt', 'bad', undefined, { 'X-File-Folder': encodeURIComponent(folder) })).status).toBe(404);
  }
  expect(await Bun.file(resolve(fixture, 'escape.txt')).exists()).toBe(false);
  expect(await Bun.file(resolve(fixture, 'private.txt')).text()).toBe('outside secret');
});

test('folder names with quotes and percent signs are safely rendered and addressed', async () => {
  const name = 'folder " onmouseover="evil &amp; % ☆';
  const response = await createFolder(name);
  expect(response.status).toBe(201);
  const result = await response.json();
  const html = await (await fetch(origin + result.url)).text();
  expect(html).toContain('id="folder-form"');
  let renderedFolder;
  let injectedAttribute = false;
  await new HTMLRewriter().on('*', { element(element) {
    if (element.getAttribute('onmouseover') !== null) injectedAttribute = true;
    if (element.getAttribute('id') === 'owner-tools') renderedFolder = decodeURIComponent(element.getAttribute('data-folder'));
  } }).transform(new Response(html)).text();
  expect(injectedAttribute).toBe(false);
  expect(renderedFolder).toBe(name);
  expect((await upload('safe.txt', 'correct folder', undefined, { 'X-File-Folder': encodeURIComponent(name) })).status).toBe(201);
  expect(await Bun.file(resolve(root, name, 'safe.txt')).text()).toBe('correct folder');
});

test('forwarded HTTP pages omit owner credentials and actions while keeping downloads', async () => {
  const response = await fetch(origin + '/files/', { headers: { 'X-Forwarded-Proto': 'http' } });
  const html = await response.text();
  expect(html).toContain('hello.txt');
  expect(html).not.toContain('id="owner-tools"');
  expect(html).not.toContain('id="owner-token"');
});

test('the default accepts upload sizes above 4 GiB and rejects declarations over 10 GiB', async () => {
  const defaultHost = await createFileHost(root, await Bun.file(resolve(import.meta.dir, '../static/files.html')).text(), { uploadToken: token });
  try {
    const page = await (await defaultHost.download(new Request(origin + '/files/'), '/files/')).text();
    expect(page).toContain('10.0 GiB');
    expect(page).toContain('data-max-size="10737418240"');
    const request = size => new Request(origin + '/api/files/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-File-Name': 'declared-large.txt', 'Content-Length': String(size) }
    });
    expect((await defaultHost.upload(request(defaultMaxUploadBytes + 1))).status).toBe(413);
    expect((await defaultHost.upload(request(defaultMaxUploadBytes))).status).toBe(201);
  } finally {
    await defaultHost.close();
  }
});

test('authenticated uploads persist and become publicly downloadable without overwriting', async () => {
  const response = await upload('owner upload ☆.txt', 'owner content');
  expect(response.status).toBe(201);
  const result = await response.json();
  expect(result.name).toBe('owner upload ☆.txt');
  expect(await (await fetch(origin + result.url)).text()).toBe('owner content');
  expect((await upload('hello.txt', 'replacement')).status).toBe(409);
  expect(await Bun.file(resolve(root, 'hello.txt')).text()).toBe('hello ☆');
  expect((await upload('outside-link', 'replacement')).status).toBe(409);
  expect(await Bun.file(resolve(fixture, 'private.txt')).text()).toBe('outside secret');
  expect((await readdir(root)).some(name => name.startsWith('.upload-'))).toBe(false);
});

test('concurrent uploads cannot replace each other, and empty or limit-sized files work', async () => {
  const responses = await Promise.all([upload('same-name.txt', 'first upload'), upload('same-name.txt', 'second upload')]);
  expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
  expect(['first upload', 'second upload']).toContain(await Bun.file(resolve(root, 'same-name.txt')).text());
  expect((await upload('empty.txt', '')).status).toBe(201);
  expect(await (await fetch(origin + '/files/empty.txt')).text()).toBe('');
  expect((await upload('at-limit.txt', 'x'.repeat(limit))).status).toBe(201);
  expect(await (await fetch(origin + '/files/at-limit.txt')).text()).toBe('x'.repeat(limit));
  expect((await readdir(root)).some(name => name.startsWith('.upload-'))).toBe(false);
});

test('upload filenames cannot escape the root or create hidden paths', async () => {
  for (const name of ['../private.txt', '/tmp/private.txt', 'nested/file.txt', 'nested\\file.txt', '.env', '', 'bad\0name', 'bad\nname', 'a'.repeat(256)]) {
    expect((await upload(name)).status).toBe(400);
  }
  expect(await Bun.file(resolve(fixture, 'private.txt')).text()).toBe('outside secret');
  expect((await readdir(root)).some(name => name.startsWith('.upload-'))).toBe(false);
});

test('size limits apply to declared and streaming bodies, with cleanup after failures', async () => {
  expect((await upload('too-large.txt', 'x'.repeat(limit + 1))).status).toBe(413);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(limit));
      controller.enqueue(new Uint8Array(1));
      controller.close();
    }
  });
  const request = new Request(origin + '/api/files/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-File-Name': 'too-large-stream.txt' },
    body: stream
  });
  expect((await host.upload(request)).status).toBe(413);
  const brokenBody = new ReadableStream({ pull(controller) { controller.error(new Error('Interrupted transfer')); } });
  expect((await host.upload(new Request(origin + '/api/files/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-File-Name': 'interrupted.txt' },
    body: brokenBody
  }))).status).toBe(500);
  for (const name of ['too-large.txt', 'too-large-stream.txt', 'interrupted.txt']) expect(await Bun.file(resolve(root, name)).exists()).toBe(false);
  expect((await readdir(root)).some(name => name.startsWith('.upload-'))).toBe(false);
});

test('uploads default to disabled and unsafe configuration fails closed', async () => {
  const disabled = await createFileHost(root, await Bun.file(resolve(import.meta.dir, '../static/files.html')).text());
  try {
    expect((await disabled.upload(new Request(origin + '/api/files/upload', { method: 'POST' }))).status).toBe(503);
    expect((await disabled.createFolder(new Request(origin + '/api/files/mkdir', { method: 'POST' }))).status).toBe(503);
    expect(await (await disabled.download(new Request(origin + '/files/'), '/files/')).text()).not.toContain('id="upload-form"');
  } finally {
    await disabled.close();
  }
  await expect(createFileHost(root, '', { uploadToken: 'short' })).rejects.toThrow('at least 32');
  await expect(createFileHost(root, '', { maxUploadBytes: 0 })).rejects.toThrow('positive integer');
  await expect(createFileHost(resolve(root, 'outside-directory'), '')).rejects.toThrow();
});

test('replacing the files path with a symlink cannot redirect reads or writes', async () => {
  const pinnedPath = resolve(fixture, 'pinned');
  await mkdir(pinnedPath);
  await writeFile(resolve(pinnedPath, 'original.txt'), 'pinned original');
  const pinned = await createFileHost(pinnedPath, '', { uploadToken: token });
  try {
    await rename(pinnedPath, resolve(fixture, 'original-directory'));
    await symlink(fixture, pinnedPath);
    expect(await (await pinned.download(new Request(origin + '/files/original.txt'), '/files/original.txt')).text()).toBe('pinned original');
    expect((await pinned.download(new Request(origin + '/files/private.txt'), '/files/private.txt')).status).toBe(404);
    expect((await pinned.upload(new Request(origin + '/api/files/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-File-Name': 'pinned-upload.txt' },
      body: 'inside pinned directory'
    }))).status).toBe(201);
    expect(await Bun.file(resolve(fixture, 'original-directory', 'pinned-upload.txt')).text()).toBe('inside pinned directory');
    expect(await Bun.file(resolve(fixture, 'pinned-upload.txt')).exists()).toBe(false);
  } finally {
    await pinned.close();
  }
});
