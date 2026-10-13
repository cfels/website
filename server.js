import { resolve, sep } from 'node:path';
import { createFileHost, defaultMaxUploadBytes } from './file-host.js';

const development = process.argv.includes('--dev');
const downloadPort = process.env.FILES_DOWNLOAD_PORT === undefined ? undefined : Number(process.env.FILES_DOWNLOAD_PORT);
if (downloadPort !== undefined && (!/^\d+$/.test(process.env.FILES_DOWNLOAD_PORT) || !Number.isInteger(downloadPort) || downloadPort < 0 || downloadPort > 65535)) {
  throw new Error('FILES_DOWNLOAD_PORT must be an integer between 0 and 65535.');
}
const root = resolve(import.meta.dir, development ? 'static' : 'build');
if (!(await Bun.file(resolve(root, 'index.html')).exists())) {
  throw new Error('Run bun run build before starting the production server.');
}
const maxUploadBytes = process.env.FILES_MAX_UPLOAD_MB === undefined ? defaultMaxUploadBytes : Number(process.env.FILES_MAX_UPLOAD_MB) * 1024 * 1024;
const fileHost = await createFileHost(resolve(import.meta.dir, 'files'), await Bun.file(resolve(root, 'files.html')).text(), {
  uploadToken: process.env.FILES_UPLOAD_TOKEN || '',
  maxUploadBytes
});

const server = Bun.serve({
  development,
  port: process.env.PORT || 3000,
  hostname: process.env.HOST || '0.0.0.0',
  maxRequestBodySize: maxUploadBytes,
  async fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname === '/api/files/upload') {
      server.timeout(request, 255);
      return fileHost.upload(request);
    }
    if (url.pathname === '/api/files/mkdir') return fileHost.createFolder(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    if (pathname === '/files') {
      return new Response(null, { status: 308, headers: { Location: '/files/' } });
    }
    if (pathname.startsWith('/files/')) return fileHost.download(request, pathname);
    if (pathname === '/files.html') {
      return new Response(null, { status: 308, headers: { Location: '/files/' } });
    }
    if (pathname === '/donate') {
      return new Response(null, { status: 308, headers: { Location: '/donate/' } });
    }

    const path = resolve(root, `.${pathname}${pathname.endsWith('/') ? 'index.html' : ''}`);
    if (!path.startsWith(root + sep) || pathname.includes('\0') || pathname.includes('\\')) {
      return new Response('Forbidden', { status: 403 });
    }

    const file = Bun.file(path);
    const exists = await file.exists();
    const body = exists ? file : Bun.file(resolve(root, '404.html'));
    const etag = `W/"${body.size}-${body.lastModified}"`;
    const headers = {
      'Content-Type': body.type,
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache',
      'ETag': etag,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
    if (exists && request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(request.method === 'HEAD' ? null : body, { status: exists ? 200 : 404, headers });
  }
});

if (downloadPort !== undefined) {
  const downloads = Bun.serve({
    development,
    port: downloadPort,
    hostname: process.env.HOST || '0.0.0.0',
    maxRequestBodySize: 0,
    fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
      }
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(request.url).pathname);
      } catch {
        return new Response('Bad request', { status: 400 });
      }
      if (!pathname.startsWith('/files/')) return new Response('Not found', { status: 404 });
      return fileHost.download(request, pathname, { attachmentOnly: true });
    }
  });
  console.log(`Downloads: http://localhost:${downloads.port}`);
}

console.log(`Local: http://localhost:${server.port}`);
