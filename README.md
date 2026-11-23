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

## Docker sou Proxmox + tinèl Cloudflare

### 1. Prepare yon machin sou Proxmox
- **Opsyon A — LXC** (pi lejè): kreye yon CT Debian 12, 1 vCPU, 1 GB RAM, 8 GB disk. Nan **Options → Features**, aktive **nesting** ak **keyctl** (Docker bezwen yo).
- **Opsyon B — VM**: Debian 12 oswa Ubuntu 24.04 nòmal.

Answit enstale Docker ladan l:
```bash
apt update && apt install -y curl git
curl -fsSL https://get.docker.com | sh
```

### 2. Kreye tinèl la sou Cloudflare
1. [one.dash.cloudflare.com](https://one.dash.cloudflare.com) → **Networks → Tunnels → Create a tunnel** → **Cloudflared**.
2. Ba l yon non (egz: `ludo-lakay`), chwazi **Docker**, epi kopye **token** ki nan kòmand lan (long tèks ki apre `--token`).
3. Nan **Public Hostname**: sous-domèn `ludo`, domèn ou, **Service**: `HTTP` → `app:3000`.
   (`app` se non sèvis la nan `docker-compose.yml`; cloudflared jwenn li sou rezo Docker la.)

WebSocket (Socket.io) mache atravè tinèl la san okenn lòt konfigirasyon.

### 3. Lanse l
```bash
git clone <repo-ou> ludo-lakay && cd ludo-lakay
cp .env.example .env
nano .env        # mete CLOUDFLARE_TUNNEL_TOKEN=..., DEMO_MODE=1 oswa 0
docker compose up -d --build
```
- Sit la: `https://ludo.domèn-ou.com` (atravè Cloudflare) oswa `http://IP-machin-lan:3000` sou rezo lokal la.
- Gade log yo: `docker compose logs -f`
- Mete l ajou: `git pull && docker compose up -d --build`
- Done yo (balans, tranzaksyon) rete nan volim `ludo-data`, yo pa pèdi lè w rebati imaj la. Fè backup:
  `docker run --rm -v ludo-lakay_ludo-data:/d -v $PWD:/b alpine tar czf /b/ludo-data.tgz -C /d .`

Si w pa vle pò 3000 louvri sou rezo lokal la, retire seksyon `ports:` nan `docker-compose.yml`; sit la ap rive sèlman pa tinèl la.

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
