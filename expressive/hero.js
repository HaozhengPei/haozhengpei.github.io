(() => {
  'use strict';
  const canvas = document.getElementById('hero-canvas');
  const stage = document.getElementById('hero-art');
  if (!canvas || !stage) return;
  let ctx;
  try { ctx = canvas.getContext('2d', { alpha: true }); } catch (_) { return; }
  if (!ctx) return;

  const fallback = document.getElementById('hero-fallback');
  const button = document.getElementById('motion-toggle');
  const symbol = button?.querySelector('.motion-symbol');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const FRAME_INTERVAL = 1000 / 60;
  let width = 0, height = 0, elapsed = 0;
  let playing = !preference.matches;
  let inView = true, frame = 0, previous = 0, ready = false;
  let compact = false;

  function controls() {
    button?.setAttribute('aria-label', playing ? 'Pause background animation' : 'Play background animation');
    button?.removeAttribute('aria-pressed');
    if (symbol) symbol.textContent = playing ? 'Ⅱ' : '▷';
  }

  // Broad, overlapping translucent sheets form a single moving veil.
  // The curves evolve continuously; there are no endpoints or demo states.
  function veil(index, time, inset = 0) {
    const k = index;
    const drift = Math.sin(time * 0.19) * 0.045;
    const lift = Math.sin(time * 0.13 + 0.6) * 0.037;
    const fold = Math.sin(time * 0.16 + k * 0.13) * 0.028;
    const breath = Math.cos(time * 0.11 + k * 0.17) * 0.018;
    const point = (x, y) => [x * width, y * height];
    const move = (x, y) => ctx.moveTo(...point(x, y));
    const line = (x, y) => ctx.lineTo(...point(x, y));
    const curve = (x1, y1, x2, y2, x, y) => ctx.bezierCurveTo(...point(x1, y1), ...point(x2, y2), ...point(x, y));
    ctx.beginPath();
    move(-0.12, 0.97 - k * 0.021 + inset);
    curve(0.31, 0.98 - k * 0.016 + lift, 0.12 + drift, 0.38 - k * 0.016 + fold, 0.48, 0.46 - k * 0.012 + breath + inset);
    curve(0.82 + drift, 0.53 - k * 0.009 + fold, 0.58 - drift, 0.05 + lift, 1.08, -0.09 + k * 0.014 + inset);
    line(1.12, 0.14 + k * 0.012 - inset);
    curve(0.70 - drift, 0.23 + lift, 0.94 + drift, 0.79 - k * 0.012 + fold, 0.52, 0.67 - k * 0.008 + breath - inset);
    curve(0.18 + drift, 0.59 - k * 0.008 + fold, 0.33, 1.10 - k * 0.010 + lift, -0.12, 1.10 - k * 0.012 - inset);
    ctx.closePath();
  }

  function sheetGradient(index, opacity) {
    const gradient = ctx.createLinearGradient(width * 0.04, height * 0.96, width * 0.95, height * 0.06);
    const a = opacity;
    gradient.addColorStop(0, 'rgba(62,104,141,0)');
    gradient.addColorStop(0.16, `rgba(77,131,176,${a * 0.28})`);
    gradient.addColorStop(0.35, `rgba(149,176,207,${a * 0.78})`);
    gradient.addColorStop(0.48, `rgba(190,184,211,${a * 0.70})`);
    gradient.addColorStop(0.60, `rgba(229,225,219,${a})`);
    gradient.addColorStop(0.73, `rgba(161,190,211,${a * 0.68})`);
    gradient.addColorStop(0.85, index % 3 === 0 ? `rgba(205,170,130,${a * 0.52})` : `rgba(112,151,188,${a * 0.42})`);
    gradient.addColorStop(1, 'rgba(75,111,147,0)');
    return gradient;
  }

  function draw() {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // A soft underlayer makes the edges luminous without outlines or stars.
    ctx.filter = `blur(${compact ? 14 : 24}px)`;
    ctx.fillStyle = sheetGradient(0, 0.20);
    veil(0, elapsed); ctx.fill();
    ctx.filter = 'none';

    const layers = compact ? 5 : 8;
    for (let i = 0; i < layers; i += 1) {
      const k = i * 7 / Math.max(1, layers - 1);
      ctx.filter = i < 2 ? `blur(${compact ? 3 : 5}px)` : 'none';
      ctx.fillStyle = sheetGradient(i, compact ? 0.115 : 0.085);
      veil(k, elapsed); ctx.fill();
    }

    // One broad fold catches a little more light; it remains a filled surface.
    ctx.filter = `blur(${compact ? 2 : 3}px)`;
    ctx.fillStyle = sheetGradient(2, 0.12);
    veil(3.6, elapsed, 0.022); ctx.fill();
    ctx.restore();

    if (!ready) {
      ready = true;
      stage.classList.add('is-ready');
      canvas.style.opacity = '1';
      if (fallback) fallback.hidden = true;
      if (button) button.hidden = false;
    }
  }

  function resize() {
    const box = stage.getBoundingClientRect();
    width = box.width; height = box.height;
    if (!width || !height) return;
    compact = width < 500;
    const dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function tick(now) {
    frame = 0;
    if (!playing || !inView || document.hidden) { previous = 0; return; }
    const delta = previous ? now - previous : FRAME_INTERVAL;
    if (delta + 0.5 >= FRAME_INTERVAL) {
      elapsed += Math.min(delta, 80) / 1000;
      previous = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function stop() { if (frame) cancelAnimationFrame(frame); frame = 0; previous = 0; }
  function start() { if (!frame && playing && inView && !document.hidden) { previous = 0; frame = requestAnimationFrame(tick); } }

  button?.addEventListener('click', () => {
    playing = !playing; controls();
    if (playing) start(); else stop();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  preference.addEventListener('change', () => {
    if (preference.matches) { playing = false; stop(); controls(); draw(); }
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (inView) start(); else stop();
  }, { threshold: 0 }).observe(stage);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize, { passive: true });
  resize(); controls(); start();
})();
