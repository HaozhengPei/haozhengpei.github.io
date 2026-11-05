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

  let rows = 92, strands = 48, scale = 1;
  let grid = [], order = [];
  const TAU = Math.PI * 2;

  function surface(u, v, time, point = {}) {
    const phase = time * 0.15;
    const angleAlong = u * TAU;
    const r = (2 + Math.cos(3 * angleAlong)) / 3;
    const dr = -Math.sin(3 * angleAlong);
    let tx = dr * Math.cos(2 * angleAlong) - 2 * r * Math.sin(2 * angleAlong);
    let ty = dr * Math.sin(2 * angleAlong) + 2 * r * Math.cos(2 * angleAlong);
    let tz = Math.cos(3 * angleAlong);
    const tangentLength = Math.hypot(tx, ty, tz);
    tx /= tangentLength; ty /= tangentLength; tz /= tangentLength;
    const normalLength = Math.hypot(tx, ty);
    const nx = -ty / normalLength, ny = tx / normalLength;
    const bx = -tz * ny, by = tz * nx, bz = tx * ny - ty * nx;
    const twist = angleAlong * 1.5 + Math.sin(phase * 0.6) * 0.14;
    const breadth = 0.20 + Math.cos(3 * angleAlong + phase * 0.35) * 0.018;
    const across = v * breadth;
    const cosTwist = Math.cos(twist), sinTwist = Math.sin(twist);
    const breath = 1 + Math.sin(phase * 0.55) * 0.028;
    let x = r * Math.cos(2 * angleAlong) * breath + across * (nx * cosTwist + bx * sinTwist);
    let y = r * Math.sin(2 * angleAlong) * breath + across * (ny * cosTwist + by * sinTwist);
    let z = Math.sin(3 * angleAlong) / 3 + across * bz * sinTwist;
    z += Math.sin(4 * angleAlong - phase) * (1 - v * v) * 0.018;
    const yaw = -0.36 + Math.sin(phase * 0.6) * 0.13;
    const turnedX = x * Math.cos(yaw) + z * Math.sin(yaw);
    z = -x * Math.sin(yaw) + z * Math.cos(yaw); x = turnedX;
    const pitchedY = y * 0.978 - z * 0.208;
    z = y * 0.208 + z * 0.978; y = pitchedY;
    const angle = -0.23;
    const screenX = x * Math.cos(angle) - y * Math.sin(angle);
    const screenY = x * Math.sin(angle) + y * Math.cos(angle);
    const perspective = 4.8 / (4.8 - z);
    point.x = width * 0.51 + screenX * scale * perspective;
    point.y = height * 0.50 + screenY * scale * perspective;
    point.z = z; point.perspective = perspective;
    return point;
  }

  function path(points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  }

  function draw() {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i <= rows; i += 1) {
      for (let j = 0; j <= strands; j += 1) surface(i / rows, j * 2 / strands - 1, elapsed, grid[i][j]);
    }
    for (const strip of order) strip.z = (grid[strip.i][strands / 2].z + grid[strip.i + 1][strands / 2].z) / 2;
    order.sort((a, b) => a.z - b.z);
    ctx.save();
    ctx.lineCap = 'round';

    // The softly lit silhouette sits behind the folded, depth-sorted fabric.
    ctx.filter = `blur(${compact ? 10 : 18}px)`;
    ctx.strokeStyle = 'rgba(105,156,196,0.12)';
    ctx.lineWidth = compact ? 15 : 26;
    path(grid.map(line => line[Math.floor(strands * 0.68)])); ctx.stroke();
    ctx.filter = 'none';

    for (const strip of order) {
      const i = strip.i, a = grid[i], b = grid[i + 1];
      const front = Math.max(0, Math.min(1, (strip.z + 1.0) / 2));
      const fade = 0.92;
      // A dark translucent body lets nearer folds obscure the distant threads.
      path([a[0], a[strands], b[strands], b[0]]); ctx.closePath();
      ctx.fillStyle = `rgba(13,23,35,${0.67 * fade})`; ctx.fill();
      const tint = ctx.createLinearGradient(a[0].x, a[0].y, a[strands].x, a[strands].y);
      tint.addColorStop(0, 'rgba(108,155,191,0)');
      tint.addColorStop(0.28, `rgba(111,151,188,${0.06 * fade})`);
      tint.addColorStop(0.55, `rgba(174,185,208,${(0.07 + front * 0.11) * fade})`);
      tint.addColorStop(0.78, `rgba(92,132,168,${0.06 * fade})`);
      tint.addColorStop(1, 'rgba(88,128,167,0)');
      ctx.fillStyle = tint; ctx.fill();

      for (let group = 0; group < 4; group += 1) {
        ctx.beginPath();
        for (let j = group; j <= strands; j += 4) {
          ctx.moveTo(a[j].x, a[j].y); ctx.lineTo(b[j].x, b[j].y);
        }
        const alpha = (0.16 + front * 0.38 + group * 0.035) * fade;
        ctx.strokeStyle = group === 2 ? `rgba(199,211,226,${alpha})` : `rgba(125,172,209,${alpha})`;
        ctx.lineWidth = compact ? 0.40 : 0.48; ctx.stroke();
      }
      // A narrow warm seam, embedded in the fabric rather than an orbit or trace.
      const seam = Math.round(strands * 0.77);
      ctx.beginPath();ctx.moveTo(a[seam].x,a[seam].y);ctx.lineTo(b[seam].x,b[seam].y);
      ctx.strokeStyle = `rgba(218,180,138,${(0.23 + front * 0.45) * fade})`;
      ctx.lineWidth = compact ? 0.65 : 0.8;ctx.stroke();

      const grains = compact ? 3 : 7;
      for (let g = 0; g < grains; g += 1) {
        const seed = Math.sin(i * 127.1 + g * 311.7) * 43758.5453;
        const v = (seed - Math.floor(seed)) * 2 - 1;
        const p = surface((i + (g + 0.5) / grains) / rows, v, elapsed);
        const loosen = Math.pow(Math.abs(v), 9) * (0.5 + 0.5 * Math.sin(elapsed * 0.24 + i * 0.37));
        p.x += Math.sin(i * 2.1 + elapsed * 0.20) * loosen * scale * 0.032;
        p.y += Math.cos(i * 1.7 - elapsed * 0.17) * loosen * scale * 0.025;
        const size = (compact ? 0.55 : 0.68) * p.perspective;
        ctx.fillStyle = `rgba(204,224,239,${(0.27 + front * 0.53) * fade})`;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      }
    }
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
    rows = compact ? 64 : 92; strands = compact ? 28 : 48;
    scale = Math.min(width * 0.225, height * 0.34);
    grid = Array.from({ length: rows + 1 }, () => Array.from({ length: strands + 1 }, () => ({})));
    order = Array.from({ length: rows }, (_, i) => ({ i, z: 0 }));
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
