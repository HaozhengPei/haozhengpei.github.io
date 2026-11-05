(() => {
  'use strict';
  const canvas = document.getElementById('hero-canvas');
  const stage = document.getElementById('hero-art');
  if (!canvas || !stage) return;
  let ctx;
  try { ctx = canvas.getContext('2d', { alpha: true }); } catch (_) { return; }
  if (!ctx) return;

  const fallback = document.getElementById('hero-fallback');
  const playButton = document.getElementById('motion-toggle');
  const playLabel = playButton?.querySelector('.motion-label');
  const playSymbol = playButton?.querySelector('.motion-symbol');
  const slider = document.getElementById('shape-progress');
  const output = document.getElementById('flow-value');
  const caption = document.getElementById('simulation-caption');
  const modeButtons = Array.from(document.querySelectorAll('[data-research-mode]'));
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const descriptions = {
    flow: 'Illustrative smooth transport from noise to a structured distribution.',
    diffusion: 'Illustrative stochastic denoising toward a structured distribution.',
    world: 'Illustrative world-model rollout: a moving object and a sequence of imagined future states.'
  };
  const captions = {
    flow: 'Noise → structure · conceptual illustration',
    diffusion: 'Progressive denoising · conceptual illustration',
    world: 'Current state → imagined futures · conceptual illustration'
  };
  const TAU = Math.PI * 2;
  const COUNT = 2304;
  const FPS_INTERVAL = 1000 / 60;
  const DURATION = 11;
  const HOLD = 1.4;
  const FADE = 0.6;
  const TOTAL = DURATION + HOLD + FADE * 2;
  const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
  const smooth = t => t * t * (3 - 2 * t);
  let seed = 19439;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(random(), 0.00001))) * Math.cos(TAU * random());
  const hash = n => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };

  // All positions are authored toy examples, not outputs from trained models.
  function manifold(u, v) {
    const angle = Math.PI * (0.15 + u * 2.65);
    const radius = 0.18 + u * 0.78;
    return [Math.cos(angle) * radius, (v - 0.5) * 0.92, Math.sin(angle) * radius];
  }
  const points = Array.from({ length: COUNT }, (_, i) => {
    const u = (i % 64 + random() * 0.7) / 64;
    const v = (Math.floor(i / 64) + random() * 0.7) / 36;
    return {
      origin: [clamp(gaussian() * 0.43, -1.2, 1.2), clamp(gaussian() * 0.43, -1.2, 1.2), clamp(gaussian() * 0.43, -1.2, 1.2)],
      target: manifold(u, v),
      u, v, id: i + 1,
      warm: u > 0.81 || i % 23 === 0,
      size: 0.55 + random() * 0.65,
      projected: { x: 0, y: 0, z: 0, scale: 1 }
    };
  });
  let activePoints = points;
  let particlesByDepth = points.slice();
  const terrain = Array.from({ length: 775 }, (_, i) => {
    const x = (i % 31) / 30 * 2.6 - 1.3;
    const z = Math.floor(i / 31) / 24 * 1.7 - 0.85;
    const y = -0.47 + 0.035 * Math.sin(x * 4 + z * 2) + 0.025 * Math.cos(z * 6);
    return [x, y, z];
  });
  let activeTerrain = terrain;
  let compact = null;
  let transition = null;
  let width = 0, height = 0;
  let progress = slider ? clamp(Number(slider.value) / 100) : 0.6;
  let cycle = progress * DURATION;
  let elapsed = 0, opacity = 1;
  let mode = 'flow';
  let playing = !preference.matches;
  let inView = true, frame = 0, previous = 0, lastControlUpdate = 0, ready = false;
  let pointerX = 0, pointerY = 0, cameraX = 0, cameraY = 0;
  let yaw = -0.48, pitch = 0.25;

  function project(position) {
    const [x, y, z] = position;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const rx = x * cy + z * sy;
    const rz = -x * sy + z * cy;
    const ry = y * cp - rz * sp;
    const depth = y * sp + rz * cp;
    const perspective = 3.8 / (3.8 - depth);
    const scaleX = width * (mode === 'world' ? 0.32 : 0.44) * perspective;
    const scaleY = height * 0.43 * perspective;
    const angle = mode === 'world' ? 0 : -0.23;
    const px = rx * scaleX, py = -ry * scaleY;
    return { x: width * 0.5 + px * Math.cos(angle) - py * Math.sin(angle), y: height * 0.5 + px * Math.sin(angle) + py * Math.cos(angle), z: depth, scale: perspective };
  }

  function flowPosition(point, t) {
    if (t <= 0) return point.origin;
    if (t >= 1) return point.target;
    const bow = Math.sin(Math.PI * t) * 0.14;
    return [
      point.origin[0] * (1 - t) + point.target[0] * t + bow * Math.sin(point.u * TAU),
      point.origin[1] * (1 - t) + point.target[1] * t + bow * Math.cos(point.u * TAU) * 0.45,
      point.origin[2] * (1 - t) + point.target[2] * t + bow * Math.sin(point.v * TAU)
    ];
  }

  function diffusionPosition(point, t) {
    if (t <= 0) return point.origin;
    if (t >= 1) return point.target;
    const alpha = Math.pow(t, 1.55);
    const signal = Math.sqrt(alpha), noise = Math.sqrt(1 - alpha);
    const step = t * 34, lower = Math.floor(step), blend = smooth(step - lower);
    const jitter = Math.sin(Math.PI * t) * 0.18;
    return point.target.map((coordinate, axis) => {
      const key = point.id * 1.317 + axis * 147.31;
      const a = hash(key + lower * 8.173), b = hash(key + (lower + 1) * 8.173);
      return signal * coordinate + noise * point.origin[axis] + jitter * (a + (b - a) * blend);
    });
  }

  function stroke(pointsToDraw, color, lineWidth = 1, dash = []) {
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.setLineDash(dash);
    ctx.beginPath();
    pointsToDraw.forEach((point, i) => { if (i) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y); });
    ctx.stroke(); ctx.setLineDash([]);
  }

  function dot(point, radius, color, glow = false) {
    if (glow) {
      ctx.fillStyle = color.replace(/,([\d.]+)\)$/, (_, a) => ',' + Number(a) * 0.08 + ')');
      ctx.beginPath(); ctx.arc(point.x, point.y, radius * 4.2, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TAU); ctx.fill();
  }

  function drawManifoldGuide() {
    const alpha = (0.025 + Math.pow(progress, 3) * 0.12) * opacity;
    for (let row = 0; row < 9; row += 1) {
      const path = Array.from({ length: 65 }, (_, i) => project(manifold(i / 64, row / 8)));
      stroke(path, `rgba(154,191,211,${alpha})`, 0.6);
    }
  }

  function drawTrajectories() {
    if (progress > 0.995) return;
    for (let i = 4; i < COUNT; i += 137) {
      const point = points[i];
      const from = Math.max(0, progress - 0.18), to = Math.min(1, progress + 0.11);
      const trace = Array.from({ length: 11 }, (_, j) => project(flowPosition(point, from + (to - from) * j / 10)));
      const alpha = (point.warm ? 0.43 : 0.20) * opacity;
      stroke(trace, point.warm ? `rgba(231,178,114,${alpha})` : `rgba(169,211,235,${alpha})`, 0.85);
      const end = trace[10], before = trace[9];
      const angle = Math.atan2(end.y - before.y, end.x - before.x);
      const length = 3.2;
      stroke([
        { x: end.x - Math.cos(angle - 0.6) * length, y: end.y - Math.sin(angle - 0.6) * length }, end,
        { x: end.x - Math.cos(angle + 0.6) * length, y: end.y - Math.sin(angle + 0.6) * length }
      ], `rgba(220,225,214,${alpha})`, 0.8);
    }
  }

  function drawGeneration() {
    drawManifoldGuide();
    if (mode === 'flow') drawTrajectories();
    const positionAt = mode === 'diffusion' ? diffusionPosition : flowPosition;
    for (const point of activePoints) point.projected = project(positionAt(point, progress));
    particlesByDepth.sort((a, b) => a.projected.z - b.projected.z);
    for (const point of particlesByDepth) {
      const p = point.projected;
      const alpha = clamp(0.50 + p.z * 0.35, 0.15, 0.95) * opacity;
      const radius = Math.max(0.4, point.size * p.scale);
      const color = point.warm ? `rgba(234,181,119,${alpha})` : `rgba(174,214,237,${alpha})`;
      dot(p, radius, color, point.id % 37 === 0 && p.z > -0.1);
      if (mode === 'diffusion' && point.id % 67 === 0 && progress < 0.97) {
        const old = project(diffusionPosition(point, Math.max(0, progress - 0.035)));
        stroke([old, p], `rgba(189,211,224,${alpha * 0.24})`, 0.7);
      }
    }
  }

  function worldPosition(t) {
    return [-1.10 + 2.20 * t, -0.17 + Math.sin(Math.PI * t) * 0.08, Math.sin(t * TAU - 0.6) * 0.38];
  }

  function drawState(t, alpha, current) {
    const center = worldPosition(t);
    const rings = current ? 7 : 3;
    const samples = current ? 22 : 18;
    for (let ring = 0; ring < rings; ring += 1) {
      const latitude = (ring / Math.max(1, rings - 1) - 0.5) * Math.PI * 0.8;
      const path = [];
      for (let k = 0; k <= samples; k += 1) {
        const angle = k / samples * TAU;
        const p = project([
          center[0] + Math.cos(angle) * Math.cos(latitude) * 0.105,
          center[1] + Math.sin(latitude) * 0.09,
          center[2] + Math.sin(angle) * Math.cos(latitude) * 0.105
        ]);
        path.push(p);
        if (current && k < samples) dot(p, 0.9 * p.scale, `rgba(244,202,143,${alpha})`, k % 7 === 0);
      }
      stroke(path, current ? `rgba(244,202,143,${alpha * 0.55})` : `rgba(155,198,220,${alpha})`, current ? 0.9 : 0.65);
    }
    const ground = project([center[0], -0.43, center[2]]), top = project(center);
    stroke([ground, top], `rgba(182,199,205,${alpha * 0.3})`, 0.7, [2, 4]);
    if (current) dot(top, 2.1, `rgba(255,232,193,${alpha})`, true);
  }

  function drawWorld() {
    const ground = activeTerrain.map(project).sort((a, b) => a.z - b.z);
    for (const p of ground) dot(p, Math.max(0.4, 0.65 * p.scale), `rgba(119,170,195,${clamp(0.19 + p.z * 0.07, 0.08, 0.3) * opacity})`);
    for (let row = 0; row < 5; row += 1) {
      const z = row / 4 * 1.7 - 0.85;
      stroke(Array.from({ length: 31 }, (_, i) => project([i / 30 * 2.6 - 1.3, -0.47, z])), `rgba(106,150,176,${0.08 * opacity})`, 0.7);
    }
    const past = Array.from({ length: 50 }, (_, i) => project(worldPosition(progress * i / 49)));
    const future = Array.from({ length: 50 }, (_, i) => project(worldPosition(progress + (1 - progress) * i / 49)));
    stroke(past, `rgba(133,187,215,${0.25 * opacity})`, 0.9);
    stroke(future, `rgba(231,181,121,${0.60 * opacity})`, 1.2, [4, 5]);
    // Ghost states are a hand-authored example rollout, not predictions from a model.
    for (let k = 4; k >= 1; k -= 1) {
      const next = progress + k * 0.14;
      if (next <= 1) drawState(next, (0.38 - k * 0.055) * opacity, false);
    }
    drawState(progress, 0.95 * opacity, true);
    const start = project(worldPosition(0)), end = project(worldPosition(1));
    dot(start, 2, `rgba(142,187,209,${0.4 * opacity})`);
    dot(end, 2, `rgba(232,187,128,${0.5 * opacity})`);
  }

  function syncControls() {
    playButton?.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
    playButton?.removeAttribute('aria-pressed');
    if (playLabel) playLabel.textContent = playing ? 'Pause' : 'Play';
    if (playSymbol) playSymbol.textContent = playing ? 'Ⅱ' : '▷';
    if (slider) {
      slider.value = String(Math.round(progress * 100));
      slider.setAttribute('aria-valuetext', Math.round(progress * 100) + (mode === 'world' ? ' percent through the rollout' : ' percent transformed'));
    }
    if (output) { output.textContent = 't = ' + progress.toFixed(2); output.setAttribute('aria-live', 'off'); }
  }

  function updateModeText() {
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.researchMode === mode)));
    if (caption) caption.textContent = captions[mode];
    canvas.setAttribute('aria-label', descriptions[mode]);
  }

  function draw() {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const blend = transition ? smooth(clamp(transition.age / 0.26)) : 1;
    if (transition) {
      ctx.save(); ctx.globalAlpha = 1 - blend;
      ctx.drawImage(transition.image, 0, 0, width, height); ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = blend;
    const halo = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.min(width, height) * 0.48);
    halo.addColorStop(0, 'rgba(72,120,158,0.10)'); halo.addColorStop(1, 'rgba(9,12,18,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
    yaw = (mode === 'world' ? -0.30 : -0.48) + Math.sin(elapsed * 0.12) * 0.09 + cameraX * 0.18;
    pitch = (mode === 'world' ? 0.50 : 0.70) + cameraY * 0.12;
    if (mode === 'world') drawWorld(); else drawGeneration();
    ctx.restore();
    if (!ready) {
      ready = true; stage.classList.add('is-ready'); canvas.style.opacity = '1';
      if (fallback) fallback.hidden = true;
      document.querySelectorAll('.art-controls, .research-modes').forEach(element => { element.hidden = false; });
    }
  }

  function resize() {
    const box = stage.getBoundingClientRect(); width = box.width; height = box.height;
    if (!width || !height) return;
    const narrow = width < 500;
    if (narrow !== compact) {
      compact = narrow;
      activePoints = compact ? points.filter((_, i) => i % 2 === 0) : points;
      particlesByDepth = activePoints.slice();
      activeTerrain = compact ? terrain.filter((_, i) => i % 2 === 0) : terrain;
    }
    transition = null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }

  function advance(dt) {
    cycle = (cycle + dt) % TOTAL;
    if (cycle <= DURATION) { progress = cycle / DURATION; opacity = 1; }
    else if (cycle <= DURATION + HOLD) { progress = 1; opacity = 1; }
    else if (cycle <= DURATION + HOLD + FADE) { progress = 1; opacity = 1 - smooth((cycle - DURATION - HOLD) / FADE); }
    else { progress = 0; opacity = smooth((cycle - DURATION - HOLD - FADE) / FADE); }
  }

  function tick(now) {
    frame = 0;
    if ((!playing && !transition) || !inView || document.hidden) { previous = 0; return; }
    const delta = previous ? now - previous : FPS_INTERVAL;
    if (delta + 0.5 >= FPS_INTERVAL) {
      const dt = Math.min(delta, 80) / 1000;
      previous = now;
      if (playing) {
        elapsed += dt; advance(dt);
        cameraX += (pointerX - cameraX) * 0.08; cameraY += (pointerY - cameraY) * 0.08;
      }
      if (transition) { transition.age += dt; if (transition.age >= 0.26) transition = null; }
      draw();
      if (now - lastControlUpdate > 130) { syncControls(); lastControlUpdate = now; }
    }
    if (playing || transition) frame = requestAnimationFrame(tick);
  }
  function stopFrames() { if (frame) cancelAnimationFrame(frame); frame = 0; previous = 0; }
  function start() { if (!frame && (playing || transition) && inView && !document.hidden) { previous = 0; frame = requestAnimationFrame(tick); } }
  function pause() { playing = false; transition = null; opacity = 1; stopFrames(); syncControls(); }

  playButton?.addEventListener('click', () => {
    if (playing) { pause(); draw(); } else { playing = true; syncControls(); start(); }
  });
  slider?.addEventListener('input', () => {
    const requested = clamp(Number(slider.value) / 100);
    pause(); progress = requested; cycle = progress * DURATION; opacity = 1;
    syncControls(); draw();
  });
  modeButtons.forEach(button => button.addEventListener('click', () => {
    const requested = button.dataset.researchMode;
    if (!Object.hasOwn(descriptions, requested)) return;
    if (requested === mode) return;
    let snapshot = null;
    if (!preference.matches && ready) {
      try {
        const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
        const copyContext = copy.getContext('2d');
        if (copyContext) { copyContext.drawImage(canvas, 0, 0); snapshot = copy; }
      } catch (_) { /* An immediate switch remains usable if a snapshot fails. */ }
    }
    transition = snapshot ? { image: snapshot, age: 0 } : null;
    mode = requested; cycle = progress * DURATION; opacity = 1;
    updateModeText(); syncControls(); draw(); start();
    // The brief UI crossfade does not resume a paused simulation.
  }));
  stage.addEventListener('pointermove', event => {
    if (!playing || preference.matches || event.pointerType === 'touch') return;
    const box = stage.getBoundingClientRect(); pointerX = (event.clientX - box.left) / box.width - 0.5; pointerY = (event.clientY - box.top) / box.height - 0.5;
  });
  stage.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopFrames(); else start(); });
  preference.addEventListener('change', () => { if (preference.matches) { pause(); cameraX = 0; cameraY = 0; pointerX = 0; pointerY = 0; draw(); } });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { inView = entries[0].isIntersecting; if (inView) start(); else stopFrames(); }, { threshold: 0 }).observe(stage);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize, { passive: true });
  updateModeText(); resize(); syncControls(); start();
})();
