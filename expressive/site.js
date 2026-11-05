(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  const artwork = document.querySelector('.hero-art');
  const links = [...document.querySelectorAll('.site-header nav a[href^="#"]')];
  const sections = [...document.querySelectorAll('main > section[id]')];
  let scrollFrame = 0;
  const updateScroll = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 24);
    let current = '';
    const line = (header?.offsetHeight || 90) + 100;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= line) current = section.id;
    }
    if (current === 'travel') current = 'life';
    for (const link of links) {
      if (link.hash === '#' + current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    if (artwork && hero) {
      const progress = motion.matches ? 0 : Math.min(1, Math.max(0, window.scrollY / hero.offsetHeight));
      artwork.style.transform = `translate3d(0, ${progress * 35}px, 0) scale(${1 - progress * .035})`;
      artwork.style.opacity = String(1 - progress * .45);
    }
    scrollFrame = 0;
  };
  const requestScrollUpdate = () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  };
  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', requestScrollUpdate, { passive: true });
  motion.addEventListener('change', requestScrollUpdate);
  updateScroll();
  if ('IntersectionObserver' in window && !motion.matches) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.remove('is-pending'); observer.unobserve(entry.target);
      }
    }, { threshold: .04 });
    document.querySelectorAll('.section-heading, .lead-project, .published-project, .current-project, .forecasting-summary, .personal-note, .life-grid, .sports-row, .background-grid').forEach(element => {
      element.classList.add('reveal', 'is-pending'); observer.observe(element);
    });
    motion.addEventListener('change', () => {
      if (motion.matches) document.querySelectorAll('.is-pending').forEach(element => element.classList.remove('is-pending'));
    });
  }
})();
