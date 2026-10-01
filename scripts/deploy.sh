#!/usr/bin/env bash
# Faz o build local e publica na VPS (PM2 + nginx já configurados).
# Uso: bash scripts/deploy.sh
set -euo pipefail

HOST="${DEPLOY_HOST:-root@vps.caiocinel.com}"
BASE="/opt/velas-luamme"
RELEASE="$(date +%Y%m%d%H%M%S)"

cd "$(dirname "$0")/.."

echo "==> Build"
rm -rf .next
npx next build

echo "==> Montando pacote standalone"
OUT=.next/standalone
cp -r .next/static "$OUT/.next/static"
cp -r public "$OUT/public"
mkdir -p "$OUT/db/migrations" "$OUT/scripts"
# migrate.mjs aplica db/migrations/NNN_*.sql em ordem (schema.sql fica só como fallback).
cp db/schema.sql "$OUT/db/"
cp db/migrations/*.sql "$OUT/db/migrations/"
cp scripts/migrate.mjs "$OUT/scripts/"
cp ecosystem.config.cjs "$OUT/"
# Binários nativos do sharp do Windows não servem no Linux (e o app não usa next/image).
rm -rf "$OUT/node_modules/@img" "$OUT/node_modules/sharp"
# O Turbopack cria links com hash (ex.: .next/node_modules/pg-<hash>) apontando para o
# caminho absoluto da máquina de build; troca por links relativos ao node_modules do pacote.
if [ -d "$OUT/.next/node_modules" ]; then
  for link in "$OUT"/.next/node_modules/*; do
    [ -L "$link" ] || continue
    pkg="$(basename "$(readlink "$link")")"
    [ -d "$OUT/node_modules/$pkg" ] || { echo "Pacote $pkg ausente no standalone" >&2; exit 1; }
    rm "$link"
    ln -s "../../node_modules/$pkg" "$link"
  done
fi
# Nunca publicar arquivos .env locais.
find "$OUT" -maxdepth 1 -name ".env*" -delete

echo "==> Enviando release $RELEASE"
tar -C "$OUT" -czf - . | ssh "$HOST" "mkdir -p $BASE/releases/$RELEASE && tar -xzf - -C $BASE/releases/$RELEASE"

echo "==> Ativando release"
ssh "$HOST" bash -se <<EOF
set -euo pipefail
source ~/.nvm/nvm.sh >/dev/null
cd $BASE/releases/$RELEASE
node --env-file=$BASE/.env scripts/migrate.mjs
ln -sfn $BASE/releases/$RELEASE $BASE/current
pm2 startOrReload $BASE/current/ecosystem.config.cjs --update-env
pm2 save
# Mantém só as 3 releases mais recentes.
ls -1dt $BASE/releases/* | tail -n +4 | xargs -r rm -rf
EOF

echo "==> Pronto: release $RELEASE ativa"
