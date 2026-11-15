// เอฟเฟกต์กระดาษสี/พลุ ด้วย canvas (ไม่ใช้ไลบรารี)
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cv = null, cx = null, P = [], raf = 0, last = 0, active = 0, ivs = [], tos = [];
  const GOLD = ['#ffd700', '#ffec8b', '#ffffff', '#ffb300'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function palette() {
    const s = getComputedStyle(document.documentElement);
    return ['--a0', '--a1', '--a2', '--a3', '--accent'].map(k => s.getPropertyValue(k).trim()).filter(Boolean).concat(GOLD);
  }
  function resize() { if (cv) { cv.width = innerWidth; cv.height = innerHeight; } }
  function start() {
    if (!cv) {
      cv = document.createElement('canvas');
      cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:60';
      document.body.appendChild(cv); cx = cv.getContext('2d'); resize(); addEventListener('resize', resize);
    }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  function loop(now) {
    const dt = Math.min(2, (now - last) / 16.67); last = now;
    cx.clearRect(0, 0, cv.width, cv.height);
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i], d = Math.pow(p.drag, dt);
      p.vx *= d; p.vy = p.vy * d + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
      if (p.life <= 0 || p.y > cv.height + 40) { P.splice(i, 1); continue; }
      cx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5)); cx.fillStyle = p.col;
      if (p.t === 'c') {
        p.rot += p.vr * dt; p.wob += 0.15 * dt;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot);
        cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.wob))); cx.restore();
      } else { cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill(); }
    }
    cx.globalAlpha = 1;
    if (P.length || active > 0) raf = requestAnimationFrame(loop);
    else { raf = 0; cx.clearRect(0, 0, cv.width, cv.height); }
  }
  function confetti(x, y, n, o) {
    if (reduced) return; o = o || {}; start();
    const pal = o.pal || palette(), ang = o.angle == null ? -90 : o.angle, spr = o.spread == null ? 60 : o.spread;
    for (let i = 0; i < n && P.length < 800; i++) {
      const a = (ang + rnd(-0.5, 0.5) * spr) * Math.PI / 180, s = rnd(6, o.power || 16);
      P.push({ t: 'c', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.32, drag: 0.985, w: rnd(6, 12), h: rnd(8, 16), rot: rnd(0, 6.28), vr: rnd(-0.3, 0.3), wob: rnd(0, 6.28), col: pal[(Math.random() * pal.length) | 0], life: 1, decay: rnd(0.004, 0.009) });
    }
  }
  function cannons(n) {
    const W = innerWidth, H = innerHeight, pal = palette();
    confetti(0, H, n, { angle: -60, spread: 40, power: 24, pal });
    confetti(W, H, n, { angle: -120, spread: 40, power: 24, pal });
  }
  function rain(ms) {
    if (reduced) return; start(); active++;
    const end = performance.now() + ms, pal = palette();
    const iv = setInterval(() => {
      if (performance.now() > end) { clearInterval(iv); active--; return; }
      for (let i = 0; i < 4; i++) confetti(rnd(0, innerWidth), -10, 1, { angle: 90, spread: 40, power: 6, pal });
    }, 90);
    ivs.push(iv);
  }
  function firework(x, y) {
    if (reduced) return; start();
    const pal = palette(), col = pal[(Math.random() * pal.length) | 0];
    for (let i = 0; i < 70 && P.length < 900; i++) {
      const a = rnd(0, 6.283), s = rnd(1.5, 9) * (Math.random() < 0.3 ? 0.5 : 1);
      P.push({ t: 's', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.06, drag: 0.972, r: rnd(1.5, 3.2), col: Math.random() < 0.2 ? '#fff' : col, life: 1, decay: rnd(0.008, 0.016) });
    }
  }
  function fireworks(ms, onBurst) {
    if (reduced) return; start(); active++;
    const end = performance.now() + ms;
    const tick = () => {
      if (performance.now() > end) { active--; return; }
      firework(rnd(0.15, 0.85) * innerWidth, rnd(0.12, 0.5) * innerHeight);
      if (onBurst) onBurst();
      tos.push(setTimeout(tick, rnd(350, 700)));
    };
    tick();
  }
  function stop() {
    ivs.forEach(clearInterval); tos.forEach(clearTimeout); ivs = []; tos = []; active = 0; P = [];
    if (cx) cx.clearRect(0, 0, cv.width, cv.height);
  }
  window.FX = { confetti, cannons, rain, firework, fireworks, stop, reduced };
})();
