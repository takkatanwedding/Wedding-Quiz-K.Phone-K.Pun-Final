// ทดสอบโหลดจำลองผู้เล่น: node loadtest.js <PIN> [จำนวน=200] [เซิร์ฟเวอร์=http://localhost:3000]
const { io } = require('socket.io-client');
const pin = process.argv[2], n = +process.argv[3] || 200, url = process.argv[4] || 'http://localhost:3000';
if (!pin) { console.log('ใช้: node loadtest.js <PIN> [จำนวน] [URL]'); process.exit(1); }
let joined = 0;
for (let i = 0; i < n; i++) {
  setTimeout(() => {
    const s = io(url, { transports: ['websocket'] });
    s.on('connect', () => s.emit('player:join', { pin, name: 'bot' + i }, r => { if (r.ok && ++joined === n) console.log('เข้าร่วมครบ', n, 'คน'); else if (!r.ok) console.log(r.error); }));
    s.on('p:view', v => {
      if (v.state === 'question' && v.answered == null) setTimeout(() => s.emit('player:answer', Math.floor(Math.random() * v.question.n)), 500 + Math.random() * 6000);
    });
  }, i * 20);
}
