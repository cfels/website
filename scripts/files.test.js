import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

const source = await Bun.file(new URL('../static/files.js', import.meta.url)).text();
const token = 'test-only-owner-token-with-at-least-32-characters';

class Control {
  listeners = new Map();
  disabled = false;
  hidden = false;
  value = '';
  textContent = '';
  dataset = {};

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  dispatch(name, event = {}) {
    return this.listeners.get(name)?.(event);
  }
}

function setup(files, validToken = true) {
  const ids = ['owner-tools', 'owner-token', 'owner-token-form', 'upload-form', 'folder-form', 'folder-name', 'upload-file', 'owner-status', 'owner-refresh', 'upload-progress', 'upload-cancel'];
  const elements = Object.fromEntries(ids.map(id => [id, new Control()]));
  const controls = [elements['owner-token'], elements['folder-name'], elements['upload-file'], new Control(), new Control()];
  elements['owner-tools'].querySelectorAll = () => controls;
  elements['owner-tools'].dataset.folder = encodeURIComponent('nested folder ☆');
  elements['owner-token'].value = token;
  elements['owner-token'].reportValidity = () => validToken;
  elements['upload-file'].files = files;
  elements['upload-file'].dataset.maxSize = '1024';
  elements['upload-file'].value = 'selected files';
  for (const id of ['owner-refresh', 'upload-progress', 'upload-cancel']) elements[id].hidden = true;
  const requests = [];
  const folderRequests = [];

  class UploadRequest extends Control {
    upload = new Control();
    headers = {};

    open(method, url) {
      this.method = method;
      this.url = url;
    }

    setRequestHeader(name, value) {
      this.headers[name] = value;
    }

    send(file) {
      this.file = file;
      requests.push(this);
    }

    respond(status, text = '') {
      this.status = status;
      this.responseText = text;
      this.dispatch('load');
    }

    abort() {
      this.dispatch('abort');
    }
  }

  runInNewContext(source, {
    document: { querySelector: selector => elements[selector.slice(1)] },
    XMLHttpRequest: UploadRequest,
    TypeError,
    Error,
    fetch: async (...args) => {
      folderRequests.push(args);
      return new Response('Created', { status: 201 });
    }
  });
  return { elements, controls, requests, folderRequests, submit: () => elements['upload-form'].dispatch('submit', { preventDefault() {} }) };
}

test('multiple files upload sequentially to the current folder with progress and one token entry', async () => {
  const files = [{ name: 'first.txt', size: 10 }, { name: '空 #%.txt', size: 20 }, { name: 'third.txt', size: 30 }];
  const { elements, controls, requests, folderRequests, submit } = setup(files);
  const completion = submit();
  expect(requests).toHaveLength(1);
  expect(controls.every(control => control.disabled)).toBe(true);
  expect(elements['upload-cancel'].disabled).toBe(false);
  await submit();
  await elements['folder-form'].dispatch('submit', { preventDefault() {} });
  expect(requests).toHaveLength(1);
  expect(folderRequests).toHaveLength(0);
  requests[0].respond(201);
  await Promise.resolve();
  expect(requests).toHaveLength(2);
  requests[1].upload.dispatch('progress', { lengthComputable: true, loaded: 15, total: 20 });
  expect(elements['upload-progress'].value).toBe(75);
  expect(elements['owner-status'].textContent).toContain('Uploading 2 of 3: 空 #%.txt… 75%');
  expect(elements['owner-refresh'].hidden).toBe(false);
  requests[1].respond(201);
  await Promise.resolve();
  expect(requests).toHaveLength(3);
  requests[2].respond(201);
  await completion;
  for (const [index, request] of requests.entries()) {
    expect(request.method).toBe('POST');
    expect(request.url).toBe('/api/files/upload');
    expect(request.file).toBe(files[index]);
    expect(request.headers).toEqual({
      Authorization: `Bearer ${token}`,
      'X-File-Folder': encodeURIComponent('nested folder ☆'),
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(files[index].name)
    });
  }
  expect(elements['owner-status'].textContent).toBe('3 of 3 files uploaded ☆');
  expect(elements['owner-token'].value).toBe('');
  expect(elements['upload-file'].value).toBe('');
  expect(controls.every(control => !control.disabled)).toBe(true);
  expect(elements['upload-progress'].hidden).toBe(true);
  expect(elements['upload-cancel'].hidden).toBe(true);
});

test('all file sizes and the token are checked before starting an upload queue', async () => {
  const oversized = setup([{ name: 'small.txt', size: 1 }, { name: 'large.txt', size: 1025 }]);
  await oversized.submit();
  expect(oversized.requests).toHaveLength(0);
  expect(oversized.elements['owner-status'].textContent).toContain('large.txt is too large');
  expect(oversized.controls.every(control => !control.disabled)).toBe(true);
  const unauthorized = setup([{ name: 'small.txt', size: 1 }], false);
  await unauthorized.submit();
  expect(unauthorized.requests).toHaveLength(0);
  const empty = setup([]);
  await empty.submit();
  expect(empty.requests).toHaveLength(0);
});

test('cancelling a batch stops the active upload and the queue while preserving completed uploads', async () => {
  const { elements, controls, requests, submit } = setup([{ name: 'first.txt', size: 1 }, { name: 'second.txt', size: 2 }, { name: 'third.txt', size: 3 }]);
  const completion = submit();
  requests[0].respond(201);
  await Promise.resolve();
  elements['upload-cancel'].dispatch('click');
  await completion;
  expect(requests).toHaveLength(2);
  expect(elements['owner-status'].textContent).toBe('1 of 3 files uploaded. Uploads cancelled.');
  expect(elements['owner-refresh'].hidden).toBe(false);
  expect(elements['owner-token'].value).toBe('');
  expect(controls.every(control => !control.disabled)).toBe(true);
  expect(elements['upload-cancel'].hidden).toBe(true);
});

test('duplicate files are reported and do not prevent the other selected files from uploading', async () => {
  const { elements, requests, submit } = setup([{ name: 'existing.txt', size: 1 }, { name: 'new.txt', size: 2 }]);
  const completion = submit();
  requests[0].respond(409, 'That filename already exists; choose another name');
  await Promise.resolve();
  expect(requests).toHaveLength(2);
  requests[1].respond(201);
  await completion;
  expect(elements['owner-status'].textContent).toBe('1 of 2 files uploaded.\nexisting.txt: That filename already exists; choose another name');
  expect(elements['owner-token'].value).toBe('');
});

for (const status of [401, 403, 503]) {
  test(`an owner authorization error (${status}) stops the whole upload queue`, async () => {
    const { elements, controls, requests, submit } = setup([{ name: 'first.txt', size: 1 }, { name: 'second.txt', size: 2 }]);
    const completion = submit();
    requests[0].respond(status, 'Owner action rejected');
    await completion;
    expect(requests).toHaveLength(1);
    expect(elements['owner-status'].textContent).toBe('0 of 2 files uploaded. first.txt: Owner action rejected');
    expect(elements['owner-token'].value).toBe('');
    expect(controls.every(control => !control.disabled)).toBe(true);
    expect(elements['owner-refresh'].hidden).toBe(true);
  });
}

test('a connection failure stops the queue and reports completed files without exposing the token', async () => {
  const { elements, requests, submit } = setup([{ name: 'first.txt', size: 1 }, { name: 'second.txt', size: 2 }, { name: 'third.txt', size: 3 }]);
  const completion = submit();
  requests[0].respond(201);
  await Promise.resolve();
  requests[1].dispatch('error');
  await completion;
  expect(requests).toHaveLength(2);
  expect(elements['owner-status'].textContent).toContain('1 of 3 files uploaded. Connection interrupted.');
  expect(elements['owner-status'].textContent).not.toContain(token);
  expect(elements['owner-token'].value).toBe('');
  expect(elements['owner-refresh'].hidden).toBe(false);
});

test('empty files upload without invalid progress values', async () => {
  const { elements, requests, submit } = setup([{ name: 'empty.txt', size: 0 }]);
  const completion = submit();
  requests[0].upload.dispatch('progress', { lengthComputable: true, loaded: 0, total: 0 });
  expect(elements['upload-progress'].value).toBe(0);
  requests[0].respond(201);
  await completion;
  expect(elements['owner-status'].textContent).toBe('1 of 1 files uploaded ☆');
});

test('submitting the token-only form prevents navigation and never sends a credential request', async () => {
  const { elements, requests, folderRequests } = setup([]);
  let prevented = false;
  elements['owner-token-form'].dispatch('submit', { preventDefault() { prevented = true; } });
  expect(prevented).toBe(true);
  expect(requests).toHaveLength(0);
  expect(folderRequests).toHaveLength(0);
  expect(elements['owner-token'].value).toBe(token);
});

test('an autofilled token is read at upload time without needing a keyboard or input event', async () => {
  const { elements, requests, submit } = setup([{ name: 'notes.txt', size: 1 }]);
  const autofilled = 'autofilled-test-only-token-at-least-32-characters';
  elements['owner-token'].value = autofilled;
  const completion = submit();
  expect(requests[0].headers.Authorization).toBe(`Bearer ${autofilled}`);
  requests[0].respond(201);
  await completion;
  expect(elements['owner-token'].value).toBe('');
});
