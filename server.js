'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 20000, pingTimeout: 30000, maxHttpBufferSize: 12e6 });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/host', (_q, r) => r.sendFile(path.join(__dirname, 'public', 'host.html')));
app.get('/health', (_q, r) => r.send('ok'));

const games = new Map();
app.get('/m/:pin/:id', (req, res) => {
  const g = games.get(req.params.pin), m = g && g.media.get(req.params.id);
  if (!m) return res.status(404).end();
  res.set({ 'Content-Type': m.mime, 'Cache-Control': 'public, max-age=21600', 'X-Content-Type-Options': 'nosniff' }).send(m.buf);
});
const MAX_PLAYERS = 400;
const HEX = /^#[0-9a-f]{6}$/i;
const FONTS = ['Kanit', 'Prompt', 'Sarabun', 'Mitr', 'Itim', 'Mali'];
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const rid = () => crypto.randomBytes(12).toString('hex');

function cleanTheme(t) {
  t = t || {};
  const o = { title: str(t.title, 60), font: FONTS.includes(t.font) ? t.font : 'Kanit' };
  for (const k of ['bg', 'text', 'card', 'ink', 'accent', 'a0', 'a1', 'a2', 'a3', 'frameBg', 'frameInk', 'frameBorder']) o[k] = HEX.test(t[k]) ? t[k] : '#888888';
  for (const k of ['logo', 'bgImage']) {
    const u = str(t[k], 450000);
    o[k] = /^(https?:\/\/|data:image\/)/i.test(u) ? u : '';
  }
  return o;
}

const DATA_IMG = /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i;
const HTTP_URL = /^https?:\/\/\S{1,490}$/i;
function ytId(u) {
  const m = String(u).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:\S*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}
// รูปของตัวเลือก: '' = ไม่มี, null = ใช้ไม่ได้
function cleanImg(u) {
  u = str(u, 700000).trim();
  if (!u) return '';
  return (DATA_IMG.test(u) || HTTP_URL.test(u)) ? u : null;
}
// สื่อประกอบคำถาม: รูป / YouTube / ไฟล์วิดีโอ
function cleanMedia(u) {
  u = str(u, 700000).trim();
  if (!u) return null;
  const id = ytId(u);
  if (id) return { type: 'youtube', id };
  if (DATA_IMG.test(u)) return { type: 'image', url: u };
  if (HTTP_URL.test(u)) return { type: /\.(mp4|webm|ogv)(\?|#|$)/i.test(u) ? 'video' : 'image', url: u };
  return { err: true };
}

function cleanQuiz(qz) {
  if (!Array.isArray(qz) || !qz.length) return { err: 'ยังไม่มีคำถาม' };
  const out = [];
  for (let i = 0; i < Math.min(qz.length, 100); i++) {
    const q = qz[i] || {}, n = i + 1;
    const text = str(q.text, 200).trim();
    const opts = [], imgs = [];
    for (let j = 0; j < 4; j++) {
      opts.push(str(Array.isArray(q.options) ? q.options[j] : '', 80).trim());
      const im = cleanImg(Array.isArray(q.optImg) ? q.optImg[j] : '');
      if (im === null) return { err: 'รูปของตัวเลือกในข้อ ' + n + ' ใช้ไม่ได้ (ต้องเป็นลิงก์ http/https หรือไฟล์ที่อัปโหลด)' };
      imgs.push(im);
    }
    while (opts.length && !opts[opts.length - 1] && !imgs[imgs.length - 1]) { opts.pop(); imgs.pop(); }
    const c = Number(q.correct) | 0;
    if (!text || opts.length < 2 || opts.some((o, k) => !o && !imgs[k]) || c < 0 || c >= opts.length)
      return { err: 'คำถามข้อ ' + n + ' ยังไม่ครบ (ต้องมีคำถาม ตัวเลือกอย่างน้อย 2 ข้อ และเลือกคำตอบที่ถูก)' };
    const media = cleanMedia(q.media);
    if (media && media.err) return { err: 'ลิงก์รูป/วิดีโอของข้อ ' + n + ' ใช้ไม่ได้' };
    out.push({ text, options: opts, optImg: imgs, correct: c, time: Math.min(120, Math.max(5, Number(q.time) || 20)), media });
  }
  return { quiz: out };
}

// ย้ายรูปที่อัปโหลด (data URL) ไปเก็บที่เซิร์ฟเวอร์ แล้วใช้ลิงก์สั้นแทน เพื่อให้มือถือ 200 เครื่องโหลดจากแคชได้
function internMedia(g) {
  let total = 0;
  const put = url => {
    const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/i.exec(url || '');
    if (!m) return url;
    const buf = Buffer.from(m[2], 'base64');
    total += buf.length;
    if (total > 30e6) throw new Error('too big');
    const id = rid().slice(0, 10);
    g.media.set(id, { mime: m[1].toLowerCase(), buf });
    return '/m/' + g.pin + '/' + id;
  };
  for (const q of g.quiz) {
    if (q.media && q.media.type === 'image') q.media.url = put(q.media.url);
    q.optImg = q.optImg.map(put);
  }
}

function newPin() {
  let p;
  do p = String(Math.floor(100000 + Math.random() * 900000)); while (games.has(p));
  return p;
}

function ranking(g) {
  return [...g.players.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'th'));
}
function rankInfo(g) {
  const list = ranking(g), rk = new Map();
  let last = null, rank = 0;
  list.forEach((p, i) => { if (p.score !== last) { rank = i + 1; last = p.score; } rk.set(p.id, rank); });
  return { rk, list };
}
const needsRank = g => g.state === 'reveal' || g.state === 'board' || g.state === 'final';
const COUNT_MS = 3000;     // นับถอยหลัง 3-2-1
const ANNOUNCE_MS = 3500;  // ประกาศ "ข้อสุดท้าย คะแนนคูณ 2" ก่อนนับถอยหลัง
const isLast = g => g.quiz.length > 1 && g.q === g.quiz.length - 1;
const countView = g => ({ ms: Math.max(0, g.countEnd - Date.now()), announce: isLast(g) });

function hostView(g) {
  const q = g.quiz[g.q];
  const v = { pin: g.pin, state: g.state, count: g.players.size, playerTotal: g.players.size, q: g.q, total: g.quiz.length, answered: g.answered, online: 0 };
  for (const p of g.players.values()) if (p.connected) v.online++;
  v.last = isLast(g);
  v.nextLast = g.quiz.length > 1 && g.q + 2 === g.quiz.length;
  if (g.state === 'count') v.count = countView(g);
  if (g.state === 'lobby') v.names = [...g.players.values()].map(p => p.name).slice(-250);
  if (q && (g.state === 'intro' || g.state === 'question' || g.state === 'reveal'))
    v.question = { text: q.text, options: q.options, optImg: q.optImg, media: q.media, time: q.time, ms: g.state === 'question' ? Math.max(0, g.deadline - Date.now()) : 0 };
  if (g.state === 'reveal') v.reveal = { correct: q.correct, counts: g.counts };
  if (g.state === 'board' || g.state === 'final') {
    const list = ranking(g);
    v.top = list.slice(0, g.state === 'final' ? 10 : 5).map(p => ({ name: p.name, score: p.score, gain: p.last ? p.last.points : 0 }));
    if (g.state === 'final') {
      const ri = rankInfo(g);
      v.all = list.map(p => ({ rank: ri.rk.get(p.id), name: p.name, score: p.score, correct: p.correct }));
    }
  }
  return v;
}

function playerView(g, p, ri) {
  const q = g.quiz[g.q];
  const v = { state: g.state, name: p.name, score: p.score, q: g.q, total: g.quiz.length, theme: g.theme, answered: p.answer ? p.answer.c : null, last: isLast(g) };
  if (g.state === 'count') v.count = countView(g);
  if (q && g.state === 'intro') v.question = { time: q.time, n: q.options.length, options: q.options, optImg: q.optImg, ms: Math.max(0, g.introEnd - Date.now()) };
  if (q && g.state === 'question') v.question = { text: q.text, time: q.time, n: q.options.length, options: q.options, optImg: q.optImg, ms: Math.max(0, g.deadline - Date.now()) };
  if (ri && (g.state === 'reveal' || g.state === 'board')) {
    v.result = p.last; v.correct = q.correct; v.rank = ri.rk.get(p.id); v.of = g.players.size;
    const i = ri.list.indexOf(p);
    if (i > 0 && ri.list[i - 1].score > p.score) v.behind = { name: ri.list[i - 1].name, gap: ri.list[i - 1].score - p.score };
  }
  if (ri && g.state === 'final') { v.rank = ri.rk.get(p.id); v.of = g.players.size; v.correctCount = p.correct; }
  return v;
}

function sendHost(g) { io.to('h:' + g.pin).emit('h:view', hostView(g)); }
function sendPlayer(g, p, ri) { if (p.connected && p.sid) io.to(p.sid).emit('p:view', playerView(g, p, ri)); }
function sendAll(g) {
  const ri = needsRank(g) ? rankInfo(g) : null;
  for (const p of g.players.values()) sendPlayer(g, p, ri);
}
function sendHostSoon(g) {
  if (g.hostTimer) return;
  g.hostTimer = setTimeout(() => { g.hostTimer = null; sendHost(g); }, 250);
}

function startQ(g) {
  g.q++;
  if (g.q >= g.quiz.length) return finish(g);
  const q = g.quiz[g.q];
  g.state = 'count';
  g.answered = 0;
  g.counts = q.options.map(() => 0);
  for (const p of g.players.values()) { p.answer = null; p.last = null; }
  const ms = COUNT_MS + (isLast(g) ? ANNOUNCE_MS : 0);
  g.countEnd = Date.now() + ms;
  clearTimeout(g.timer);
  g.timer = setTimeout(() => beginIntro(g), ms);
  sendAll(g); sendHost(g);
}

function beginIntro(g) {
  if (g.state !== 'count') return;
  clearTimeout(g.timer);
  const q = g.quiz[g.q];
  g.state = 'intro';
  const introMs = Math.min(9000, 3000 + q.text.length * 60);
  g.introEnd = Date.now() + introMs;
  g.timer = setTimeout(() => openQ(g), introMs);
  sendAll(g); sendHost(g);
}

function openQ(g) {
  if (g.state !== 'intro') return;
  clearTimeout(g.timer);
  const q = g.quiz[g.q];
  g.state = 'question';
  g.start = Date.now();
  g.deadline = g.start + q.time * 1000;
  g.timer = setTimeout(() => reveal(g), q.time * 1000 + 400);
  sendAll(g); sendHost(g);
}

function reveal(g) {
  if (g.state !== 'question') return;
  clearTimeout(g.timer);
  const q = g.quiz[g.q];
  g.state = 'reveal';
  const mult = isLast(g) ? 2 : 1;
  for (const p of g.players.values()) {
    const a = p.answer;
    const ok = !!a && a.c === q.correct;
    let pts = 0;
    if (ok) {
      p.streak++; p.correct++;
      pts = (Math.round(1000 * (1 - (a.t / (q.time * 1000)) / 2)) + Math.min(p.streak - 1, 4) * 100) * mult;
    } else p.streak = 0;
    p.score += pts;
    p.last = { correct: ok, answered: !!a, points: pts, streak: p.streak, mult };
  }
  sendAll(g); sendHost(g);
}

function finish(g) {
  clearTimeout(g.timer);
  g.state = 'final';
  sendAll(g); sendHost(g);
}

function hostGame(s) {
  const d = s.data || {};
  if (!d.host) return null;
  const g = games.get(d.pin);
  if (g) g.last = Date.now();
  return g || null;
}

io.on('connection', s => {
  s.data = {};

  s.on('host:create', (d, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    const qz = cleanQuiz(d && d.quiz);
    if (qz.err) return cb({ ok: false, error: qz.err });
    const g = {
      pin: newPin(), hostKey: rid(), quiz: qz.quiz, theme: cleanTheme(d.theme),
      players: new Map(), state: 'lobby', q: -1, answered: 0, counts: [], deadline: 0, last: Date.now(), media: new Map(),
    };
    try { internMedia(g); } catch (e) { return cb({ ok: false, error: 'รูปภาพรวมกันใหญ่เกินไป ลองลดจำนวนรูปหรือใช้ลิงก์แทน' }); }
    games.set(g.pin, g);
    s.join('h:' + g.pin);
    s.data = { host: true, pin: g.pin };
    cb({ ok: true, pin: g.pin, hostKey: g.hostKey });
    sendHost(g);
  });

  s.on('host:resume', (d, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    const g = d && games.get(String(d.pin));
    if (!g || g.hostKey !== d.hostKey) return cb({ ok: false });
    s.join('h:' + g.pin);
    s.data = { host: true, pin: g.pin };
    cb({ ok: true });
    sendHost(g);
  });

  s.on('host:next', () => {
    const g = hostGame(s);
    if (!g) return;
    if (g.state === 'lobby' || g.state === 'board') startQ(g);
    else if (g.state === 'count') beginIntro(g);
    else if (g.state === 'intro') openQ(g);
    else if (g.state === 'question') reveal(g);
    else if (g.state === 'reveal') {
      if (g.q + 1 >= g.quiz.length) finish(g);
      else { g.state = 'board'; sendAll(g); sendHost(g); }
    }
  });

  s.on('host:end', () => { const g = hostGame(s); if (g && g.state !== 'final') finish(g); });

  s.on('player:join', (d, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    d = d || {};
    const g = games.get(String(d.pin || '').trim());
    if (!g) return cb({ ok: false, error: 'ไม่พบห้องนี้ ตรวจสอบรหัส PIN อีกครั้ง' });
    g.last = Date.now();
    let p = d.pid && g.players.get(String(d.pid));
    if (!p) {
      const name = str(d.name, 16).replace(/\s+/g, ' ').trim();
      if (!name) return cb({ ok: false, error: 'กรุณาใส่ชื่อ' });
      if (g.players.size >= MAX_PLAYERS) return cb({ ok: false, error: 'ห้องเต็มแล้ว' });
      for (const o of g.players.values())
        if (o.name.toLowerCase() === name.toLowerCase()) return cb({ ok: false, error: 'ชื่อนี้มีคนใช้แล้ว ลองชื่ออื่น' });
      p = { id: rid(), name, score: 0, streak: 0, correct: 0, answer: null, last: null, sid: null, connected: false };
      g.players.set(p.id, p);
    }
    p.sid = s.id; p.connected = true;
    s.data = { pin: g.pin, pid: p.id };
    cb({ ok: true, pid: p.id });
    sendPlayer(g, p, needsRank(g) ? rankInfo(g) : null);
    sendHostSoon(g);
  });

  s.on('player:answer', (c, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    const g = games.get(s.data.pin);
    const p = g && g.players.get(s.data.pid);
    if (!p || g.state !== 'question' || p.answer) return cb({ ok: false });
    const q = g.quiz[g.q];
    c = Number(c) | 0;
    if (c < 0 || c >= q.options.length) return cb({ ok: false });
    const t = Math.min(Date.now() - g.start, q.time * 1000);
    if (Date.now() > g.deadline + 400) return cb({ ok: false });
    p.answer = { c, t };
    g.answered++;
    g.counts[c]++;
    cb({ ok: true });
    let online = 0;
    for (const x of g.players.values()) if (x.connected) online++;
    if (g.answered >= online) reveal(g); else sendHostSoon(g);
  });

  s.on('disconnect', () => {
    const g = games.get(s.data.pin);
    if (!g || s.data.host) return;
    const p = g.players.get(s.data.pid);
    if (p && p.sid === s.id) { p.connected = false; sendHostSoon(g); }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [pin, g] of games) if (now - g.last > 6 * 3600 * 1000) { clearTimeout(g.timer); games.delete(pin); }
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Quiz Party running on port ' + PORT));
