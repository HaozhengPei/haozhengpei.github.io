(() => {
  'use strict';
  // Keep the same reading position when changing the page language.
  document.querySelectorAll('.language-switch').forEach(link => {
    link.addEventListener('click', () => {
      const destination = new URL(link.href);
      destination.hash = location.hash;
      link.href = destination.href;
    });
  });
})();
