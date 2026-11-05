(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.site-header');
  let scrollFrame = 0;
  const updateHeader = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 24);
    scrollFrame = 0;
  };
  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateHeader);
  }, { passive: true });
  updateHeader();
  if ('IntersectionObserver' in window && !motion.matches) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.remove('is-pending'); observer.unobserve(entry.target);
      }
    }, { threshold: .04 });
    document.querySelectorAll('.section-heading, .lead-project, .current-project, .project, .personal-note, .life-grid, .sports-row, .background-grid').forEach(element => {
      element.classList.add('reveal', 'is-pending'); observer.observe(element);
    });
    motion.addEventListener('change', () => {
      if (motion.matches) document.querySelectorAll('.is-pending').forEach(element => element.classList.remove('is-pending'));
    });
  }
})();
