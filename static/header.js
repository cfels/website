document.querySelector('[data-back]').onclick = function () { top.history.back(); };
document.querySelector('[data-forward]').onclick = function () { top.history.forward(); };
document.querySelector('[data-reload]').onclick = function () {
  var content = top.frames.main || top;
  content.location.reload();
};
