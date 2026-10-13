const tools = document.querySelector('#owner-tools');

if (tools) {
  const token = document.querySelector('#owner-token');
  const tokenForm = document.querySelector('#owner-token-form');
  const uploadForm = document.querySelector('#upload-form');
  const folderForm = document.querySelector('#folder-form');
  const folderName = document.querySelector('#folder-name');
  const fileInput = document.querySelector('#upload-file');
  const status = document.querySelector('#owner-status');
  const refresh = document.querySelector('#owner-refresh');
  const progress = document.querySelector('#upload-progress');
  const cancel = document.querySelector('#upload-cancel');
  const formControls = tools.querySelectorAll('input, button[type="submit"]');
  let activeUpload;
  let actionPending = false;
  let uploadCancelled = false;

  tokenForm.addEventListener('submit', event => {
    event.preventDefault();
    if (actionPending || !token.reportValidity()) return;
    status.textContent = 'Token ready. Choose files to upload or create a folder.';
  });

  function ownerHeaders() {
    return { Authorization: `Bearer ${token.value}`, 'X-File-Folder': tools.dataset.folder };
  }

  async function performAction(message, action) {
    if (actionPending || !token.reportValidity()) return;
    actionPending = true;
    formControls.forEach(control => { control.disabled = true; });
    status.textContent = message;
    try {
      status.textContent = await action();
      refresh.hidden = false;
    } catch (error) {
      status.textContent = error instanceof TypeError ? 'Connection interrupted. Check your connection and try again.' : error.message;
    } finally {
      token.value = '';
      formControls.forEach(control => { control.disabled = false; });
      cancel.hidden = true;
      progress.hidden = true;
      activeUpload = null;
      actionPending = false;
    }
  }

  folderForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = folderName.value;
    return performAction(`Creating ${name}…`, async () => {
      const response = await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: { ...ownerHeaders(), 'X-File-Name': encodeURIComponent(name) }
      });
      if (!response.ok) throw new Error(await response.text());
      folderName.value = '';
      return `Created ${name}/ ☆`;
    });
  });

  cancel.addEventListener('click', () => {
    uploadCancelled = true;
    activeUpload?.abort();
  });

  function sendUpload(file, label, headers) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      activeUpload = request;
      request.open('POST', '/api/files/upload');
      for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
      request.setRequestHeader('Content-Type', 'application/octet-stream');
      request.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
      request.upload.addEventListener('progress', event => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.floor(event.loaded / event.total * 100);
          progress.value = percent;
          status.textContent = percent === 100 ? `${label}… Saving…` : `${label}… ${percent}%`;
        }
      });
      request.addEventListener('load', () => resolve(request));
      request.addEventListener('error', () => reject(new TypeError('Connection interrupted')));
      request.addEventListener('abort', () => reject(new Error('Uploads cancelled.')));
      request.send(file);
    });
  }

  uploadForm.addEventListener('submit', event => {
    event.preventDefault();
    if (actionPending) return;
    const files = Array.from(fileInput.files);
    if (!files.length) return;
    const oversized = files.find(file => file.size > Number(fileInput.dataset.maxSize));
    if (oversized) {
      status.textContent = `${oversized.name} is too large. Choose files within the per-file upload limit.`;
      return;
    }
    return performAction(`Uploading ${files.length} ${files.length === 1 ? 'file' : 'files'}…`, async () => {
      const headers = ownerHeaders();
      const failures = [];
      let uploaded = 0;
      uploadCancelled = false;
      progress.hidden = false;
      cancel.hidden = false;
      try {
        for (const [index, file] of files.entries()) {
          if (uploadCancelled) throw new Error('Uploads cancelled.');
          const label = `Uploading ${index + 1} of ${files.length}: ${file.name}`;
          progress.value = 0;
          status.textContent = `${label}…`;
          const response = await sendUpload(file, label, headers);
          activeUpload = null;
          if (response.status === 201) {
            uploaded++;
            refresh.hidden = false;
          } else {
            const message = `${file.name}: ${response.responseText || `Upload failed (${response.status})`}`;
            if ([401, 403, 503].includes(response.status)) throw new Error(message);
            failures.push(message);
          }
        }
      } catch (error) {
        const message = error instanceof TypeError ? 'Connection interrupted. Check your connection and try again.' : error.message;
        throw new Error(`${uploaded} of ${files.length} files uploaded. ${message}${failures.length ? `\n${failures.join('\n')}` : ''}`);
      }
      if (!failures.length) fileInput.value = '';
      return `${uploaded} of ${files.length} files uploaded${failures.length ? `.\n${failures.join('\n')}` : ' ☆'}`;
    });
  });
}
