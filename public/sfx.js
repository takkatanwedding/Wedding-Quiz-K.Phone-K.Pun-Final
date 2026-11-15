// เสียงประกอบทั้งหมดสร้างสดด้วย Web Audio (ไม่ใช้ไฟล์เสียง)
(function () {
  let ctx = null, master = null, muted = localStorage.getItem('qp_mute') === '1';
  let cur = null, step = 0, nextT = 0, btn = null;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC(); master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  const ready = () => ctx && ctx.state === 'running' && !muted;

  function tone(m, t, d, type, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.value = hz(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v || 0.1, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
  }
  function slide(f1, f2, t, d, type, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sawtooth';
    o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.1, t + d * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
  }
  function kick(t, v) { slide(150, 42, t, 0.14, 'sine', v || 0.5); }
  function hat(t) {
    const n = Math.floor(ctx.sampleRate * 0.03), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; f.type = 'highpass'; f.frequency.value = 7000; g.gain.value = 0.05;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }

  function noiseTo(dest, t, d, v, hp) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * d)), b = ctx.createBuffer(1, n, ctx.sampleRate), data = b.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; f.type = 'highpass'; f.frequency.value = hp || 1000; g.gain.value = v || 0.05;
    s.connect(f); f.connect(g); g.connect(dest); s.start(t);
  }
  function kickTo(dest, t, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(v || 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.22);
  }
  let stopDrumFn = null;

  // ---------- ธีมเพลงประกอบ (สร้างสดด้วยโค้ด) ----------
  const on = (notes, every) => notes.flatMap(n => [n].concat(Array(every - 1).fill(0)));
  const offb = notes => notes.flatMap(n => [0, n, 0, n, 0, n, 0, n]);
  const eighths = notes => notes.flatMap(n => Array(8).fill(n));
  const THEMES = {
    arcade: {
      name: 'เกมอาเขต 8-bit (สนุก ตื่นเต้น)',
      lobby: { bpm: 112, len: 32, kick: [0, 4], hat: 'odd',
        lead: [72,0,76,0,79,0,76,0, 74,0,77,0,81,0,77,0, 72,0,76,79,84,0,79,76, 74,0,77,0,79,0,0,0],
        bass: on([48,48,53,53,55,55,48,43], 4) },
      question: { bpm: 150, len: 16, kick: [0, 4], hat: 'odd',
        lead: [69,72,76,72, 69,72,77,72, 67,71,74,71, 67,71,76,71], bass: on([45,45,43,43], 4) },
      board: { bpm: 100, len: 16,
        lead: [72,0,76,0,79,0,76,0, 74,0,77,0,76,0,72,0], bass: on([48,53,55,48], 4) },
    },
    romantic: {
      name: 'โรแมนติก งานแต่ง (นุ่ม หวาน)',
      lobby: { bpm: 76, len: 32, lw: 'sine', lv: 0.09, ld: 3, cv: 0.05, cd: 7.5, bw: 'sine', bv: 0.13, bd: 7,
        chords: [[48,52,55],[45,48,52],[41,45,48],[43,47,50]], bass: on([36,33,29,31], 8),
        lead: [79,0,0,0,76,0,72,0, 76,0,0,0,72,0,69,0, 72,0,0,0,69,0,72,0, 74,0,0,0,71,0,67,0] },
      question: { bpm: 92, len: 32, lw: 'triangle', lv: 0.07, ld: 1.6, cv: 0.04, cd: 7.5, bw: 'sine', bv: 0.12, bd: 7,
        chords: [[48,52,55],[45,48,52],[41,45,48],[43,47,50]], bass: on([36,33,29,31], 8),
        lead: [72,76,79,76,72,76,79,76, 69,72,76,72,69,72,76,72, 65,69,72,69,65,69,72,69, 67,71,74,71,67,71,74,71] },
      board: { bpm: 68, len: 32, lw: 'sine', lv: 0.08, ld: 3, cv: 0.045, cd: 7.5, bw: 'sine', bv: 0.1, bd: 7,
        chords: [[48,52,55],[45,48,52],[41,45,48],[43,47,50]], bass: on([36,33,29,31], 8),
        lead: [84,0,0,0,0,0,79,0, 81,0,0,0,0,0,76,0, 77,0,0,0,0,0,74,0, 79,0,0,0,0,0,83,0] },
    },
    party: {
      name: 'ปาร์ตี้ แดนซ์ (จังหวะมันส์)',
      lobby: { bpm: 124, len: 32, kick: [0, 2, 4, 6], hat: 'odd', lv: 0.045, bw: 'sawtooth', bv: 0.09, bd: 1.4,
        lead: [69,0,72,0,76,0,72,69, 67,0,69,0,72,0,69,67, 64,0,67,0,69,0,72,76, 74,0,72,0,69,0,67,0],
        bass: offb([45,45,41,43]) },
      question: { bpm: 132, len: 16, kick: [0, 2, 4, 6], hat: 'odd', lv: 0.045, bw: 'sawtooth', bv: 0.09, bd: 1.4,
        lead: [76,0,76,72,0,76,0,79, 77,0,77,74,0,77,0,81], bass: offb([45,43]) },
      board: { bpm: 112, len: 16, kick: [0, 4], hat: 'odd', lv: 0.045,
        lead: [72,0,76,0,79,0,84,0, 79,0,76,0,74,0,72,0], bass: on([48,55], 8) },
    },
    lofi: {
      name: 'ชิล ๆ โลไฟ (สบาย ๆ)',
      lobby: { bpm: 78, len: 32, swing: 0.3, kick: [0, 5], kv: 0.3, snare: [4], sv: 0.04, hat: 'odd', lw: 'sine', lv: 0.07, ld: 2.2,
        cv: 0.04, cd: 6, bd: 6, bv: 0.11, bw: 'sine',
        chords: [[50,53,57,60],[55,59,62,65],[52,55,59,62],[57,60,64,67]], bass: on([38,43,40,45], 8),
        lead: [0,0,0,0,69,0,0,65, 0,0,0,0,67,0,0,0, 0,0,0,0,64,0,0,67, 0,0,0,0,69,0,65,0] },
      question: { bpm: 88, len: 32, swing: 0.3, kick: [0, 5], kv: 0.3, snare: [4], sv: 0.04, hat: 'odd', lw: 'sine', lv: 0.07, ld: 1.8,
        cv: 0.04, cd: 6, bd: 6, bv: 0.11, bw: 'sine',
        chords: [[50,53,57,60],[55,59,62,65],[52,55,59,62],[57,60,64,67]], bass: on([38,43,40,45], 8),
        lead: [69,0,72,0,76,0,72,0, 67,0,71,0,74,0,71,0, 64,0,67,0,71,0,67,0, 69,0,72,0,76,0,81,0] },
      board: { bpm: 70, len: 32, swing: 0.3, kick: [0], kv: 0.25, hat: 'odd', lw: 'sine', lv: 0.06, ld: 3,
        cv: 0.04, cd: 6, bd: 6, bv: 0.1, bw: 'sine',
        chords: [[50,53,57,60],[55,59,62,65],[52,55,59,62],[57,60,64,67]], bass: on([38,43,40,45], 8),
        lead: [0,0,0,0,0,0,76,0, 0,0,0,0,0,0,74,0, 0,0,0,0,0,0,71,0, 0,0,0,0,0,0,69,0] },
    },
    suspense: {
      name: 'เกมโชว์ลุ้นระทึก (ตื่นเต้น)',
      lobby: { bpm: 132, len: 32, kick: [0, 4], snare: [2, 6], hat: 'odd', lv: 0.04, bw: 'sawtooth', bv: 0.07, bd: 0.9,
        lead: [76,0,79,0,83,0,79,0, 76,0,79,0,86,0,83,0, 74,0,78,0,81,0,78,0, 76,0,79,83,88,0,83,0],
        bass: eighths([40,40,43,38]) },
      question: { bpm: 160, len: 16, kick: [0, 2, 4, 6], snare: [2, 6], hat: 'all', lv: 0.04, bw: 'sawtooth', bv: 0.07, bd: 0.9,
        lead: [64,67,71,67,64,67,72,67, 63,66,71,66,63,66,70,66], bass: eighths([40, 39]) },
      board: { bpm: 120, len: 16, kick: [0, 4], lv: 0.04,
        lead: [76,0,0,79,0,0,83,0, 81,0,0,78,0,0,74,0], bass: on([40, 45], 8) },
    },
  };
  let chosen = localStorage.getItem('qp_music') || 'arcade';
  if (chosen !== 'off' && !THEMES[chosen]) chosen = 'arcade';
  let active = chosen, pvCur, pvTimer = null;

  function play(tr, s, t, dur) {
    const i = s % tr.len, b = i % 8;
    if (tr.swing && i % 2 === 1) t += dur * tr.swing;
    const m = tr.lead[i];
    if (m) tone(m, t, dur * (tr.ld || 1.7), tr.lw || 'square', tr.lv || 0.04);
    const bn = tr.bass && tr.bass[i];
    if (bn) tone(bn, t, dur * (tr.bd || 3.6), tr.bw || 'triangle', tr.bv || 0.13);
    if (tr.chords) {
      const every = tr.chordEvery || 8;
      if (i % every === 0) tr.chords[Math.floor(i / every) % tr.chords.length].forEach(n => tone(n, t, dur * (tr.cd || 7), 'triangle', tr.cv || 0.04));
    }
    if (tr.kick && tr.kick.indexOf(b) >= 0) kick(t, tr.kv);
    if (tr.snare && tr.snare.indexOf(b) >= 0) noiseTo(master, t, 0.12, tr.sv || 0.05, 1800);
    if (tr.hat && (tr.hat === 'all' || i % 2 === 1)) hat(t);
  }
  setInterval(() => {
    if (!ready() || !cur) return;
    const set = THEMES[active], tr = set && set[cur];
    if (!tr) return;
    const dur = 60 / tr.bpm / 2;
    if (nextT < ctx.currentTime - 0.3) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.2) { play(tr, step, nextT, dur); nextT += dur; step++; }
  }, 40);

  const now = () => ctx.currentTime + 0.01;
  const FX = {
    click() { tone(84, now(), 0.06, 'square', 0.08); },
    join() { const t = now(); tone(76, t, 0.09, 'triangle', 0.16); tone(83, t + 0.08, 0.14, 'triangle', 0.16); },
    tick() { tone(88, now(), 0.04, 'square', 0.07); },
    whoosh() { const t = now(); slide(220, 900, t, 0.4, 'sawtooth', 0.07); tone(79, t + 0.38, 0.12, 'triangle', 0.12); },
    reveal() { const t = now(); tone(79, t, 0.12, 'triangle', 0.16); tone(84, t + 0.11, 0.3, 'triangle', 0.18); },
    correct() { const t = now(); [72, 76, 79, 84].forEach((m, i) => { tone(m, t + i * 0.09, 0.14, 'triangle', 0.2); tone(m + 12, t + i * 0.09, 0.1, 'square', 0.05); }); tone(88, t + 0.36, 0.5, 'triangle', 0.2); },
    wrong() { const t = now(); tone(55, t, 0.3, 'sawtooth', 0.12); tone(51, t + 0.16, 0.45, 'sawtooth', 0.12); },
    beep() { tone(76, now(), 0.16, 'square', 0.12); },
    alert() {
      const t = now();
      [76, 83, 76, 83, 76, 83].forEach((m, i) => tone(m, t + i * 0.14, 0.12, 'square', 0.1));
      slide(300, 1400, t + 0.85, 0.6, 'sawtooth', 0.07);
    },
    hit() {
      const t = now();
      kickTo(master, t, 0.7); slide(900, 80, t, 0.6, 'sawtooth', 0.1);
      [60, 64, 67, 72].forEach(m => tone(m, t, 0.9, 'triangle', 0.14));
    },
    boom() { const t = now(); noiseTo(master, t, 0.45, 0.12, 200); slide(140, 35, t, 0.5, 'sine', 0.4); },
    crackle() { const t = now(); for (let i = 0; i < 14; i++) tone(90 + ((Math.random() * 14) | 0), t + Math.random() * 0.7, 0.05, 'square', 0.03); },
    winner() {
      FX.fanfare();
      const t = now();
      for (let i = 0; i < 12; i++) tone(84 + [0, 4, 7, 12][i % 4], t + 1.3 + i * 0.09, 0.3, 'triangle', 0.07);
    },
    drum(ms) {
      if (stopDrumFn) stopDrumFn();
      const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(master);
      const t0 = now(), dur = ms / 1000;
      let t = 0;
      while (t < dur) { const p = t / dur; noiseTo(bus, t0 + t, 0.06, 0.03 + 0.13 * p, 1200); t += Math.max(0.032, 0.085 - 0.055 * p); }
      for (let k = 0; k * 0.5 < dur; k++) kickTo(bus, t0 + k * 0.5, 0.3 + 0.3 * (k * 0.5 / dur));
      stopDrumFn = () => { bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.setTargetAtTime(0, ctx.currentTime, 0.03); };
    },
    fanfare() {
      const t = now();
      [[72, 0, .14], [72, .16, .14], [72, .32, .14], [76, .48, .2], [79, .72, .2], [79, 1.0, .12], [84, 1.15, .9]].forEach(([m, o, d]) => {
        tone(m, t + o, d, 'square', 0.07); tone(m - 12, t + o, d, 'triangle', 0.16);
      });
      tone(88, t + 1.15, 0.9, 'triangle', 0.12);
    },
  };

  const SFX = { unlock: init };
  Object.keys(FX).forEach(k => { SFX[k] = (...a) => { if (ready()) FX[k](...a); }; });
  SFX.stopDrum = () => { if (stopDrumFn) { stopDrumFn(); stopDrumFn = null; } };
  SFX.music = name => {
    if (pvCur !== undefined) { pvCur = name; return; }
    if (cur !== name) { cur = name; step = 0; nextT = 0; }
  };
  function endPreview() {
    clearTimeout(pvTimer);
    if (pvCur !== undefined) { cur = pvCur; pvCur = undefined; }
    active = chosen; step = 0; nextT = 0;
  }
  SFX.themes = () => Object.keys(THEMES).map(k => ({ id: k, name: THEMES[k].name })).concat([{ id: 'off', name: 'ปิดเพลง (เหลือแต่เอฟเฟกต์)' }]);
  SFX.getTheme = () => chosen;
  SFX.setTheme = id => {
    if (id !== 'off' && !THEMES[id]) return;
    endPreview(); chosen = active = id; localStorage.setItem('qp_music', id);
  };
  SFX.preview = id => {
    init();
    if (!THEMES[id]) return;
    if (pvCur === undefined) pvCur = cur;
    clearTimeout(pvTimer);
    active = id; cur = 'lobby'; step = 0; nextT = 0;
    pvTimer = setTimeout(endPreview, 8000);
  };
  SFX.setMuted = b => {
    muted = b; localStorage.setItem('qp_mute', b ? '1' : '0');
    if (master) master.gain.value = b ? 0 : 0.6;
    if (btn) { btn.textContent = b ? '🔇' : '🔊'; btn.setAttribute('aria-label', b ? 'เปิดเสียง' : 'ปิดเสียง'); }
    if (!b) init();
  };
  function mount() {
    btn = document.createElement('button');
    const top = document.body.dataset.sfx === 'top';
    btn.style.cssText = 'position:fixed;right:10px;' + (top ? 'top:10px;width:40px;height:40px;font-size:1.15rem;' : 'bottom:12px;width:48px;height:48px;font-size:1.4rem;') + 'z-index:50;border-radius:50%;border:0;background:rgba(0,0,0,.45);color:#fff;cursor:pointer';
    btn.onclick = e => { e.stopPropagation(); SFX.setMuted(!muted); };
    document.body.appendChild(btn); SFX.setMuted(muted);
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, init, { passive: true }));
  if (document.body) mount(); else addEventListener('DOMContentLoaded', mount);
  window.SFX = SFX;
})();
