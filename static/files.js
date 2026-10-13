const tools = document.querySelector('#owner-tools');

if (tools) {
  const token = document.querySelector('#owner-token');
  const uploadForm = document.querySelector('#upload-form');
  const folderForm = document.querySelector('#folder-form');
  const folderName = document.querySelector('#folder-name');
  const fileInput = document.querySelector('#upload-file');
  const status = document.querySelector('#owner-status');
  const refresh = document.querySelector('#owner-refresh');
  const progress = document.querySelector('#upload-progress');
  const cancel = document.querySelector('#upload-cancel');
  const submitButtons = tools.querySelectorAll('button[type="submit"]');
  let activeUpload;

  function ownerHeaders() {
    return { Authorization: `Bearer ${token.value}`, 'X-File-Folder': tools.dataset.folder };
  }

  async function performAction(message, action) {
    if (!token.reportValidity()) return;
    submitButtons.forEach(button => { button.disabled = true; });
    status.textContent = message;
    try {
      status.textContent = await action();
      refresh.hidden = false;
    } catch (error) {
      status.textContent = error instanceof TypeError ? 'Connection interrupted. Check your connection and try again.' : error.message;
    } finally {
      token.value = '';
      submitButtons.forEach(button => { button.disabled = false; });
      cancel.hidden = true;
      progress.hidden = true;
      activeUpload = null;
    }
  }

  folderForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = folderName.value;
    performAction(`Creating ${name}…`, async () => {
      const response = await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: { ...ownerHeaders(), 'X-File-Name': encodeURIComponent(name) }
      });
      if (!response.ok) throw new Error(await response.text());
      folderName.value = '';
      return `Created ${name}/ ☆`;
    });
  });

  cancel.addEventListener('click', () => activeUpload?.abort());

  uploadForm.addEventListener('submit', event => {
    event.preventDefault();
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > Number(fileInput.dataset.maxSize)) {
      status.textContent = 'File is too large. Choose a file within the upload limit.';
      return;
    }
    performAction(`Uploading ${file.name}…`, async () => {
      progress.value = 0;
      progress.hidden = false;
      cancel.hidden = false;
      await new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        activeUpload = request;
        request.open('POST', '/api/files/upload');
        for (const [name, value] of Object.entries(ownerHeaders())) request.setRequestHeader(name, value);
        request.setRequestHeader('Content-Type', 'application/octet-stream');
        request.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
        request.upload.addEventListener('progress', event => {
          if (event.lengthComputable) {
            const percent = Math.floor(event.loaded / event.total * 100);
            progress.value = percent;
            status.textContent = percent === 100 ? `Saving ${file.name}…` : `Uploading ${file.name}… ${percent}%`;
          }
        });
        request.addEventListener('load', () => {
          if (request.status === 201) resolve();
          else reject(new Error(request.responseText || `Upload failed (${request.status})`));
        });
        request.addEventListener('error', () => reject(new TypeError('Connection interrupted')));
        request.addEventListener('abort', () => reject(new Error('Upload cancelled.')));
        request.send(file);
      });
      fileInput.value = '';
      return `Uploaded ${file.name} ☆`;
    });
  });
}
