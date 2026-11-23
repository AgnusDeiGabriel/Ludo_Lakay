/* Ludo Lakay — sèvè an liy.
   Tab prive (kòd + lyen) · Tab piblik (matchmaking 4 jwè pa mize) · Mize an escrow · Peman gayan an */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Table, RAKE, TIME } = require('../shared/engine');
if (process.env.TEST_FAST === '1') Object.assign(TIME, { turn: 300, botMin: 5, botMax: 10, step: 1, after: 5, noMove: 5, autoPick: 5 });
const wallet = require('./wallet');
const payments = require('./payments');

const PORT = +process.env.PORT || 3000;
const DEMO = process.env.DEMO_MODE === '1';
const START_BAL = DEMO ? 1000 : 0;
const STAKES = [50, 100, 250, 500, 1000, 2500];
const PUBLIC_SIZE = 4;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/engine.js', (req, res) => res.sendFile(path.join(__dirname, '..', 'shared', 'engine.js')));
app.get('/health', (req, res) => res.json({ ok: true, tables: tables.size, online: io.engine.clientsCount }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || false } });

/* ---------- Eta ---------- */
const tables = new Map();      // id -> Table
const byCode = new Map();      // CODE -> id
const queues = new Map();      // stake -> [uid]
const online = new Map();      // uid -> Set(socket)
const userTable = new Map();   // uid -> table id
const userQueue = new Map();   // uid -> stake

const newId = () => crypto.randomBytes(6).toString('hex');
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c; do { c = Array.from({ length: 6 }, () => A[crypto.randomInt(A.length)]).join(''); } while (byCode.has(c));
  return c;
}
const toUser = (uid, evt, data) => (online.get(uid) || []).forEach((s) => s.emit(evt, data));
const pushBalance = (uid) => toUser(uid, 'balance', { balance: wallet.balance(uid) });

function createTable(o) {
  const id = newId();
  const room = 't:' + id;
  const t = new Table({ ...o, id }, (evt, data) => io.to(room).emit(evt, data), onEnd);
  t.room = room;
  tables.set(id, t);
  if (t.code) byCode.set(t.code, id);
  return t;
}
function joinRoom(uid, t) {
  userTable.set(uid, t.id);
  (online.get(uid) || []).forEach((s) => s.join(t.room));
}
function closeTable(t, delay = 15000) {
  setTimeout(() => {
    t.destroy(); tables.delete(t.id); if (t.code) byCode.delete(t.code);
    t.players.forEach((p) => { if (userTable.get(p.id) === t.id) userTable.delete(p.id); });
    io.socketsLeave(t.room);
  }, delay);
}

/* Kòmanse pati a: pran mize chak jwè (escrow). Si yon moun pa gen ase, li soti sou tab la. */
function tryStart(t) {
  if (!t.isFull() || t.status !== 'waiting') return;
  const broke = t.players.filter((p) => wallet.balance(p.id) < t.stake);
  if (broke.length) {
    broke.forEach((p) => { t.unseat(p.id); userTable.delete(p.id); toUser(p.id, 'kicked', { msg: 'Balans ou pa ase pou mize sa a.' }); });
    return;
  }
  t.players.forEach((p) => { wallet.debit(p.id, t.stake, 'stake', t.id); pushBalance(p.id); });
  t.start();
}
function onEnd(t, wi, payout) {
  const w = t.players[wi];
  wallet.credit(w.id, payout, 'win', t.id);
  wallet.houseCredit(t.pot - payout, t.id);
  t.players.forEach((p) => pushBalance(p.id));
  closeTable(t);
}

/* ---------- Matchmaking piblik ---------- */
function queueInfo(stake) {
  const q = queues.get(stake) || [];
  q.forEach((uid) => toUser(uid, 'queue', { stake, count: q.length, need: PUBLIC_SIZE }));
}
function leaveQueue(uid) {
  const stake = userQueue.get(uid); if (stake == null) return;
  const q = queues.get(stake) || [];
  const i = q.indexOf(uid); if (i >= 0) q.splice(i, 1);
  userQueue.delete(uid); queueInfo(stake);
}
function matchmake(stake) {
  const q = queues.get(stake) || [];
  for (let i = q.length - 1; i >= 0; i--) if (wallet.balance(q[i]) < stake || !online.has(q[i])) { userQueue.delete(q[i]); q.splice(i, 1); }
  while (q.length >= PUBLIC_SIZE) {
    const group = q.splice(0, PUBLIC_SIZE);
    const t = createTable({ type: 'public', stake, size: PUBLIC_SIZE });
    group.forEach((uid) => { userQueue.delete(uid); t.seat({ id: uid, name: userName(uid) }); joinRoom(uid, t); });
    tryStart(t);
  }
  queueInfo(stake);
}
const names = new Map();
const userName = (uid) => names.get(uid) || 'Jwè';

/* ---------- Socket ---------- */
io.on('connection', (s) => {
  let uid = null;
  let lastEmote = 0;
  const need = (cb) => { if (!uid) { cb && cb({ error: 'Konekte anvan' }); return false; } return true; };
  const ack = (cb) => (typeof cb === 'function' ? cb : () => {});

  s.on('hello', ({ token, name } = {}, cb) => {
    cb = ack(cb);
    const clean = String(name || '').trim().slice(0, 14);
    const u = wallet.auth(typeof token === 'string' ? token : null, clean, START_BAL);
    uid = u.uid; names.set(uid, u.name);
    if (!online.has(uid)) online.set(uid, new Set());
    online.get(uid).add(s);
    const tid = userTable.get(uid);
    const t = tid && tables.get(tid);
    cb({ ...u, demo: DEMO, stakes: STAKES, rake: RAKE, providers: payments.list() });
    if (t) { s.join(t.room); t.reconnect(uid); s.emit('table', t.snapshot()); }
  });

  s.on('set_name', ({ name } = {}) => { if (!uid) return; const n = String(name || '').trim().slice(0, 14); if (n) { names.set(uid, n); wallet.setName(uid, n); } });

  s.on('deposit', async ({ provider, amount } = {}, cb) => {
    cb = ack(cb); if (!need(cb)) return;
    try { const r = await payments.deposit(provider || 'demo', { uid, amount: +amount, wallet }); cb(r); pushBalance(uid); }
    catch (e) { cb({ error: e.message }); }
  });

  s.on('create_private', ({ stake, size } = {}, cb) => {
    cb = ack(cb); if (!need(cb)) return;
    stake = +stake; size = +size;
    if (!STAKES.includes(stake) || ![2, 3, 4].includes(size)) return cb({ error: 'Paramèt pa valid' });
    if (userTable.has(uid) || userQueue.has(uid)) return cb({ error: 'Ou deja sou yon tab' });
    if (wallet.balance(uid) < stake) return cb({ error: 'Balans ou pa ase' });
    const t = createTable({ type: 'private', stake, size, code: newCode() });
    t.hostId = uid;
    t.seat({ id: uid, name: userName(uid) }); joinRoom(uid, t);
    cb({ code: t.code });
    s.emit('table', t.snapshot());
  });

  s.on('join_private', ({ code } = {}, cb) => {
    cb = ack(cb); if (!need(cb)) return;
    const id = byCode.get(String(code || '').toUpperCase().trim());
    const t = id && tables.get(id);
    if (!t) return cb({ error: 'Tab sa a pa egziste oswa li fini' });
    if (t.seatOf(uid) >= 0) { joinRoom(uid, t); t.reconnect(uid); s.emit('table', t.snapshot()); return cb({ ok: true }); }
    if (userTable.has(uid) || userQueue.has(uid)) return cb({ error: 'Ou deja sou yon lòt tab' });
    if (wallet.balance(uid) < t.stake) return cb({ error: `Ou bezwen ${t.stake} jeton pou antre` });
    const err = t.seat({ id: uid, name: userName(uid) });
    if (err) return cb({ error: err });
    joinRoom(uid, t); cb({ ok: true });
    tryStart(t);
  });

  s.on('quick_play', ({ stake } = {}, cb) => {
    cb = ack(cb); if (!need(cb)) return;
    stake = +stake;
    if (!STAKES.includes(stake)) return cb({ error: 'Mize pa valid' });
    if (userTable.has(uid) || userQueue.has(uid)) return cb({ error: 'Ou deja sou yon tab' });
    if (wallet.balance(uid) < stake) return cb({ error: 'Balans ou pa ase' });
    if (!queues.has(stake)) queues.set(stake, []);
    queues.get(stake).push(uid); userQueue.set(uid, stake);
    cb({ ok: true });
    matchmake(stake);
  });

  s.on('cancel_queue', () => { if (uid) leaveQueue(uid); });

  s.on('leave_table', (_, cb) => {
    cb = ack(cb); if (!uid) return cb({});
    const t = tables.get(userTable.get(uid));
    if (t) {
      t.unseat(uid);                           // an pati: AI jwe pou li, li ka toujou genyen
      (online.get(uid) || []).forEach((x) => x.leave(t.room));
      userTable.delete(uid);
      if (t.status === 'waiting' && t.players.length === 0) closeTable(t, 0);
    }
    cb({});
  });

  s.on('roll', () => { const t = uid && tables.get(userTable.get(uid)); if (t) t.rollBy(uid); });
  s.on('move', ({ token } = {}) => { const t = uid && tables.get(userTable.get(uid)); if (t) t.moveBy(uid, +token); });
  s.on('emote', ({ i } = {}) => {
    const t = uid && tables.get(userTable.get(uid)); if (!t || Date.now() - lastEmote < 1500) return;
    lastEmote = Date.now(); const seat = t.seatOf(uid);
    if (seat >= 0 && Number.isInteger(i) && i >= 0 && i < 8) io.to(t.room).emit('emote', { seat, i });
  });
  s.on('history', (_, cb) => { cb = ack(cb); if (need(cb)) cb({ items: wallet.history(uid) }); });

  s.on('disconnect', () => {
    if (!uid) return;
    const set = online.get(uid); if (set) { set.delete(s); if (set.size) return; online.delete(uid); }
    leaveQueue(uid);
    const t = tables.get(userTable.get(uid));
    if (t) {
      if (t.status === 'waiting') { t.unseat(uid); userTable.delete(uid); if (!t.players.length) closeTable(t, 0); }
      else t.unseat(uid);                      // AI pran plas li jiskaske li retounen
    }
  });
});

server.listen(PORT, () => console.log(`Ludo Lakay ap kouri sou http://localhost:${PORT}  (demo: ${DEMO ? 'wi' : 'non'})`));
