/* Ludo Lakay — motè jwèt pataje (sèvè Node + navigatè).
   Sèvè a se sèl otorite: li woule dé a, li valide chak mouvman, li jere tan chak tou. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LudoEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const START = { red: 0, green: 13, yellow: 26, blue: 39 };
  const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
  const SEAT_COLORS = { 2: ['red', 'yellow'], 3: ['red', 'green', 'yellow'], 4: ['red', 'green', 'yellow', 'blue'] };
  const RAKE = 0.10;               // frè platfòm
  const TIME = { turn: 15000, botMin: 650, botMax: 1150, step: 150, after: 380, noMove: 1400, autoPick: 900 };

  let rnd;
  if (typeof window === 'undefined' && typeof require === 'function') {
    const c = require('crypto');
    rnd = (n) => c.randomInt(n);
  } else {
    rnd = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  }

  const absOf = (color, p) => (START[color] + p) % 52;
  const canMove = (p, v) => (p === 56 ? false : p === -1 ? v === 6 : p + v <= 56);

  /* ---------- AI (robo + jwè ki dekonekte) ---------- */
  function threats(players, pi, a) {
    let n = 0;
    players.forEach((Q, qi) => {
      if (qi === pi) return;
      Q.tokens.forEach((q) => {
        if (q >= 0 && q <= 50) { const d = (a - absOf(Q.color, q) + 52) % 52; if (d >= 1 && d <= 6) n++; }
      });
    });
    return n;
  }
  function evalMove(players, pi, i, v) {
    const P = players[pi], p = P.tokens[i], np = p === -1 ? 0 : p + v;
    let s = np * 0.35;
    if (p === -1) s += 55;
    if (np === 56) s += 110;
    if (np >= 51 && p < 51) s += 45;
    if (np <= 50) {
      const a = absOf(P.color, np);
      if (!SAFE.has(a)) {
        players.forEach((Q, qi) => {
          if (qi === pi) return;
          Q.tokens.forEach((q) => { if (q >= 0 && q <= 50 && absOf(Q.color, q) === a) s += 85 + q * 0.6; });
        });
        s -= threats(players, pi, a) * 32;
      } else s += 22;
    }
    if (p >= 0 && p <= 50) { const a0 = absOf(P.color, p); if (!SAFE.has(a0)) s += threats(players, pi, a0) * 22; }
    return s;
  }
  function bestMove(players, pi, mv, v, level) {
    if (level === 'easy' && rnd(100) < 55) return mv[rnd(mv.length)];
    const sc = mv.map((i) => ({ i, s: evalMove(players, pi, i, v) + (level === 'normal' ? rnd(18) : 0) }));
    sc.sort((a, b) => b.s - a.s);
    return sc[0].i;
  }

  /* ---------- Tab ---------- */
  class Table {
    constructor(o, emit, onEnd) {
      this.id = o.id; this.code = o.code || null; this.type = o.type || 'private';
      this.stake = o.stake || 0; this.size = o.size || 4; this.level = o.level || 'normal';
      this.players = []; this.status = 'waiting'; this.cur = 0; this.roll = 0; this.sixes = 0;
      this.phase = 'wait'; this.movable = []; this.deadline = 0; this.winner = null; this.bonus = false;
      this.emit = emit; this.onEnd = onEnd || function () {}; this.t = null; this.dead = false;
      this.createdAt = Date.now();
    }
    get pot() { return this.stake * this.players.length; }
    isFull() { return this.players.length >= this.size; }
    seatOf(id) { return this.players.findIndex((p) => p.id === id); }

    seat(p) {
      if (this.seatOf(p.id) >= 0) return null;
      if (this.status !== 'waiting') return 'Pati a deja kòmanse.';
      if (this.isFull()) return 'Tab la plen.';
      this.players.push({ id: p.id, name: p.name, bot: !!p.bot, sim: !!p.sim, color: null, tokens: [-1, -1, -1, -1], connected: true });
      this.recolor(); this.push();
      return null;
    }
    recolor() { this.players.forEach((p, k) => (p.color = SEAT_COLORS[this.size][k])); }
    unseat(id) {
      const i = this.seatOf(id); if (i < 0) return;
      if (this.status === 'waiting') { this.players.splice(i, 1); this.recolor(); this.push(); return; }
      this.players[i].connected = false; this.push();
      if (i === this.cur && this.status === 'playing') {          // AI pran tou a touswit
        if (this.phase === 'roll') this.later(() => this.doRoll(), 800);
        else if (this.phase === 'move') this.later(() => this.doMove(bestMove(this.players, this.cur, this.movable, this.roll, 'hard')), 800);
      }
    }
    reconnect(id) { const i = this.seatOf(id); if (i >= 0 && !this.players[i].connected) { this.players[i].connected = true; this.push(); } }

    start() {
      if (this.status !== 'waiting') return;
      this.status = 'playing'; this.cur = 0; this.push();
      this.later(() => this.startTurn(false), 900);
    }
    auto(P) { return P.bot || !P.connected; }
    botMs() { return TIME.botMin + rnd(TIME.botMax - TIME.botMin); }
    later(fn, ms) { clearTimeout(this.t); this.t = setTimeout(() => { if (!this.dead) fn(); }, ms); }

    startTurn(bonus) {
      if (this.status !== 'playing') return;
      const P = this.players[this.cur];
      this.phase = 'roll'; this.roll = 0; this.movable = []; this.bonus = !!bonus;
      const auto = this.auto(P);
      this.deadline = auto ? 0 : Date.now() + TIME.turn;
      this.push();
      this.later(() => this.doRoll(), auto ? this.botMs() : TIME.turn);
    }
    rollBy(id) { if (this.status === 'playing' && this.phase === 'roll' && this.players[this.cur].id === id) this.doRoll(); }
    doRoll() {
      if (this.phase !== 'roll') return;
      const P = this.players[this.cur], v = 1 + rnd(6);
      this.roll = v; this.phase = 'rolled'; this.deadline = 0;
      this.emit('rolled', { seat: this.cur, value: v });
      if (v === 6) this.sixes++;
      if (v === 6 && this.sixes >= 3) { this.emit('msg', { seat: this.cur, key: 'three6' }); return this.later(() => this.next(), TIME.noMove); }
      const mv = P.tokens.map((p, i) => (canMove(p, v) ? i : -1)).filter((i) => i >= 0);
      if (!mv.length) { this.emit('msg', { seat: this.cur, key: 'nomove' }); return this.later(() => (v === 6 ? this.startTurn(true) : this.next()), TIME.noMove); }
      const same = mv.every((i) => P.tokens[i] === P.tokens[mv[0]]);
      this.phase = 'move';
      if (mv.length === 1 || same) {
        const pick = mv[0]; this.movable = [pick]; this.push(true);
        return this.later(() => this.doMove(pick), TIME.autoPick);
      }
      this.movable = mv;
      if (this.auto(P)) {
        this.push(true);
        return this.later(() => this.doMove(bestMove(this.players, this.cur, mv, v, P.bot ? this.level : 'hard')), TIME.autoPick + rnd(400));
      }
      this.deadline = Date.now() + TIME.turn; this.push();
      this.later(() => this.doMove(bestMove(this.players, this.cur, mv, v, 'hard')), TIME.turn);
    }
    moveBy(id, i) {
      if (this.status !== 'playing' || this.phase !== 'move' || this.players[this.cur].id !== id) return;
      if (!this.movable.includes(i)) return;
      this.doMove(i);
    }
    doMove(i) {
      if (this.phase !== 'move') return;
      clearTimeout(this.t);
      const P = this.players[this.cur], v = this.roll, from = P.tokens[i];
      if (!canMove(from, v)) return;
      const to = from === -1 ? 0 : from + v;
      this.phase = 'anim'; this.movable = []; this.deadline = 0;
      P.tokens[i] = to;
      const caps = [];
      if (to <= 50) {
        const a = absOf(P.color, to);
        if (!SAFE.has(a)) this.players.forEach((Q, qi) => {
          if (qi === this.cur) return;
          Q.tokens.forEach((q, j) => { if (q >= 0 && q <= 50 && absOf(Q.color, q) === a) { caps.push([qi, j, q]); Q.tokens[j] = -1; } });
        });
      }
      this.emit('moved', { seat: this.cur, token: i, from, to, captures: caps });
      const steps = from === -1 ? 1 : v;
      const won = P.tokens.every((t) => t === 56);
      this.later(() => {
        if (won) return this.finish(this.cur);
        const extra = v === 6 || caps.length > 0 || to === 56;
        if (extra) { if (v !== 6) this.sixes = 0; this.startTurn(true); } else this.next();
      }, steps * TIME.step + TIME.after + (caps.length ? 450 : 0));
    }
    next() { this.sixes = 0; this.cur = (this.cur + 1) % this.players.length; this.startTurn(false); }
    finish(wi) {
      this.status = 'done'; this.phase = 'over'; this.winner = wi; this.deadline = 0;
      const pot = this.pot, payout = Math.floor(pot * (1 - RAKE));
      this.push();
      this.emit('end', { seat: wi, pot, payout, rake: pot - payout });
      this.onEnd(this, wi, payout);
    }
    destroy() { this.dead = true; clearTimeout(this.t); }

    snapshot(hideMovable) {
      return {
        id: this.id, code: this.code, type: this.type, stake: this.stake, size: this.size,
        status: this.status, pot: this.pot, cur: this.cur, phase: this.phase, roll: this.roll,
        movable: hideMovable ? [] : this.movable, turnLeft: this.deadline ? Math.max(0, this.deadline - Date.now()) : 0,
        turnMs: TIME.turn, winner: this.winner, bonus: this.bonus,
        players: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: p.bot, sim: p.sim, connected: p.connected, tokens: p.tokens.slice() })),
      };
    }
    push(hideMovable) { this.emit('table', this.snapshot(hideMovable)); }
  }

  return { Table, START, SAFE, RAKE, TIME, SEAT_COLORS, absOf, canMove, bestMove, rnd };
});
