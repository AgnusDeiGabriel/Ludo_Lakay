# Ludo Lakay 🌴🎲

Jwèt Ludo an liy ak mize: **tab prive** (yo pataje l pa lyen) ak **tab piblik** (sistèm nan mete 4 jwè ansanm). Tab la fèt nan stil ayisyen.

## Lanse l

```bash
npm install
npm run demo        # mòd demo: chak nouvo jwè resevwa 1,000 jeton gratis
# oswa
npm start           # pwodiksyon (DEMO_MODE=0)
```
Ouvri `http://localhost:3000`. Pou teste an liy, ouvri plizyè navigatè oswa plizyè telefòn sou menm rezo a.

## Kijan l mache

| Pati | Fichye | Wòl |
|---|---|---|
| Motè jwèt | `shared/engine.js` | Règ yo, tou yo, tan chak tou (15 s), kapti, AI. **Se sèvè a ki woule dé a** (`crypto.randomInt`), konsa kliyan an pa ka triche. |
| Sèvè | `server/server.js` | Socket.io: tab prive (kòd 6 karaktè + lyen `/#t-KÒD`), keu piblik pa mize (4 jwè), rekoneksyon. |
| Pòtfèy | `server/wallet.js` | Balans ak liv kontab. Sèvè a pran mize yo lè pati a kòmanse, epi li peye gayan an pot la mwens 10%. Frè a ale nan kont platfòm nan (`house`). |
| Peman | `server/payments.js` | Founisè "demo" a aktif. MonCash/NatCash se kad sèlman (gade pi ba). |
| Kliyan | `public/index.html` | Tout ekran yo. San sèvè, l ap mache an **mòd apèsi**: menm motè a ap kouri nan navigatè a, ak jwè simile. |

**Si yon jwè dekonekte**, AI a jwe pou li. Lè l retounen sou sit la, li reprann plas li, epi si li genyen, lajan an rantre nan pòtfèy li.

## Anvan w aksepte lajan reyèl (obligatwa)

1. **Lisans**: jwèt aza ak lajan bezwen otorizasyon nan peyi kote w opere a. Pale ak yon avoka.
2. **Kont itilizatè**: ranplase idantite envite a (token) ak yon kont ki verifye pa telefòn + OTP, epi ajoute KYC ak verifikasyon laj (18+).
3. **Baz done**: ranplase fichye JSON lan ak PostgreSQL. Chak debi/kredi dwe fèt nan yon tranzaksyon atomik.
4. **Peman**: konekte MonCash Business / NatCash ak kle API ofisyèl yo. Kredite pòtfèy la **sèlman** apre webhook la rive epi ou verifye tranzaksyon an sou API founisè a. Retrè yo dwe gen limit epi pase pa yon revizyon.
5. **Echèl**: pou plizyè sèvè, sere eta tab yo nan Redis epi itilize `@socket.io/redis-adapter`.
6. **Sekirite**: HTTPS, limit sou kantite demann, jounal (log) chak tranzaksyon, ak siveyans pou kolizyon ant jwè (chèche moun ki jwe ansanm twòp fwa).
