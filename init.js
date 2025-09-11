(function() {
  const styleId = 'dynamic-soft-dark-mode-by-filter';
  const css = `
    html {
      -webkit-filter: invert(92%) hue-rotate(180deg) brightness(95%) contrast(90%);
      filter: invert(92%) hue-rotate(180deg) brightness(95%) contrast(90%);
      background: #fff;
    }
    img, video, iframe, picture {
      -webkit-filter: invert(100%) hue-rotate(180deg);
      filter: invert(100%) hue-rotate(180deg);
    }
  `;

  function applyDarkMode() {
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = css;
      (document.head || document.documentElement).appendChild(style);
    }
  }

  const hostname = window.location.hostname;
  chrome.storage.local.get([hostname], function(result) {
    if (result[hostname]) {
      applyDarkMode();
    }
  });
})();
