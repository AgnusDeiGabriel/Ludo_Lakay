/* Pòtfèy + liv kontab (ledger). Vèsyon sa a sere done yo nan yon fichye JSON.
   Pou pwodiksyon: ranplase l ak PostgreSQL (tranzaksyon atomik), pa janm fichye. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');
let db = { users: {}, tokens: {}, ledger: [], house: 0 };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch (e) { /* premye demaraj */ }

let saveT = null;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE + '.tmp', JSON.stringify(db));
    fs.renameSync(FILE + '.tmp', FILE);
  }, 200);
}

function record(uid, amount, reason, ref) {
  db.ledger.push({ t: Date.now(), uid, amount, reason, ref: ref || null, balance: uid ? db.users[uid].balance : db.house });
  if (db.ledger.length > 50000) db.ledger.splice(0, 10000);
}

module.exports = {
  /* Idantite envite pa token (pou pwodiksyon: telefòn + OTP / KYC). */
  auth(token, name, startBalance) {
    let uid = token && db.tokens[token];
    if (!uid) {
      token = crypto.randomBytes(24).toString('hex');
      uid = 'u_' + crypto.randomBytes(6).toString('hex');
      db.tokens[token] = uid;
      db.users[uid] = { name: name || 'Jwè', balance: 0, created: Date.now() };
      if (startBalance > 0) { db.users[uid].balance = startBalance; record(uid, startBalance, 'bonus_demo'); }
    }
    if (name) db.users[uid].name = String(name).slice(0, 14);
    save();
    return { token, uid, name: db.users[uid].name, balance: db.users[uid].balance };
  },
  setName(uid, name) { if (db.users[uid]) { db.users[uid].name = String(name).slice(0, 14); save(); } },
  balance(uid) { return db.users[uid] ? db.users[uid].balance : 0; },
  credit(uid, amount, reason, ref) {
    if (!(amount > 0)) throw new Error('Montan pa valid');
    db.users[uid].balance += amount; record(uid, amount, reason, ref); save();
    return db.users[uid].balance;
  },
  debit(uid, amount, reason, ref) {
    if (!(amount > 0)) throw new Error('Montan pa valid');
    if (db.users[uid].balance < amount) throw new Error('Balans pa ase');
    db.users[uid].balance -= amount; record(uid, -amount, reason, ref); save();
    return db.users[uid].balance;
  },
  houseCredit(amount, ref) { db.house += amount; record(null, amount, 'rake', ref); save(); },
  history(uid, n = 20) { return db.ledger.filter((l) => l.uid === uid).slice(-n).reverse(); },
};
