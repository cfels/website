(function () {
  var elements = 'main header footer nav section article aside figure figcaption details summary time progress'.split(' ');
  var i;
  for (i = 0; i < elements.length; i++) document.createElement(elements[i]);
  var layoutWidth;
  var layoutHeight;
  var fitting = false;

  function fitLayout() {
    var container = document.querySelector('.site, .browser-chrome, .footer-strip');
    if (!container || fitting || (layoutWidth === Math.min(800, document.documentElement.clientWidth) && layoutHeight === document.documentElement.clientHeight)) return;
    var address = document.querySelector('.address');
    var star = document.querySelector('.toolbar-star');
    var strip = document.querySelector('.button-strip');
    var columns = document.querySelector('.home-columns');
    var artwork = document.querySelector('.art-link');
    var character = document.querySelector('.featured-character');
    var search = document.querySelector('.file-search');
    fitting = true;
    try {
      // IE8 can reclaim scrollbar width after the first layout pass.
      for (var pass = 0; pass < 2; pass++) {
        var width = Math.min(800, document.documentElement.clientWidth);
        var height = document.documentElement.clientHeight;
        if (container.style.width !== width + 'px') container.style.width = width + 'px';
        if (/(^|\s)site(\s|$)/.test(container.className)) container.style.minHeight = /(^|\s)standalone-page(\s|$)/.test(document.documentElement.className) ? '0px' : Math.max(0, height - 23) + 'px';
        var className = document.body.className.replace(/(^|\s)legacy-narrow(?=\s|$)/g, '') + (width < 800 ? ' legacy-narrow' : '');
        if (document.body.className !== className) document.body.className = className;
        if (address) address.style.width = Math.max(0, container.clientWidth - address.offsetLeft - star.offsetWidth - 28) + 'px';
        if (strip) {
          var items = strip.children;
          var available = strip.clientWidth - 18;
          for (var item = 0; item < items.length; item++) available -= items[item].offsetWidth;
          var margin = Math.max(0, available / (items.length * 2));
          for (item = 0; item < items.length; item++) items[item].style.margin = '0 ' + margin + 'px';
        }
        if (columns) {
          var columnWidth = width < 800 ? Math.round((columns.clientWidth - 12) * 3 / 5) : 450;
          columns.querySelector('div').style.width = columnWidth + 'px';
          artwork.style.height = width < 800 ? columnWidth * 493 / 800 + 'px' : '';
          character.style.top = width < 800 ? width * 0.29 + 'px' : '';
        }
        if (search) search.querySelector('input').style.width = Math.max(0, search.clientWidth - search.querySelector('button').offsetWidth - search.querySelector('a').offsetWidth - 12) + 'px';
      }
      layoutWidth = width;
      layoutHeight = height;
    } finally {
      fitting = false;
    }
  }

  function initializePage() {
    var heading = document.querySelector('.masthead h1');
    if (heading) {
      var shadow = document.createElement('span');
      shadow.className = 'legacy-text-shadow';
      shadow.setAttribute('aria-hidden', 'true');
      for (var child = 0; child < heading.childNodes.length; child++) shadow.appendChild(heading.childNodes[child].cloneNode(true));
      heading.insertBefore(shadow, heading.firstChild);
    }
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
    fitLayout();
    if (window.attachEvent) window.attachEvent('onresize', fitLayout);
    else window.addEventListener('resize', fitLayout);
  }
  if (window.attachEvent) {
    window.attachEvent('onload', initializePage);
  } else {
    window.addEventListener('load', initializePage);
  }
}());
