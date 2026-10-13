(function () {
  var elements = 'main header footer nav section article aside figure figcaption details summary time progress'.split(' ');
  var i;
  for (i = 0; i < elements.length; i++) document.createElement(elements[i]);

  function loadImages() {
    var images = document.getElementsByTagName('img');
    var links = document.getElementsByTagName('a');
    for (i = 0; i < images.length; i++) {
      if (/\.webp$/.test(images[i].src)) {
        images[i].src = images[i].src.replace(/\.webp$/, /(^|\s)fan-stamp(\s|$)/.test(images[i].className) ? '-stamp.png' : '.png');
      }
    }
    for (i = 0; i < links.length; i++) {
      if (/\.webp$/.test(links[i].href)) links[i].href = links[i].href.replace(/\.webp$/, '.png');
    }
  }
  if (window.attachEvent) window.attachEvent('onload', loadImages);
  else window.addEventListener('load', loadImages);
}());
