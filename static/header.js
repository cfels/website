document.querySelector('[data-back]').addEventListener('click', () => top.history.back());
document.querySelector('[data-forward]').addEventListener('click', () => top.history.forward());
document.querySelector('[data-reload]').addEventListener('click', () => {
  const content = top.frames.main;
  if (content) content.location.reload();
});
