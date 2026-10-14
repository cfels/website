import { afterAll, beforeAll, expect, spyOn, test } from 'bun:test';
import { link, mkdir, mkdtemp, open, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createFileHost, defaultMaxUploadBytes } from '../file-host.js';

let fixture;
let root;
let host;
let server;
let origin;
const token = 'test-only-owner-token-with-at-least-32-characters';
const limit = 1024;
const secureFixture = { isSecureRequest: request => request.headers.get('x-forwarded-proto') !== 'http', minFreeBytes: 0 };

beforeAll(async () => {
  fixture = await mkdtemp(resolve(tmpdir(), 'website-files-'));
  root = resolve(fixture, 'files');
  await mkdir(resolve(root, 'nested'), { recursive: true });
  await writeFile(resolve(fixture, 'private.txt'), 'outside secret');
  await writeFile(resolve(root, 'hello.txt'), 'hello ☆');
  await writeFile(resolve(root, 'nested', 'inside.txt'), 'nested download');
  await writeFile(resolve(root, '<script>&".html'), '<script>alert(1)</script>');
  await writeFile(resolve(root, '空 file #%.txt'), 'unicode file');
  await writeFile(resolve(root, 'README'), 'About these downloads\n\nChoose a folder to find its files.');
  await writeFile(resolve(root, 'nested', 'readme.md'), '# Folder notes\n\nThese downloads belong together.');
  await writeFile(resolve(root, '.secret'), 'hidden file');
  await symlink(resolve(fixture, 'private.txt'), resolve(root, 'outside-link'));
  await symlink(fixture, resolve(root, 'outside-directory'));
  await symlink(resolve(root, 'hello.txt'), resolve(root, 'inside-link'));
  await link(resolve(fixture, 'private.txt'), resolve(root, 'outside-hardlink'));
  host = await createFileHost(root, await Bun.file(resolve(import.meta.dir, '../static/files.html')).text(), { ...secureFixture, uploadToken: token, maxUploadBytes: limit });
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

test('attachment-only downloads preserve file protections and never serve preview or listing pages', async () => {
  async function download(path, method = 'GET') {
    const request = new Request(origin + path, { method });
    return host.download(request, decodeURIComponent(new URL(request.url).pathname), { attachmentOnly: true });
  }
  const response = await download('/files/hello.txt');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-disposition')).toContain('attachment;');
  expect(await response.text()).toBe('hello ☆');
  const head = await download('/files/hello.txt', 'HEAD');
  expect(head.status).toBe(200);
  expect(await head.text()).toBe('');
  expect((await download('/files/hello.txt?view=1')).status).toBe(404);
  expect((await download('/files/hello.txt?sha256=1')).status).toBe(404);
  expect((await download('/files/')).status).toBe(404);
  expect((await download('/files/nested/')).status).toBe(404);
  const directory = await download('/files/nested');
  expect(directory.status).toBe(308);
  expect(directory.headers.get('location')).toBe('/files/nested/');
  for (const name of ['outside-link', 'inside-link', 'outside-hardlink']) {
    expect((await download('/files/' + name)).status).toBe(404);
  }
  for (const name of ['.secret', '%2e%2e%2fprivate.txt', '%00']) {
    expect((await download('/files/' + name)).status).toBe(403);
  }
  expect((await download('/files/hello.txt', 'POST')).status).toBe(405);
});

function createFolder(name, folder = '', authorization = `Bearer ${token}`) {
  return fetch(origin + '/api/files/mkdir', {
    method: 'POST',
    headers: { Authorization: authorization, 'X-File-Name': encodeURIComponent(name), 'X-File-Folder': encodeURIComponent(folder) }
  });
}

async function isolatedHost(options, action) {
  const path = await mkdtemp(resolve(tmpdir(), 'website-limits-'));
  let isolated;
  try {
    isolated = await createFileHost(path, await Bun.file(resolve(import.meta.dir, '../static/files.html')).text(), options);
    await action(isolated, path);
  } finally {
    if (isolated) await isolated.close();
    await rm(path, { recursive: true, force: true });
  }
}

function localUpload(name, body, headers = {}) {
  return new Request(origin + '/api/files/upload', { method: 'POST', body, headers: { Authorization: `Bearer ${token}`, 'X-File-Name': name, ...headers } });
}

async function observeFileReads(path, action) {
  const handle = await open(path);
  const prototype = Object.getPrototypeOf(handle);
  const read = prototype.read;
  await handle.close();
  const reads = spyOn(prototype, 'read');
  try { await action(reads, read); }
  finally { reads.mockRestore(); }
}

test('owner actions and token fields fail closed without verified transport even with forged headers', async () => {
  for (const policy of [undefined, () => false, async () => false]) {
    await isolatedHost({ uploadToken: token, isSecureRequest: policy }, async restricted => {
      expect((await restricted.upload(localUpload('denied.txt', 'data', { 'X-Forwarded-Proto': 'https' }))).status).toBe(403);
      const folder = new Request(origin + '/api/files/mkdir', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-File-Name': 'denied', 'X-Forwarded-Proto': 'https' } });
      expect((await restricted.createFolder(folder)).status).toBe(403);
      const page = await (await restricted.download(new Request(origin + '/files/', { headers: { 'X-Forwarded-Proto': 'https' } }), '/files/')).text();
      expect(page).not.toContain('id="owner-tools"');
      expect(page).not.toContain('id="owner-token"');
    });
  }
});

test('page and download slots remain bounded until bodies finish or are cancelled', async () => {
  await isolatedHost({ maxConcurrentPages: 1, maxConcurrentDownloads: 1, maxConcurrentChecksums: 1 }, async (limited, path) => {
    await writeFile(resolve(path, 'notes.txt'), 'x'.repeat(512 * 1024));
    const page = await limited.download(new Request(origin + '/files/'), '/files/');
    expect(page.status).toBe(200);
    const busy = await limited.download(new Request(origin + '/files/'), '/files/');
    expect(busy.status).toBe(429);
    expect(busy.headers.get('retry-after')).toBe('1');
    await page.body.cancel();
    expect((await limited.download(new Request(origin + '/files/', { method: 'HEAD' }), '/files/')).status).toBe(200);
    const invalid = await limited.download(new Request(origin + '/files/?q=' + 'x'.repeat(256)), '/files/');
    expect(invalid.status).toBe(400);
    await invalid.text();
    const resumed = await limited.download(new Request(origin + '/files/'), '/files/');
    expect(resumed.status).toBe(200);
    await resumed.text();
    const checksum = await limited.download(new Request(origin + '/files/notes.txt?sha256=1'), '/files/notes.txt');
    expect(checksum.status).toBe(200);
    expect((await limited.download(new Request(origin + '/files/notes.txt?sha256=1'), '/files/notes.txt')).status).toBe(429);
    await checksum.body.cancel();
    const checksumHead = await limited.download(new Request(origin + '/files/notes.txt?sha256=1', { method: 'HEAD' }), '/files/notes.txt');
    expect(checksumHead.status).toBe(200);
    expect(await checksumHead.text()).toBe('');
    const checksumAbort = new AbortController();
    checksumAbort.abort();
    const cancelledChecksum = await limited.download(new Request(origin + '/files/notes.txt?sha256=1', { signal: checksumAbort.signal }), '/files/notes.txt');
    expect(cancelledChecksum.status).toBe(499);
    expect((await limited.download(new Request(origin + '/files/notes.txt?sha256=1', { method: 'HEAD' }), '/files/notes.txt')).status).toBe(200);
    const download = await limited.download(new Request(origin + '/files/notes.txt'), '/files/notes.txt');
    expect(download.status).toBe(200);
    expect((await limited.download(new Request(origin + '/files/notes.txt'), '/files/notes.txt')).status).toBe(429);
    await download.body.cancel();
    const retry = await limited.download(new Request(origin + '/files/notes.txt'), '/files/notes.txt');
    expect(await retry.text()).toBe('x'.repeat(512 * 1024));
    const abortController = new AbortController();
    const abandoned = await limited.download(new Request(origin + '/files/notes.txt', { signal: abortController.signal }), '/files/notes.txt');
    expect(abandoned.status).toBe(200);
    abortController.abort();
    await abandoned.body.cancel();
    const recovered = await limited.download(new Request(origin + '/files/notes.txt'), '/files/notes.txt');
    expect(recovered.status).toBe(200);
    await recovered.body.cancel();
  });
});

test('active uploads are capped and failed uploads release their reservations', async () => {
  await isolatedHost({ ...secureFixture, uploadToken: token, maxUploadBytes: 8, maxStorageBytes: 8, maxConcurrentUploads: 1 }, async (limited, path) => {
    let finish;
    const body = new ReadableStream({ start(controller) { finish = () => { controller.enqueue(new Uint8Array([1, 2])); controller.close(); }; } });
    const pending = limited.upload(localUpload('first.txt', body));
    expect((await limited.upload(localUpload('second.txt', 'xx'))).status).toBe(429);
    finish();
    expect((await pending).status).toBe(201);
    const failed = new ReadableStream({ pull(controller) { controller.error(new Error('Interrupted upload')); } });
    expect((await limited.upload(localUpload('failed.txt', failed, { 'Content-Length': '2' }))).status).toBe(500);
    expect((await limited.upload(localUpload('mismatch.txt', 'xx', { 'Content-Length': '1' }))).status).toBe(400);
    expect((await limited.upload(localUpload('retry.txt', 'xxxxxx', { 'Content-Length': '6' }))).status).toBe(201);
    expect((await readdir(path)).sort()).toEqual(['first.txt', 'retry.txt']);
  });
});

test('concurrent storage reservations cannot exceed the total quota', async () => {
  await isolatedHost({ ...secureFixture, uploadToken: token, maxUploadBytes: 8, maxStorageBytes: 10 }, async (limited, path) => {
    await writeFile(resolve(path, 'existing.txt'), 'xx');
    let finish;
    let entered;
    const reading = new Promise(resolveRead => { entered = resolveRead; });
    const body = new ReadableStream({ pull(controller) {
      entered();
      return new Promise(resolvePull => { finish = () => { controller.enqueue(new Uint8Array(4)); controller.close(); resolvePull(); }; });
    } }, { highWaterMark: 0 });
    const pending = limited.upload(localUpload('first.txt', body, { 'Content-Length': '4' }));
    await reading;
    expect((await limited.upload(localUpload('too-much.txt', 'xxxxxx', { 'Content-Length': '6' }))).status).toBe(507);
    finish();
    expect((await pending).status).toBe(201);
    expect((await limited.upload(localUpload('last.txt', 'xxxx', { 'Content-Length': '4' }))).status).toBe(201);
    expect((await limited.upload(localUpload('full.txt', 'x', { 'Content-Length': '1' }))).status).toBe(507);
    expect((await readdir(path)).sort()).toEqual(['existing.txt', 'first.txt', 'last.txt']);
  });
});

test('a free-space reserve prevents new writes without preventing reads', async () => {
  await isolatedHost({ ...secureFixture, uploadToken: token, minFreeBytes: Number.MAX_SAFE_INTEGER }, async (limited, path) => {
    expect((await limited.upload(localUpload('no-space.txt', 'x'))).status).toBe(507);
    const folder = new Request(origin + '/api/files/mkdir', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-File-Name': 'no-space' } });
    expect((await limited.createFolder(folder)).status).toBe(507);
    expect(await readdir(path)).toEqual([]);
    expect((await limited.download(new Request(origin + '/files/', { method: 'HEAD' }), '/files/')).status).toBe(200);
  });
});

test('a tree too deep to account for prevents owner writes while files remain browsable', async () => {
  await isolatedHost({ ...secureFixture, uploadToken: token }, async (limited, path) => {
    let nested = path;
    for (let depth = 0; depth < 65; depth++) {
      nested = resolve(nested, 'child');
      await mkdir(nested);
    }
    expect((await limited.upload(localUpload('uncounted.txt', 'x'))).status).toBe(503);
    expect(await Bun.file(resolve(path, 'uncounted.txt')).exists()).toBe(false);
    expect((await limited.download(new Request(origin + '/files/', { method: 'HEAD' }), '/files/')).status).toBe(200);
  });
});

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

test('search matches file and folder names without changing download URLs', async () => {
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

test('search covers all folders from both root and nested pages and supports clearing or empty results', async () => {
  const root = await (await fetch(origin + '/files/?q=inside')).text();
  expect(root).toContain('href="/files/nested/inside.txt"');
  expect(root).toContain('>nested\\inside.txt</a>');
  expect(root).toContain('1 match for “inside” across all folders.');
  const nested = await (await fetch(origin + '/files/nested/?q=INSIDE')).text();
  expect(nested).toContain('href="/files/nested/inside.txt"');
  expect(nested).toContain('action="/files/"');
  expect(nested).toContain('id="search-clear" href="/files/nested/"');
  expect(nested).toContain('href="/files/">..\\');
  const outsideCurrentFolder = await (await fetch(origin + '/files/nested/?q=HELLO')).text();
  expect(outsideCurrentFolder).toContain('href="/files/hello.txt"');
  const noMatches = await (await fetch(origin + '/files/nested/?q=missing')).text();
  expect(noMatches).toContain('No matching files or folders.');
  expect(noMatches).toContain('0 matches for “missing”');
  const cleared = await (await fetch(origin + '/files/?q=%20%20')).text();
  expect(cleared).toContain('href="/files/hello.txt"');
  expect(cleared).toContain('href="/files/nested/"');
  expect(cleared).not.toContain('href="/files/nested/inside.txt"');
});

test('recursive search distinguishes duplicate names and safely renders nested paths and preview links', async () => {
  const folder = '<notes>&"#%';
  await mkdir(resolve(root, 'nested', folder));
  await writeFile(resolve(root, 'nested', folder, 'hello.txt'), 'nested hello');
  const html = await (await fetch(origin + '/files/?q=hello')).text();
  expect(html).toContain('2 matches for “hello”');
  expect(html).toContain('>hello.txt</a>');
  expect(html).toContain('>nested\\&lt;notes&gt;&amp;&quot;#%\\hello.txt</a>');
  const url = '/files/nested/' + encodeURIComponent(folder) + '/hello.txt';
  expect(html).toContain(`href="${url}"`);
  expect(html).toContain(`href="${url}?view=1" aria-label="View nested\\&lt;notes&gt;&amp;&quot;#%\\hello.txt"`);
  expect(html).not.toContain('<notes>');
  expect(await (await fetch(origin + url)).text()).toBe('nested hello');
  const directorySearch = await (await fetch(origin + '/files/?q=' + encodeURIComponent(folder))).text();
  expect(directorySearch).toContain(`href="/files/nested/${encodeURIComponent(folder)}/"`);
});

test('search preserves hidden-file restrictions and safely renders untrusted query text', async () => {
  await mkdir(resolve(root, 'nested', '.hidden-folder'));
  await writeFile(resolve(root, 'nested', '.hidden-folder', 'secret.txt'), 'hidden nested secret');
  await writeFile(resolve(root, 'nested', '.secret'), 'hidden secret');
  await symlink(fixture, resolve(root, 'nested', 'secret-directory'));
  await symlink(root, resolve(root, 'nested', 'secret-loop'));
  await symlink(resolve(fixture, 'private.txt'), resolve(root, 'nested', 'secret-link.txt'));
  await link(resolve(fixture, 'private.txt'), resolve(root, 'nested', 'secret-hardlink.txt'));
  const privateSearch = await (await fetch(origin + '/files/?q=secret')).text();
  expect(privateSearch).toContain('No matching files or folders.');
  for (const name of ['.secret', 'outside secret']) expect(privateSearch).not.toContain(name);
  for (const name of ['.hidden-folder', 'secret-directory', 'secret-loop', 'secret-link.txt', 'secret-hardlink.txt']) expect(privateSearch).not.toContain(name);
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

test('recursive search caps rendered matches and reports incomplete results', async () => {
  const searchFixture = await mkdtemp(resolve(tmpdir(), 'website-search-'));
  let searchHost;
  try {
    await mkdir(resolve(searchFixture, 'nested'));
    for (let start = 0; start < 1001; start += 100) {
      const end = Math.min(start + 100, 1001);
      await Promise.all(Array.from({ length: end - start }, (_, index) => writeFile(resolve(searchFixture, 'nested', `match-${start + index}.txt`), '')));
    }
    searchHost = await createFileHost(searchFixture, await Bun.file(resolve(import.meta.dir, '../static/files.html')).text());
    const response = await searchHost.download(new Request(origin + '/files/?q=match'), '/files/');
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('1000 matches for “match” across all folders.');
    expect(html).toContain('Search limits reached; these results may be incomplete.');
    expect((html.match(/class="file-download-link"/g) || []).length).toBe(1000);
    expect((html.match(/class="file-view-link"/g) || []).length).toBe(1000);
    expect((html.match(/class="file-checksum-link"/g) || []).length).toBe(1000);
    expect(html).not.toContain('id="owner-tools"');
    const listing = await (await searchHost.download(new Request(origin + '/files/nested/'), '/files/nested/')).text();
    expect(listing).toContain('Folder listing limits reached; some entries are omitted.');
    expect((listing.match(/class="file-download-link"/g) || []).length).toBe(1000);
  } finally {
    if (searchHost) await searchHost.close();
    await rm(searchFixture, { recursive: true, force: true });
  }
});

test('downloads stream original bytes with attachment headers and support HEAD', async () => {
  const response = await fetch(origin + '/files/hello.txt');
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('hello ☆');
  expect(response.headers.get('content-disposition')).toBe("attachment; filename=\"hello.txt\"; filename*=UTF-8''hello.txt");
  expect(response.headers.get('content-type')).toBe('application/octet-stream');
  expect(response.headers.get('content-security-policy')).toContain('sandbox');
  const head = await fetch(origin + '/files/hello.txt', { method: 'HEAD' });
  expect(head.status).toBe(200);
  expect(head.headers.get('content-length')).toBe(String(Buffer.byteLength('hello ☆')));
  expect(head.headers.get('content-disposition')).toBe(response.headers.get('content-disposition'));
  expect(await head.text()).toBe('');
  const unicode = await fetch(origin + '/files/' + encodeURIComponent('空 file #%.txt'));
  expect(unicode.headers.get('content-disposition')).toBe("attachment; filename=\"_ file #_.txt\"; filename*=UTF-8''%E7%A9%BA%20file%20%23%25.txt");
  expect(await unicode.text()).toBe('unicode file');
  const redirect = await fetch(origin + '/files/nested', { redirect: 'manual' });
  expect(redirect.status).toBe(308);
  expect(redirect.headers.get('location')).toBe('/files/nested/');
});

test('legacy download filenames keep spaces and extensions without malformed header parameters', async () => {
  await isolatedHost({}, async (isolated, path) => {
    for (const name of ['driver setup.exe', 'archive.zip', '<script>&".html']) {
      await writeFile(resolve(path, name), 'download bytes');
      const request = new Request(origin + '/files/' + encodeURIComponent(name), { headers: { 'User-Agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 5.1)' } });
      const response = await isolated.download(request, '/files/' + name);
      expect(response.status).toBe(200);
      const fallback = name === '<script>&".html' ? '_script_&_.html' : name;
      expect(response.headers.get('content-disposition')).toStartWith(`attachment; filename="${fallback}"; filename*=UTF-8''`);
      expect(await response.text()).toBe('download bytes');
    }
  });
});

test('text files have view links while existing file links still download originals', async () => {
  const html = await (await fetch(origin + '/files/')).text();
  expect(html).toContain('href="/files/hello.txt"');
  expect(html).toContain('href="/files/hello.txt?view=1" aria-label="View hello.txt"');
  expect(html).toContain('href="/files/README?view=1"');
  expect(html).not.toContain('.html?view=1');
  expect(html).not.toContain('nested/?view=1');
  expect(html).not.toContain('id="text-viewer"');
  const nested = await (await fetch(origin + '/files/nested/')).text();
  expect(nested).toContain('href="/files/nested/readme.md?view=1"');
});

test('all files have checksum links in folders and search results without hashing directories', async () => {
  for (const suffix of ['', '?q=hello', '?q=inside']) {
    const html = await (await fetch(origin + '/files/' + suffix)).text();
    expect(html).toContain(suffix === '?q=inside' ? 'href="/files/nested/inside.txt?sha256=1"' : 'href="/files/hello.txt?sha256=1" aria-label="SHA-256 checksum for hello.txt"');
    expect(html).not.toContain('nested/?sha256=1');
    expect(html).not.toContain('id="file-checksum"');
    if (!suffix) expect(html).toContain('.html?sha256=1');
  }
});

test('checksum pages show the original byte digest, safe navigation, and text preview links', async () => {
  const response = await fetch(origin + '/files/nested/readme.md?sha256=1');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('content-disposition')).toBeNull();
  expect(response.headers.get('content-security-policy')).toContain("object-src 'none'");
  const original = await (await fetch(origin + '/files/nested/readme.md')).arrayBuffer();
  const digest = createHash('sha256').update(new Uint8Array(original)).digest('hex');
  const html = await response.text();
  expect(html).toContain(`<code id="checksum-value">${digest}</code>`);
  expect(html).toContain('id="checksum-back" href="/files/nested/"');
  expect(html).toContain('id="checksum-download" class="file-download-link" href="/files/nested/readme.md">Download original');
  expect(html).toContain('id="checksum-view" href="/files/nested/readme.md?view=1"');
  expect(html).toContain('C:\\files\\nested\\readme.md');
  for (const id of ['text-viewer', 'owner-tools', 'file-search', 'file-entries']) expect(html).not.toContain(`id="${id}"`);
  const preview = await (await fetch(origin + '/files/nested/readme.md?view=1')).text();
  expect(preview).toContain('id="text-checksum" href="/files/nested/readme.md?sha256=1"');
  expect(preview).not.toContain('id="file-checksum"');
});

test('checksums support empty, binary, large, and changed files without altering downloads', async () => {
  await isolatedHost({}, async (isolated, path) => {
    const contents = new Map([
      ['empty.bin', new Uint8Array()],
      ['binary.bin', new Uint8Array([0, 1, 2, 0xff, 0xfe])],
      ['large.bin', Buffer.alloc(10 * 1024 * 1024 + 1, 0xff)],
      ['空 file #%.txt', Buffer.from('abc')]
    ]);
    for (const [name, bytes] of contents) {
      await writeFile(resolve(path, name), bytes);
      const url = origin + '/files/' + encodeURIComponent(name);
      const response = await isolated.download(new Request(url + '?sha256=1'), '/files/' + name);
      expect(response.status).toBe(200);
      const html = await response.text();
      const digest = name === '空 file #%.txt' ? 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' : createHash('sha256').update(bytes).digest('hex');
      expect(html).toContain(`<code id="checksum-value">${digest}</code>`);
      expect(html).toContain(`href="/files/${encodeURIComponent(name)}">Download original`);
      if (name.endsWith('.bin')) expect(html).not.toContain('id="checksum-preview"');
      const original = await isolated.download(new Request(url), '/files/' + name);
      expect(original.headers.get('content-disposition')).toContain('attachment;');
      expect(new Uint8Array(await original.arrayBuffer())).toEqual(new Uint8Array(bytes));
    }
    await writeFile(resolve(path, '空 file #%.txt'), 'different bytes');
    const changed = await isolated.download(new Request(origin + '/files/' + encodeURIComponent('空 file #%.txt') + '?sha256=1'), '/files/空 file #%.txt');
    expect(await changed.text()).toContain(createHash('sha256').update('different bytes').digest('hex'));
  });
});

test('checksum pages preserve path protections and escape filenames', async () => {
  for (const name of ['.secret', '%2e%2e%2fprivate.txt', '%00']) {
    expect((await fetch(origin + '/files/' + name + '?sha256=1')).status).toBe(403);
  }
  for (const name of ['outside-link', 'inside-link', 'outside-hardlink', 'outside-directory/private.txt', 'missing']) {
    expect((await fetch(origin + '/files/' + name + '?sha256=1')).status).toBe(404);
  }
  expect((await fetch(origin + '/files/hello.txt?sha256=1', { method: 'DELETE' })).status).toBe(405);
  const html = await (await fetch(origin + '/files/' + encodeURIComponent('<script>&".html') + '?sha256=1')).text();
  expect(html).toContain('&lt;script&gt;&amp;');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('id="checksum-preview"');
});

test('busy checksum work cannot exhaust browsing, preview, or download slots and aborts release capacity', async () => {
  await isolatedHost({ maxConcurrentPages: 1, maxConcurrentDownloads: 1, maxConcurrentChecksums: 1 }, async (limited, path) => {
    const file = resolve(path, 'notes.txt');
    await writeFile(file, 'x'.repeat(128 * 1024));
    await observeFileReads(file, async (reads, read) => {
      let enter;
      let release;
      const started = new Promise(resolve => { enter = resolve; });
      const gate = new Promise(resolve => { release = resolve; });
      reads.mockImplementationOnce(async function (...args) {
        enter();
        await gate;
        return read.apply(this, args);
      });
      const controller = new AbortController();
      const url = origin + '/files/notes.txt?sha256=1';
      const pending = limited.download(new Request(url, { signal: controller.signal }), '/files/notes.txt');
      try {
        await started;
        const busy = await limited.download(new Request(url), '/files/notes.txt');
        expect(busy.status).toBe(429);
        expect(busy.headers.get('retry-after')).toBe('1');
        await busy.text();
        const listing = await limited.download(new Request(origin + '/files/'), '/files/');
        expect(listing.status).toBe(200);
        expect(await listing.text()).toContain('notes.txt?sha256=1');
        const preview = await limited.download(new Request(origin + '/files/notes.txt?view=1'), '/files/notes.txt');
        expect(preview.status).toBe(200);
        expect(await preview.text()).toContain('id="text-content"');
        const download = await limited.download(new Request(origin + '/files/notes.txt'), '/files/notes.txt');
        expect(download.status).toBe(200);
        expect((await download.text()).length).toBe(128 * 1024);
        controller.abort();
        release();
        expect((await pending).status).toBe(499);
        reads.mockClear();
        const retry = await limited.download(new Request(url), '/files/notes.txt');
        expect(retry.status).toBe(200);
        await retry.text();
        expect(reads.mock.calls.length).toBeGreaterThan(0);
      } finally {
        release();
        const response = await pending;
        if (response.body) await response.body.cancel();
      }
    });
  });
});

test('cached checksums avoid rereading bytes and invalidate on same-size edits or file replacement', async () => {
  await isolatedHost({}, async (isolated, path) => {
    const file = resolve(path, 'cached.bin');
    await writeFile(file, 'abc');
    const checksum = async () => {
      const response = await isolated.download(new Request(origin + '/files/cached.bin?sha256=1'), '/files/cached.bin');
      expect(response.status).toBe(200);
      return response.text();
    };
    await observeFileReads(file, async reads => {
      expect(await checksum()).toContain(createHash('sha256').update('abc').digest('hex'));
      expect(reads.mock.calls.length).toBeGreaterThan(0);
      reads.mockClear();
      expect(await checksum()).toContain(createHash('sha256').update('abc').digest('hex'));
      expect(reads).not.toHaveBeenCalled();
      await writeFile(file, 'xyz');
      expect(await checksum()).toContain(createHash('sha256').update('xyz').digest('hex'));
      expect(reads.mock.calls.length).toBeGreaterThan(0);
      reads.mockClear();
      await writeFile(resolve(path, 'replacement.bin'), '123');
      await rename(resolve(path, 'replacement.bin'), file);
      expect(await checksum()).toContain(createHash('sha256').update('123').digest('hex'));
      expect(reads.mock.calls.length).toBeGreaterThan(0);
    });
  });
});

test('files changed during hashing return 409 and the inconsistent digest is never cached', async () => {
  await isolatedHost({}, async (isolated, path) => {
    const file = resolve(path, 'changing.bin');
    const replacement = Buffer.alloc(128 * 1024, 2);
    await writeFile(file, Buffer.alloc(replacement.length, 1));
    await observeFileReads(file, async (reads, read) => {
      reads.mockImplementationOnce(async function (...args) {
        const result = await read.apply(this, args);
        await writeFile(file, replacement);
        return result;
      });
      const request = () => new Request(origin + '/files/changing.bin?sha256=1');
      const changed = await isolated.download(request(), '/files/changing.bin');
      expect(changed.status).toBe(409);
      expect(await changed.text()).not.toContain('checksum-value');
      reads.mockClear();
      const retry = await isolated.download(request(), '/files/changing.bin');
      expect(retry.status).toBe(200);
      expect(await retry.text()).toContain(createHash('sha256').update(replacement).digest('hex'));
      expect(reads.mock.calls.length).toBeGreaterThan(0);
    });
  });
});

test('checksum cache evicts older entries after 1000 files while retaining recently used hashes', async () => {
  await isolatedHost({}, async (isolated, path) => {
    const checksum = async index => {
      const pathname = `/files/cache-${index}.bin`;
      const response = await isolated.download(new Request(origin + pathname + '?sha256=1'), pathname);
      expect(response.status).toBe(200);
      await response.text();
    };
    for (let index = 0; index <= 1000; index++) await writeFile(resolve(path, `cache-${index}.bin`), 'x');
    for (let index = 0; index < 1000; index++) await checksum(index);
    await checksum(0);
    await checksum(1000);
    await observeFileReads(resolve(path, 'cache-0.bin'), async reads => {
      await checksum(0);
      expect(reads).not.toHaveBeenCalled();
      await checksum(1);
      expect(reads).toHaveBeenCalledTimes(1);
    });
  });
});

test('the text viewer renders UTF-8 notes with folder navigation and a download link', async () => {
  const response = await fetch(origin + '/files/hello.txt?view=1');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
  expect(response.headers.get('content-disposition')).toBeNull();
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('content-security-policy')).toContain("object-src 'none'");
  const html = await response.text();
  expect(html).toContain('<title>Moxiu / hello.txt</title>');
  expect(html).toContain('id="text-content">hello ☆</code>');
  expect(html).toContain('id="text-back" href="/files/"');
  expect(html).toContain('id="text-download" href="/files/hello.txt"');
  for (const id of ['owner-tools', 'file-search', 'file-entries']) expect(html).not.toContain(`id="${id}"`);
  const nested = await (await fetch(origin + '/files/nested/readme.md?view=1')).text();
  expect(nested).toContain('C:\\files\\nested\\readme.md');
  expect(nested).toContain('# Folder notes\n\nThese downloads belong together.');
  expect(nested).toContain('id="text-back" href="/files/nested/"');
  expect(nested).toContain('id="text-download" href="/files/nested/readme.md"');
  const readme = await (await fetch(origin + '/files/README?view=1')).text();
  expect(readme).toContain('About these downloads');
  const head = await fetch(origin + '/files/hello.txt?view=1', { method: 'HEAD' });
  expect(head.status).toBe(200);
  expect(head.headers.get('content-type')).toBe('text/html; charset=utf-8');
  expect(await head.text()).toBe('');
});

test('the text viewer displays markup as text and safely handles unusual filenames and whitespace', async () => {
  const name = 'notes " onmouseover="evil & %.TXT';
  const text = '\n  Indented notes\r\n\t空 ☆ &amp;\n</code><script>alert(1)</script><img src=x onerror=alert(2)>';
  await writeFile(resolve(root, 'nested', name), text);
  const url = '/files/nested/' + encodeURIComponent(name);
  const listing = await (await fetch(origin + '/files/nested/')).text();
  expect(listing).toContain(url + '?view=1');
  const response = await fetch(origin + url + '?view=1');
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).not.toContain('<script>alert(1)</script>');
  expect(html).not.toContain('<img src=x');
  expect(html).toContain('&lt;/code&gt;&lt;script&gt;');
  expect(html).toContain('&amp;amp;');
  expect(html).toContain('id="text-content">\n  Indented notes\r\n\t空 ☆');
  for (const page of [listing, html]) {
    let injected = false;
    await new HTMLRewriter().on('*', { element(element) {
      if (element.getAttribute('onmouseover') !== null || element.getAttribute('onerror') !== null) injected = true;
    } }).transform(new Response(page)).text();
    expect(injected).toBe(false);
  }
  expect(await (await fetch(origin + url)).text()).toBe(text);
});

test('empty, binary, unsupported, and oversized files have appropriate viewer responses', async () => {
  await writeFile(resolve(root, 'empty-view.txt'), '');
  await writeFile(resolve(root, 'binary-view.txt'), new Uint8Array([0, 1, 2]));
  await writeFile(resolve(root, 'invalid-utf8.txt'), new Uint8Array([0xff, 0xfe]));
  const previewLimit = 10 * 1024 * 1024;
  await writeFile(resolve(root, 'view-at-limit.txt'), 'x'.repeat(previewLimit));
  await writeFile(resolve(root, 'view-too-large.txt'), 'x'.repeat(previewLimit + 1));
  const empty = await fetch(origin + '/files/empty-view.txt?view=1');
  expect(empty.status).toBe(200);
  expect(await empty.text()).toContain('This file is empty.');
  for (const name of ['binary-view.txt', 'invalid-utf8.txt']) {
    const response = await fetch(origin + '/files/' + name + '?view=1');
    expect(response.status).toBe(415);
    const html = await response.text();
    expect(html).toContain('This file is not UTF-8 text.');
    expect(html).toContain(`id="text-download" href="/files/${name}"`);
    expect(html).not.toContain('id="text-content"');
  }
  const unsupported = await fetch(origin + '/files/' + encodeURIComponent('<script>&".html') + '?view=1');
  expect(unsupported.status).toBe(415);
  expect(await unsupported.text()).toContain('This file type cannot be previewed here.');
  expect((await fetch(origin + '/files/view-at-limit.txt?view=1')).status).toBe(200);
  const large = await fetch(origin + '/files/view-too-large.txt?view=1');
  expect(large.status).toBe(413);
  const html = await large.text();
  expect(html).toContain('This file is too large to view here.');
  expect(html).toContain('10.0 MiB');
  expect(html).toContain('id="text-download" href="/files/view-too-large.txt"');
  expect(html).not.toContain('id="text-content"');
  const original = await fetch(origin + '/files/view-too-large.txt');
  expect(original.status).toBe(200);
  expect((await original.arrayBuffer()).byteLength).toBe(previewLimit + 1);
  const head = await fetch(origin + '/files/view-too-large.txt?view=1', { method: 'HEAD' });
  expect(head.status).toBe(413);
  expect(await head.text()).toBe('');
});

test('JSON and configuration previews larger than 1 MiB preserve UTF-8 characters and escape markup', async () => {
  const text = 'x'.repeat(65535) + '☆' + 'y'.repeat(2 * 1024 * 1024) + '\n</code><script>alert(1)</script>\n';
  for (const name of ['large-notes.json', 'settings.fgconfig']) {
    await writeFile(resolve(root, name), text);
    const listing = await (await fetch(origin + '/files/?q=' + name)).text();
    expect(listing).toContain(`href="/files/${name}?view=1"`);
    const response = await fetch(origin + '/files/' + name + '?view=1');
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('x☆y');
    expect(html).toContain('&lt;/code&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    const original = await fetch(origin + '/files/' + name);
    expect(await original.text()).toBe(text);
  }
});

test('folder sizes include nested downloads, exclude restricted entries, and reflect newly uploaded files', async () => {
  const sized = resolve(root, 'sized');
  await mkdir(resolve(sized, 'child'), { recursive: true });
  await mkdir(resolve(root, 'empty-folder'));
  await writeFile(resolve(sized, 'visible.txt'), 'abc');
  await writeFile(resolve(sized, 'child', 'data.bin'), '12345');
  await writeFile(resolve(sized, '.private'), 'hidden data must not count');
  await symlink(resolve(fixture, 'private.txt'), resolve(sized, 'outside.txt'));
  await symlink(fixture, resolve(sized, 'outside-folder'));
  await symlink(resolve(sized, 'visible.txt'), resolve(sized, 'inside.txt'));
  await link(resolve(fixture, 'private.txt'), resolve(sized, 'hard-linked.txt'));
  const html = await (await fetch(origin + '/files/?q=sized')).text();
  const row = html.match(/<tr>[\s\S]*?<\/tr>/g).find(row => row.includes('href="/files/sized/"'));
  expect(row).toContain('>8 B</td>');
  const nested = await (await fetch(origin + '/files/sized/')).text();
  const child = nested.match(/<tr>[\s\S]*?<\/tr>/g).find(row => row.includes('href="/files/sized/child/"'));
  expect(child).toContain('>5 B</td>');
  for (const name of ['.private', 'outside.txt', 'outside-folder', 'inside.txt', 'hard-linked.txt']) expect(nested).not.toContain(name);
  expect((await upload('new.txt', 'four', undefined, { 'X-File-Folder': 'sized/child' })).status).toBe(201);
  const updated = await (await fetch(origin + '/files/?q=sized')).text();
  const updatedRow = updated.match(/<tr>[\s\S]*?<\/tr>/g).find(row => row.includes('href="/files/sized/"'));
  expect(updatedRow).toContain('>12 B</td>');
  const empty = await (await fetch(origin + '/files/?q=empty-folder')).text();
  expect(empty).toContain('>0 B</td>');
});

test('deep folders show an unavailable size instead of a partial total and remain browsable', async () => {
  let path = resolve(root, 'deep-folder');
  await mkdir(path);
  for (let depth = 0; depth < 65; depth++) {
    path = resolve(path, 'child');
    await mkdir(path);
  }
  await writeFile(resolve(path, 'notes.txt'), 'deep notes');
  const response = await fetch(origin + '/files/?q=deep-folder');
  expect(response.status).toBe(200);
  const html = await response.text();
  const row = html.match(/<tr>[\s\S]*?<\/tr>/g).find(row => row.includes('href="/files/deep-folder/"'));
  expect(row).toContain('>—</td>');
  expect(html).toContain('A dash means its size is unavailable; open the folder to browse its contents.');
  expect(html).toContain('Search limits reached; these results may be incomplete.');
  const deepSearch = await (await fetch(origin + '/files/?q=notes.txt')).text();
  expect(deepSearch).toContain('Search limits reached; these results may be incomplete.');
  expect(deepSearch).not.toContain('>deep-folder\\');
  expect((await fetch(origin + '/files/deep-folder/child/')).status).toBe(200);
  const head = await fetch(origin + '/files/deep-folder/', { method: 'HEAD' });
  expect(head.status).toBe(200);
  expect(head.headers.get('content-type')).toBe('text/html; charset=utf-8');
  expect(await head.text()).toBe('');
  expect((await fetch(origin + '/files/deep-folder/?q=' + 'x'.repeat(256), { method: 'HEAD' })).status).toBe(400);
  await rm(resolve(root, 'deep-folder'), { recursive: true });
});

test('folder-size counting is bounded even when a folder contains many hidden entries', async () => {
  const countFixture = await mkdtemp(resolve(tmpdir(), 'website-folder-size-'));
  let countHost;
  try {
    await mkdir(resolve(countFixture, 'wide'));
    for (let start = 0; start < 10001; start += 100) {
      const end = Math.min(start + 100, 10001);
      await Promise.all(Array.from({ length: end - start }, (_, index) => writeFile(resolve(countFixture, 'wide', `.hidden-${start + index}`), '')));
    }
    await writeFile(resolve(countFixture, 'wide', 'public.txt'), 'public');
    countHost = await createFileHost(countFixture, await Bun.file(resolve(import.meta.dir, '../static/files.html')).text());
    const response = await countHost.download(new Request(origin + '/files/'), '/files/');
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('href="/files/wide/"');
    expect(html).toContain('>—</td>');
    expect(html).not.toContain('.hidden-');
    expect(html).not.toContain('>0 B</td>');
    const search = await countHost.download(new Request(origin + '/files/?q=missing'), '/files/');
    expect(search.status).toBe(200);
    const searchHTML = await search.text();
    expect(searchHTML).toContain('Search limits reached; these results may be incomplete.');
    expect(searchHTML).not.toContain('.hidden-');
  } finally {
    if (countHost) await countHost.close();
    await rm(countFixture, { recursive: true, force: true });
  }
}, 15000);

test('the token field supports password autofill without putting credentials in URLs or accepting form-body passwords', async () => {
  const html = await (await fetch(origin + '/files/')).text();
  let tokenForm;
  let tokenField;
  let usernameField;
  let ownerExpanded;
  let tokenSubmit = false;
  await new HTMLRewriter()
    .on('#owner-token-form', { element(element) {
      tokenForm = { method: element.getAttribute('method'), action: element.getAttribute('action'), autocomplete: element.getAttribute('autocomplete') };
    } })
    .on('#owner-token', { element(element) {
      tokenField = { name: element.getAttribute('name'), type: element.getAttribute('type'), autocomplete: element.getAttribute('autocomplete'), value: element.getAttribute('value') };
    } })
    .on('#owner-token-form input[name="username"]', { element(element) {
      usernameField = { type: element.getAttribute('type'), autocomplete: element.getAttribute('autocomplete'), value: element.getAttribute('value') };
    } })
    .on('#owner-tools', { element(element) { ownerExpanded = element.hasAttribute('open'); } })
    .on('#owner-token-form button[type="submit"]', { element() { tokenSubmit = true; } })
    .transform(new Response(html)).text();
  expect(tokenForm).toEqual({ method: 'post', action: '/api/files/upload', autocomplete: 'on' });
  expect(tokenField).toEqual({ name: 'password', type: 'password', autocomplete: 'current-password', value: null });
  expect(usernameField).toEqual({ type: 'hidden', autocomplete: 'username', value: 'owner' });
  expect(ownerExpanded).toBe(false);
  expect(tokenSubmit).toBe(true);
  expect(html).not.toContain(token);
  const response = await fetch(origin + '/api/files/upload', {
    method: 'POST',
    body: new URLSearchParams({ password: token })
  });
  expect(response.status).toBe(401);
  expect(await response.text()).not.toContain(token);
});

test('text viewing retains restrictions on paths, hidden files, and linked files', async () => {
  for (const path of ['%2e%2e%2fprivate.txt', '%2fetc%2fpasswd', 'nested%2f..%2f..%2fprivate.txt', '.secret', '%00']) {
    expect((await fetch(origin + '/files/' + path + '?view=1')).status).toBe(403);
  }
  for (const path of ['outside-link', 'outside-directory/private.txt', 'inside-link', 'outside-hardlink', 'missing.txt', 'hello.txt/']) {
    const response = await fetch(origin + '/files/' + path + '?view=1');
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('outside secret');
  }
  const response = await fetch(origin + '/files/hello.txt?view=1', { headers: { 'X-Forwarded-Proto': 'http' } });
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('hello ☆');
  expect((await fetch(origin + '/files/hello.txt?view=1', { method: 'DELETE' })).status).toBe(405);
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

test('forwarded HTTP owner actions are rejected even with the correct token', async () => {
  const uploadResponse = await upload('insecure-upload.txt', 'must not be saved', undefined, { 'X-Forwarded-Proto': 'http' });
  expect(uploadResponse.status).toBe(403);
  expect(await uploadResponse.text()).toBe('Owner actions require HTTPS');
  const folderResponse = await fetch(origin + '/api/files/mkdir', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-File-Name': 'insecure-folder', 'X-Forwarded-Proto': 'http' }
  });
  expect(folderResponse.status).toBe(403);
  expect(await Bun.file(resolve(root, 'insecure-upload.txt')).exists()).toBe(false);
  expect(await readdir(root)).not.toContain('insecure-folder');
  expect((await readdir(root)).some(name => name.startsWith('.upload-'))).toBe(false);
  const secure = await upload('secure-upload.txt', 'secure content', undefined, { 'X-Forwarded-Proto': 'https' });
  expect(secure.status).toBe(201);
  expect(await Bun.file(resolve(root, 'secure-upload.txt')).text()).toBe('secure content');
});

test('folder actions reject cross-site requests and both owner endpoints reject malformed encoded names', async () => {
  const crossSite = await fetch(origin + '/api/files/mkdir', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-File-Name': 'cross-site-folder', 'Sec-Fetch-Site': 'cross-site' }
  });
  expect(crossSite.status).toBe(403);
  expect(await readdir(root)).not.toContain('cross-site-folder');
  for (const path of ['/api/files/upload', '/api/files/mkdir']) {
    for (const header of ['X-File-Name', 'X-File-Folder']) {
      const response = await fetch(origin + path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-File-Name': 'malformed-name.txt', [header]: '%zz' }
      });
      expect(response.status).toBe(400);
    }
  }
  expect(await Bun.file(resolve(root, 'malformed-name.txt')).exists()).toBe(false);
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
  const defaultHost = await createFileHost(root, await Bun.file(resolve(import.meta.dir, '../static/files.html')).text(), { ...secureFixture, uploadToken: token });
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
  for (const maxConcurrentChecksums of [0, -1, 1.5, 1025, NaN, '2']) {
    await expect(createFileHost(root, '', { maxConcurrentChecksums })).rejects.toThrow('Concurrency limits');
  }
  await expect(createFileHost(resolve(root, 'outside-directory'), '')).rejects.toThrow();
});

test('replacing the files path with a symlink cannot redirect reads or writes', async () => {
  const pinnedPath = resolve(fixture, 'pinned');
  await mkdir(pinnedPath);
  await writeFile(resolve(pinnedPath, 'original.txt'), 'pinned original');
  const pinned = await createFileHost(pinnedPath, await Bun.file(resolve(import.meta.dir, '../static/files.html')).text(), { ...secureFixture, uploadToken: token });
  try {
    await rename(pinnedPath, resolve(fixture, 'original-directory'));
    await symlink(fixture, pinnedPath);
    expect(await (await pinned.download(new Request(origin + '/files/original.txt'), '/files/original.txt')).text()).toBe('pinned original');
    expect((await pinned.download(new Request(origin + '/files/private.txt'), '/files/private.txt')).status).toBe(404);
    const search = await (await pinned.download(new Request(origin + '/files/?q=original'), '/files/')).text();
    expect(search).toContain('href="/files/original.txt"');
    expect(search).toContain('1 match for “original” across all folders.');
    const outsideSearch = await (await pinned.download(new Request(origin + '/files/?q=private'), '/files/')).text();
    expect(outsideSearch).toContain('No matching files or folders.');
    expect(outsideSearch).not.toContain('private.txt');
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
