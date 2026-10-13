import { constants } from 'node:fs';
import { link, mkdir, open, readdir, readFile, unlink } from 'node:fs/promises';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';

const readFlags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const directoryFlags = readFlags | constants.O_DIRECTORY;
export const defaultMaxUploadBytes = 10 * 1024 * 1024 * 1024;
const hiddenErrors = new Set(['ENOENT', 'ENOTDIR', 'ELOOP', 'EACCES', 'EPERM']);
const pageHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer'
};

function validName(name) {
  return name.length > 0 && !name.startsWith('.') && !/[\u0000-\u001f\u007f/\\]/u.test(name) && Buffer.byteLength(name) <= 255;
}

function encodeName(name) {
  return encodeURIComponent(name).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function fileURL(parts, directory = false) {
  return `/files/${parts.map(encodeName).join('/')}${directory && parts.length ? '/' : ''}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function formatSize(size) {
  if (size < 1024) return `${size} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let unit = -1;
  do {
    size /= 1024;
    unit++;
  } while (size >= 1024 && unit < units.length - 1);
  return `${size.toFixed(1)} ${units[unit]}`;
}

function failure(message, status) {
  return new Response(message, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

async function mountID(handle) {
  const info = await readFile(`/proc/self/fdinfo/${handle.fd}`, 'utf8');
  const id = info.match(/^mnt_id:\s+(\d+)$/m)?.[1];
  if (!id) throw new Error('Cannot verify the file host mount boundary.');
  return id;
}

export async function createFileHost(rootPath, template, { uploadToken = '', maxUploadBytes = defaultMaxUploadBytes } = {}) {
  if (process.platform !== 'linux') throw new Error('The file host requires Linux and /proc for restricted filesystem access.');
  if (uploadToken && uploadToken.length < 32) throw new Error('FILES_UPLOAD_TOKEN must contain at least 32 characters.');
  if (!Number.isSafeInteger(maxUploadBytes) || maxUploadBytes < 1) throw new Error('The upload size limit must be a positive integer.');

  const root = await open(rootPath, directoryFlags);
  let rootStat;
  let rootMountID;
  try {
    rootStat = await root.stat();
    rootMountID = await mountID(root);
  } catch (error) {
    await root.close();
    throw error;
  }
  const tokenHash = uploadToken ? createHash('sha256').update(uploadToken).digest() : null;

  async function openEntry(directory, name, flags = readFlags) {
    // Descriptor-relative opens and O_NOFOLLOW keep each path component inside the pinned directory.
    const handle = await open(`/proc/self/fd/${directory.fd}/${name}`, flags);
    try {
      const stat = await handle.stat();
      if (stat.dev !== rootStat.dev || (!stat.isDirectory() && (!stat.isFile() || stat.nlink !== 1)) || await mountID(handle) !== rootMountID) {
        await handle.close();
        return null;
      }
      return { handle, stat };
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  async function openPath(parts, finalFlags = readFlags) {
    let handle = root;
    let stat = rootStat;
    try {
      for (const [index, part] of parts.entries()) {
        const entry = await openEntry(handle, part, index < parts.length - 1 ? directoryFlags : finalFlags);
        if (handle !== root) await handle.close();
        handle = root;
        if (!entry) return null;
        ({ handle, stat } = entry);
      }
      return { handle, stat };
    } catch (error) {
      if (handle !== root) await handle.close();
      throw error;
    }
  }

  async function directoryPage(request, handle, parts) {
    const query = (new URL(request.url).searchParams.get('q') || '').trim();
    if (query.length > 255) return failure('Search is limited to 255 characters', 400);
    const search = query.toLowerCase();
    const entries = [];
    for (const name of await readdir(`/proc/self/fd/${handle.fd}`)) {
      if (!validName(name) || (search && !name.toLowerCase().includes(search))) continue;
      let entry;
      try {
        entry = await openEntry(handle, name);
        if (entry) entries.push({ name, directory: entry.stat.isDirectory(), size: entry.stat.size, modified: entry.stat.mtime.toISOString() });
      } catch (error) {
        if (!hiddenErrors.has(error.code)) throw error;
      } finally {
        if (entry) await entry.handle.close();
      }
    }
    entries.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name, 'en'));
    let rows = parts.length ? `<tr><td><a href="${fileURL(parts.slice(0, -1), true)}">..\\ (parent folder)</a></td><td>Folder</td><td>—</td></tr>` : '';
    rows += entries.map(entry => `<tr><td><a href="${fileURL([...parts, entry.name], entry.directory)}">${escapeHTML(entry.name)}${entry.directory ? '\\' : ''}</a></td><td>${entry.directory ? 'Folder' : formatSize(entry.size)}</td><td><time datetime="${entry.modified}">${entry.modified.slice(0, 10)}</time></td></tr>`).join('');
    if (!entries.length) rows += `<tr><td colspan="3">${query ? 'No matching files or folders.' : 'No files here yet :p'}</td></tr>`;

    const response = new HTMLRewriter()
      .on('#folder-path', { element: element => element.setInnerContent(`C:\\files\\${parts.length ? parts.join('\\') + '\\' : ''}`) })
      .on('#file-search', { element: element => element.setAttribute('action', fileURL(parts, true)) })
      .on('#file-query', { element: element => element.setAttribute('value', escapeHTML(query)) })
      .on('#search-clear', { element: element => element.setAttribute('href', fileURL(parts, true)) })
      .on('#file-search-results', { element: element => {
        if (query) {
          element.removeAttribute('hidden');
          element.setInnerContent(`${entries.length} ${entries.length === 1 ? 'match' : 'matches'} for “${query}”`);
        }
      } })
      .on('#file-entries', { element: element => element.setInnerContent(rows, { html: true }) })
      .on('#owner-tools', { element: element => {
        if (!tokenHash || request.headers.get('x-forwarded-proto') === 'http') element.remove();
        else element.setAttribute('data-folder', encodeName(parts.join('/')));
      } })
      .on('#owner-refresh a', { element: element => element.setAttribute('href', fileURL(parts, true)) })
      .on('#upload-file', { element: element => element.setAttribute('data-max-size', String(maxUploadBytes)) })
      .on('#upload-limit', { element: element => element.setInnerContent(formatSize(maxUploadBytes)) })
      .transform(new Response(template, { headers: pageHeaders }));
    if (request.method === 'HEAD') return new Response(null, { headers: pageHeaders });
    return response;
  }

  async function download(request, pathname) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    const parts = pathname.slice('/files/'.length).split('/');
    if (parts.at(-1) === '') parts.pop();
    if (parts.some(part => !validName(part))) return failure('Forbidden', 403);
    let entry;
    let streaming = false;
    try {
      entry = await openPath(parts);
      if (!entry) return failure('Not found', 404);
      const { handle, stat } = entry;
      if (stat.isDirectory()) {
        if (!pathname.endsWith('/')) return new Response(null, { status: 308, headers: { Location: fileURL(parts, true) } });
        return await directoryPage(request, handle, parts);
      }
      if (pathname.endsWith('/')) return failure('Not found', 404);
      const headers = {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodeName(parts.at(-1))}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox; default-src 'none'; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer'
      };
      if (request.method === 'HEAD') return new Response(null, { headers: { ...headers, 'Content-Length': String(stat.size) } });
      const body = Readable.toWeb(handle.createReadStream());
      streaming = true;
      return new Response(body, { headers });
    } catch (error) {
      if (hiddenErrors.has(error.code)) return failure('Not found', 404);
      console.error('File download failed:', error.code || error.name);
      return failure('Unable to read files', 500);
    } finally {
      if (entry && entry.handle !== root && !streaming) await entry.handle.close();
    }
  }

  function authorize(request) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    if (!tokenHash) return failure('Uploads are not configured', 503);
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ') || !timingSafeEqual(tokenHash, createHash('sha256').update(authorization.slice(7)).digest())) {
      return failure('Invalid owner token', 401);
    }
    if (request.headers.get('sec-fetch-site') === 'cross-site') return failure('Forbidden', 403);
    return null;
  }

  function mutationTarget(request) {
    let name;
    let parts;
    try {
      name = decodeURIComponent(request.headers.get('x-file-name') || '');
      const folder = decodeURIComponent(request.headers.get('x-file-folder') || '');
      parts = folder ? folder.split('/') : [];
    } catch {
      return failure('Invalid name or folder', 400);
    }
    if (!validName(name)) return failure('Use a plain filename without folders or a leading dot', 400);
    if (parts.some(part => !validName(part))) return failure('Invalid folder', 400);
    return { name, parts };
  }

  async function createFolder(request) {
    const unauthorized = authorize(request);
    if (unauthorized) return unauthorized;
    const target = mutationTarget(request);
    if (target instanceof Response) return target;
    let directory;
    try {
      directory = await openPath(target.parts, directoryFlags);
      if (!directory) return failure('Folder not found', 404);
      await mkdir(`/proc/self/fd/${directory.handle.fd}/${target.name}`, { mode: 0o700 });
      return Response.json({ name: target.name, url: fileURL([...target.parts, target.name], true) }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error.code === 'EEXIST') return failure('That name already exists; choose another name', 409);
      if (hiddenErrors.has(error.code)) return failure('Folder not found', 404);
      console.error('Folder creation failed:', error.code || error.name);
      return failure('Unable to create folder', 500);
    } finally {
      if (directory && directory.handle !== root) await directory.handle.close();
    }
  }

  async function upload(request) {
    const unauthorized = authorize(request);
    if (unauthorized) return unauthorized;
    const target = mutationTarget(request);
    if (target instanceof Response) return target;
    if (Number(request.headers.get('content-length')) > maxUploadBytes) return failure('File is too large', 413);

    let directory;
    let temporaryPath;
    let temporary;
    let reader;
    let size = 0;
    try {
      directory = await openPath(target.parts, directoryFlags);
      if (!directory) return failure('Folder not found', 404);
      const directoryPath = `/proc/self/fd/${directory.handle.fd}`;
      temporaryPath = `${directoryPath}/.upload-${randomUUID()}`;
      temporary = await open(temporaryPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      if (request.body) {
        reader = request.body.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxUploadBytes) {
            await reader.cancel();
            return failure('File is too large', 413);
          }
          let offset = 0;
          while (offset < value.byteLength) {
            const { bytesWritten } = await temporary.write(value, offset, value.byteLength - offset);
            if (!bytesWritten) throw new Error('Upload write failed');
            offset += bytesWritten;
          }
        }
      }
      await temporary.sync();
      await link(temporaryPath, `${directoryPath}/${target.name}`);
      return Response.json({ name: target.name, url: fileURL([...target.parts, target.name]), size }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error.code === 'EEXIST') return failure('That filename already exists; choose another name', 409);
      if (hiddenErrors.has(error.code)) return failure('Folder not found', 404);
      console.error('File upload failed:', error.code || error.name);
      return failure('Upload failed', 500);
    } finally {
      if (reader) reader.releaseLock();
      try {
        if (temporary) {
          await temporary.close();
          await unlink(temporaryPath);
        }
      } finally {
        if (directory && directory.handle !== root) await directory.handle.close();
      }
    }
  }

  return { download, upload, createFolder, close: () => root.close() };
}
