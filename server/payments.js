/* Founisè peman.
   - "demo": ajoute jeton gratis (sèlman si DEMO_MODE=1).
   - "moncash" / "natcash": PA KONEKTE ANKÒ. Pou aktive yo, fòk ou gen kont machann
     ak kle API ofisyèl (Digicel MonCash Business / Natcom NatCash), epi swiv dokiman yo:
       1. Kreye yon peman (orderId, montan) → resevwa yon URL pou kliyan an peye.
       2. Founisè a rele webhook ou a (/api/pay/callback/:provider) lè peman an fèt.
       3. Verifye tranzaksyon an sou API founisè a, PA fè kliyan an konfyans.
       4. Sèlman lè sa a, rele wallet.credit(uid, montan, 'deposit', txId).
     Retrè (payout) yo dwe pase pa yon pwosesis verifikasyon (KYC, limit, revizyon). */

const DEMO = process.env.DEMO_MODE === '1';

const providers = {
  demo: {
    enabled: DEMO,
    async deposit({ uid, amount, wallet }) {
      if (!DEMO) throw new Error('Mòd demo pa aktive');
      if (![500, 1000, 5000].includes(amount)) throw new Error('Montan pa valid');
      return { balance: wallet.credit(uid, amount, 'deposit_demo') };
    },
  },
  moncash: {
    enabled: false,
    async deposit() { throw new Error('MonCash poko konfigire (MONCASH_CLIENT_ID / MONCASH_SECRET)'); },
  },
  natcash: {
    enabled: false,
    async deposit() { throw new Error('NatCash poko konfigire'); },
  },
};

module.exports = {
  list() { return Object.entries(providers).map(([id, p]) => ({ id, enabled: p.enabled })); },
  async deposit(provider, args) {
    const p = providers[provider];
    if (!p) throw new Error('Founisè enkoni');
    return p.deposit(args);
  },
};
