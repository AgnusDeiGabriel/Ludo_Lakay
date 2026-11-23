#!/usr/bin/env bash
# Ludo Lakay — tinèl Cloudflare
#   ./tunnel.sh                       tinèl rapid (san kont): lyen https://….trycloudflare.com
#                                     (si gen yon token nan .env, li lanse tinèl pèmanan an pito)
#   ./tunnel.sh setup ludo.domen.com  kreye tinèl pèmanan sou kont Cloudflare ou, DNS, token
#   ./tunnel.sh status                montre ki tinèl k ap mache ak lyen an
#   ./tunnel.sh stop                  rete tinèl yo (sèvè a kontinye mache)
set -euo pipefail
cd "$(dirname "$0")"

IMG=cloudflare/cloudflared:2024.12.2
NAME=${TUNNEL_NAME:-ludo-lakay}
DC="docker compose --profile quick --profile named"

[ -f .env ] || cp .env.example .env
grep -q '^CLOUDFLARE_TUNNEL_TOKEN=' .env || echo 'CLOUDFLARE_TUNNEL_TOKEN=' >> .env

token() { grep -E '^CLOUDFLARE_TUNNEL_TOKEN=' .env | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r'; }
set_token() { grep -v '^CLOUDFLARE_TUNNEL_TOKEN=' .env > .env.tmp; echo "CLOUDFLARE_TUNNEL_TOKEN=$1" >> .env.tmp; mv .env.tmp .env; chmod 600 .env; }
# cloudflared nan Docker, ak sètifika kont lan sere nan ./.cloudflared
cf() { mkdir -p .cloudflared; docker run --rm -u 0 -e HOME=/root -v "$PWD/.cloudflared:/root/.cloudflared" "$IMG" "$@"; }

quick_url() { docker logs ludo-lakay-quicktunnel 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1; }

start_named() {
  $DC stop quicktunnel >/dev/null 2>&1 || true
  docker compose --profile named up -d --build app cloudflared
  echo "⏳ N ap tann tinèl la konekte…"
  for _ in $(seq 1 30); do
    if docker logs ludo-lakay-tunnel 2>&1 | grep -q 'Registered tunnel connection'; then
      echo "✅ Tinèl pèmanan an konekte."; return 0; fi
    sleep 2
  done
  echo "⚠️  Tinèl la poko konekte. Gade: docker logs ludo-lakay-tunnel"; return 1
}

start_quick() {
  $DC stop cloudflared >/dev/null 2>&1 || true
  docker compose --profile quick up -d --build app quicktunnel
  echo "⏳ N ap tann lyen an…"
  for _ in $(seq 1 45); do
    URL=$(quick_url || true)
    if [ -n "$URL" ]; then
      echo; echo "✅ Ludo Lakay sou entènèt:  $URL"; echo
      echo "   (Lyen sa a chanje chak fwa tinèl la rekòmanse. Pou yon lyen fiks: ./tunnel.sh setup ludo.domen-ou.com)"
      return 0; fi
    sleep 2
  done
  echo "⚠️  Pa jwenn lyen an. Gade: docker logs ludo-lakay-quicktunnel"; return 1
}

case "${1:-}" in
  setup)
    HOST=${2:-}
    if [ -z "$HOST" ]; then echo "Itilizasyon: ./tunnel.sh setup ludo.domen-ou.com"; exit 1; fi
    if [ ! -f .cloudflared/cert.pem ]; then
      echo "🔐 Ouvri lyen ki pral parèt la nan navigatè w, konekte sou Cloudflare, epi chwazi domèn nan."
      cf tunnel login
    fi
    if cf tunnel list -o json 2>/dev/null | grep -q "\"name\":\"$NAME\""; then
      echo "ℹ️  Tinèl '$NAME' deja egziste, n ap itilize l."
    else
      cf tunnel create "$NAME"
    fi
    cf tunnel route dns --overwrite-dns "$NAME" "$HOST"
    T=$(cf tunnel token "$NAME" | tr -d '\r\n ')
    if [ -z "$T" ]; then echo "❌ Pa resevwa token an."; exit 1; fi
    set_token "$T"
    echo "🔑 Token an sere nan .env"
    start_named && { echo; echo "✅ Ludo Lakay sou entènèt:  https://$HOST"; echo "   (DNS la ka pran 1-2 minit pou l mache premye fwa)"; }
    ;;
  status)
    docker ps --filter name=ludo-lakay --format 'table {{.Names}}\t{{.Status}}'
    URL=$(quick_url 2>/dev/null || true); [ -n "$URL" ] && echo "Lyen tinèl rapid: $URL"
    exit 0
    ;;
  stop)
    $DC stop cloudflared quicktunnel
    ;;
  "")
    if [ -n "$(token)" ]; then start_named; else start_quick; fi
    ;;
  *)
    sed -n '2,7p' "$0"; exit 1
    ;;
esac
