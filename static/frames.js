var frameset = document.querySelector('frameset');
var narrow = window.matchMedia ? window.matchMedia('(max-width: 600px)') : null;
function fitFrames() {
  frameset.rows = narrow && narrow.matches ? '145,*,124' : '105,*,58';
}
fitFrames();
if (narrow) {
  if (narrow.addEventListener) narrow.addEventListener('change', fitFrames);
  else narrow.addListener(fitFrames);
}
