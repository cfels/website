(function () {
  if (window.top !== window.self) return;

  document.documentElement.className += ' standalone-page';

  var bars = ['header', 'footer'];
  for (var i = 0; i < bars.length; i++) {
    var frame = document.createElement('iframe');
    frame.className = 'page-bar page-' + bars[i];
    frame.src = '/' + bars[i] + '.html';
    frame.title = i === 0 ? 'Site navigation' : 'Buttons and source link';
    frame.setAttribute('frameborder', '0');
    frame.onload = function () {
      var links = this.contentWindow.document.querySelectorAll('a[target="main"]');
      for (var link = 0; link < links.length; link++) links[link].target = '_top';
    };
    document.body.appendChild(frame);
  }
}());
