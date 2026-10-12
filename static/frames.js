const frameset = document.querySelector('frameset');
const narrow = matchMedia('(max-width: 600px)');
function fitFrames() {
  frameset.rows = narrow.matches ? '145,*,124' : '105,*,58';
}
fitFrames();
narrow.addEventListener('change', fitFrames);
