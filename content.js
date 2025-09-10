(function() {
  /**
   * A script to toggle a softer, less contrasted CSS filter-based dark mode.
   * ID for the style tag to check if it's already injected.
   */
  const styleId = 'dynamic-soft-dark-mode-by-filter';

  // The CSS rules for a softer dark mode.
  const css = `
    /* Apply a less intense inversion with adjusted brightness and contrast */
    html {
      -webkit-filter: invert(92%) hue-rotate(180deg) brightness(95%) contrast(90%);
      filter: invert(92%) hue-rotate(180deg) brightness(95%) contrast(90%);
      /* This ensures the background inverts properly */
      background: #fff;
    }

    /* Re-invert media elements to make them look normal */
    img, video, iframe, picture {
      -webkit-filter: invert(100%) hue-rotate(180deg);
      filter: invert(100%) hue-rotate(180deg);
    }
  `;

  // Find if our style tag already exists.
  const existingStyle = document.getElementById(styleId);

  if (existingStyle) {
    // If it exists, remove it to toggle off.
    existingStyle.remove();
  } else {
    // If it doesn't exist, create it and add it.
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = css;
    document.head.appendChild(style);
  }
})();
