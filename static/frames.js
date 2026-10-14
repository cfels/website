var frameset = document.querySelector('frameset');
var narrow = window.matchMedia ? window.matchMedia('(max-width: 600px)') : null;
var compact = window.matchMedia ? window.matchMedia('(max-width: 359px)') : null;
function fitFrames() {
  frameset.rows = narrow && narrow.matches ? (compact.matches ? '137,*,120' : '137,*,87') : '105,*,58';
}
fitFrames();
for (var i = 0; i < 2; i++) {
  var media = i === 0 ? narrow : compact;
  if (media) {
    if (media.addEventListener) media.addEventListener('change', fitFrames);
    else media.addListener(fitFrames);
  }
}
