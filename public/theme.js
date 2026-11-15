(function () {
  const FONTS = ['Kanit', 'Prompt', 'Sarabun', 'Mitr', 'Itim', 'Mali'];
  const PRESETS = {
    wedding: { name: 'งานแต่ง', bg: '#fff1e3', text: '#5a3b3b', card: '#ffffff', ink: '#4a2f2f', accent: '#f4a3c0', a0: '#e0568a', a1: '#3d9be9', a2: '#f08a24', a3: '#2e7d6b', font: 'Mali', frameBg: '#ffffff', frameInk: '#4a2f2f', frameBorder: '#f4a3c0' },
    classic: { name: 'คลาสสิก', bg: '#46178f', text: '#ffffff', card: '#ffffff', ink: '#1f1f2e', accent: '#ffd23f', a0: '#e21b3c', a1: '#1368ce', a2: '#d89e00', a3: '#26890c', font: 'Kanit', frameBg: '#ffffff', frameInk: '#1f1f2e', frameBorder: '#ffd23f' },
    ocean: { name: 'ทะเล', bg: '#06304f', text: '#e9f6ff', card: '#e9f6ff', ink: '#06304f', accent: '#ffb703', a0: '#e63946', a1: '#118ab2', a2: '#f4a261', a3: '#2a9d8f', font: 'Prompt', frameBg: '#e9f6ff', frameInk: '#06304f', frameBorder: '#ffb703' },
    neon: { name: 'นีออน', bg: '#10002b', text: '#ffffff', card: '#240046', ink: '#ffffff', accent: '#00f5d4', a0: '#ff006e', a1: '#3a86ff', a2: '#fb5607', a3: '#8338ec', font: 'Mitr', frameBg: '#240046', frameInk: '#ffffff', frameBorder: '#00f5d4' },
  };
  const loaded = {};
  function loadFont(f) {
    if (loaded[f]) return;
    loaded[f] = 1;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f) + ':wght@400;500;600;700&subset=thai&display=swap';
    document.head.appendChild(l);
  }
  function applyTheme(t) {
    t = Object.assign({}, PRESETS.wedding, t || {});
    const r = document.documentElement.style;
    ['bg', 'text', 'card', 'ink', 'accent', 'a0', 'a1', 'a2', 'a3', 'frameBg', 'frameInk', 'frameBorder'].forEach(k => r.setProperty('--' + k, t[k]));
    r.setProperty('--font', "'" + t.font + "'");
    r.setProperty('--bgimg', t.bgImage ? 'url("' + String(t.bgImage).replace(/"/g, '%22') + '")' : 'none');
    loadFont(t.font);
    document.querySelectorAll('[data-logo]').forEach(el => { if (t.logo) el.src = t.logo; el.style.display = t.logo ? '' : 'none'; });
    document.querySelectorAll('[data-title]').forEach(el => { el.textContent = t.title || ''; });
    return t;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let tm;
  function runTimer(bar, num, ms, total) {
    clearInterval(tm);
    const end = Date.now() + ms;
    if (bar) {
      bar.style.transition = 'none';
      bar.style.width = Math.min(100, (ms / total) * 100) + '%';
      void bar.offsetWidth;
      bar.style.transition = 'width ' + ms + 'ms linear';
      bar.style.width = '0%';
    }
    const tick = () => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      if (num) num.textContent = s;
      if (s <= 0) clearInterval(tm);
    };
    tick();
    tm = setInterval(tick, 200);
  }
  // นับถอยหลัง 3-2-1 (ถ้า announce=true จะเรียก cb('announce') ก่อนจนเหลือ 3 วินาที)
  let cdTimer = null;
  function stopCount() { clearInterval(cdTimer); cdTimer = null; }
  function runCount(ms, announce, cb) {
    stopCount();
    const end = Date.now() + ms; let last = null;
    const tick = () => {
      const rem = end - Date.now();
      const tok = (announce && rem > 3000) ? 'announce' : Math.max(1, Math.ceil(rem / 1000));
      if (tok !== last) { last = tok; cb(tok); }
      if (rem <= 0) stopCount();
    };
    tick(); cdTimer = setInterval(tick, 100);
  }
  // จังหวะการประกาศผล: ที่ 3 -> ที่ 2 -> ที่ 1 (ใช้ร่วมกันระหว่างจอใหญ่กับมือถือ)
  const POD = { lead: 1200, steps: { 2: [2200, 3300], 1: [2200, 3500], 0: [3500, 7200] } };
  function podiumTimes(n) {
    let t = POD.lead; const reveals = [];
    for (const idx of [2, 1, 0]) {
      if (idx >= n) continue;
      const [d, h] = POD.steps[idx];
      reveals.push({ idx, drumAt: t, drum: d, at: t + d });
      t += d + h;
    }
    return { reveals, total: t, last: reveals.length ? reveals[reveals.length - 1].at : 0 };
  }
  window.runCount = runCount; window.stopCount = stopCount; window.podiumTimes = podiumTimes;
  window.FONTS = FONTS; window.PRESETS = PRESETS; window.applyTheme = applyTheme; window.esc = esc; window.runTimer = runTimer;
  const svg = p => '<svg class="shape" viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';
  window.SHAPES = [
    svg('<polygon fill="currentColor" points="12,2 23,22 1,22"/>'),
    svg('<polygon fill="currentColor" points="12,1 23,12 12,23 1,12"/>'),
    svg('<circle fill="currentColor" cx="12" cy="12" r="10.5"/>'),
    svg('<rect fill="currentColor" x="2.5" y="2.5" width="19" height="19" rx="1.5"/>'),
  ];
})();
