(() => {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.06 });
    document.querySelectorAll('.reveal').forEach(el => { el.classList.add('observe'); observer.observe(el); });
    // Any motion preference change must leave the document readable.
    reduceMotion.addEventListener('change', () => document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')));
  }
  const canvas = document.getElementById('flow-canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  const stage = canvas.parentElement;
  const slider = document.getElementById('flow-progress');
  const output = document.getElementById('flow-value');
  const button = document.getElementById('motion-toggle');
  const symbol = button.querySelector('.motion-symbol');
  const label = button.querySelector('.motion-label');
  let seed = 29117;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(random(), .0001))) * Math.cos(2 * Math.PI * random());
  const points = Array.from({ length: 1800 }, (_, i) => {
    const angle = (i % 6) / 6 * Math.PI * 2;
    const a = random() * Math.PI * 2;
    const radial = .10 + random() * .24;
    return { sx: normal() * .48, sy: normal() * .48, sz: normal() * .34,
      tx: Math.cos(angle) * .72 + Math.cos(a) * radial,
      ty: Math.sin(angle) * .72 + Math.sin(a) * radial,
      tz: Math.sin(a * 2 + angle) * .15 + normal() * .055,
      r: .65 + random() * .9, phase: random() * Math.PI * 2, tone: i % 6 === 0 ? 1 : 0 };
  });
  let width = 0, height = 0, progress = .66, phase = Math.acos(1 - 2 * progress);
  let playing = !reduceMotion.matches, inView = true, frame = 0, last = 0, lastUI = 0;
  let pointerX = 0, pointerY = 0, rotation = .05;
  function resize() {
    const box = stage.getBoundingClientRect(); width = box.width; height = box.height;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0); draw();
  }
  function updateUI() {
    const value = Math.round(progress * 100);
    slider.value = String(value);
    slider.setAttribute('aria-valuetext', value + ' percent transformed');
    output.value = 't = ' + progress.toFixed(2);
    button.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
    symbol.textContent = playing ? 'Ⅱ' : '▷'; label.textContent = playing ? 'Pause' : 'Play';
  }
  function draw() {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    const scale = Math.min(width, height) * .39;
    const tilt = -.29 + pointerY * .08, spin = rotation + pointerX * .07;
    const ca = Math.cos(spin), sa = Math.sin(spin), cb = Math.cos(tilt), sb = Math.sin(tilt);
    const smooth = progress * progress * (3 - 2 * progress);
    const curve = Math.sin(progress * Math.PI) * .25;
    const projected = points.map(p => {
      const x = p.sx * (1 - smooth) + p.tx * smooth + Math.sin(p.phase + progress * 3) * curve;
      const y = p.sy * (1 - smooth) + p.ty * smooth + Math.cos(p.phase + progress * 3) * curve;
      const z = p.sz * (1 - smooth) + p.tz * smooth;
      const rx = x * ca - z * sa, rz = x * sa + z * ca;
      const ry = y * cb - rz * sb, depth = y * sb + rz * cb;
      const perspective = 2.8 / (2.8 - depth);
      return { x: width * .5 + rx * scale * perspective, y: height * .49 + ry * scale * perspective,
        r: p.r * perspective, z: depth, tone: p.tone };
    }).sort((a, b) => a.z - b.z);
    for (const p of projected) {
      const alpha = Math.max(.16, Math.min(.9, .57 + p.z * .29));
      context.fillStyle = p.tone ? `rgba(229,190,124,${alpha})` : `rgba(181,227,205,${alpha})`;
      context.beginPath(); context.arc(p.x, p.y, Math.max(.35, p.r), 0, Math.PI * 2); context.fill();
    }
  }
  function tick(time) {
    frame = 0;
    if (!playing || !inView || document.hidden) { last = 0; return; }
    const dt = last ? Math.min(time - last, 90) : 0;
    if (!last || dt > 30) {
      phase += dt * .00024; rotation += dt * .000014;
      progress = .08 + .87 * (.5 - .5 * Math.cos(phase));
      draw(); last = time;
      if (time - lastUI > 160) { updateUI(); lastUI = time; }
    }
    frame = requestAnimationFrame(tick);
  }
  function start() { if (!frame && playing && inView && !document.hidden) { last = 0; frame = requestAnimationFrame(tick); } }
  function pause() { playing = false; cancelAnimationFrame(frame); frame = 0; updateUI(); }
  button.addEventListener('click', () => { if (playing) pause(); else { playing = true; phase = Math.acos(1 - 2 * Math.max(0, Math.min(1, (progress - .08) / .87))); updateUI(); start(); } });
  slider.addEventListener('input', () => { const requested = Number(slider.value) / 100; pause(); progress = requested; updateUI(); draw(); });
  stage.addEventListener('pointermove', event => {
    if (reduceMotion.matches || !playing) return;
    const box = stage.getBoundingClientRect(); pointerX = (event.clientX - box.left) / box.width - .5; pointerY = (event.clientY - box.top) / box.height - .5;
  });
  stage.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else start(); });
  reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) pause(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { inView = entries[0].isIntersecting; if (inView) start(); else { cancelAnimationFrame(frame); frame = 0; } }, { threshold: 0 }).observe(stage);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  document.querySelector('.flow-controls').hidden = false;
  stage.classList.add('ready'); resize(); updateUI(); start();
})();
