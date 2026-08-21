#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/cariocas-pro}"
APP_URL="${APP_URL:-http://143.95.212.87}"
EVOLUTION_LOCAL_URL="${EVOLUTION_LOCAL_URL:-http://127.0.0.1:8080}"
INSTANCE="${EVOLUTION_INSTANCE:-cariocas-pro}"
BACKUP_DIR="/root/cariocas-whatsapp-backups/$(date +%Y%m%d-%H%M%S)"

cd "$APP_DIR"

echo "== Carioca's Pro WhatsApp audit/repair =="
echo "App dir: $APP_DIR"
echo "App URL: $APP_URL"
echo "Evolution local URL: $EVOLUTION_LOCAL_URL"
echo "Instance: $INSTANCE"
echo

upsert_env() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    printf "\n%s=%s\n" "$key" "$value" >> .env
  fi
}

mkdir -p "$BACKUP_DIR"
cp .env "$BACKUP_DIR/.env.backup"

echo "== Ajustando .env do app =="
upsert_env "EVOLUTION_INTERNAL_API_URL" "$EVOLUTION_LOCAL_URL"
upsert_env "EVOLUTION_API_URL" "$EVOLUTION_LOCAL_URL"
upsert_env "WHATSAPP_WEBHOOK_BASE_URL" "$APP_URL"
upsert_env "EVOLUTION_INSTANCE" "$INSTANCE"
echo ".env salvo com backup em $BACKUP_DIR/.env.backup"
echo

echo "== Aplicando Docker Compose da Evolution =="
if [ -f "$APP_DIR/docker/docker-compose.yml" ]; then
  if docker compose version >/dev/null 2>&1; then
    (cd "$APP_DIR/docker" && docker compose up -d) || {
      echo "Docker Compose plugin falhou; recriando somente evolution-api."
      docker rm -f evolution-api || true
      (cd "$APP_DIR/docker" && docker compose up -d evolution-api)
    }
  elif command -v docker-compose >/dev/null 2>&1; then
    (cd "$APP_DIR/docker" && docker-compose up -d) || {
      echo "docker-compose legado falhou; isso costuma ocorrer por KeyError ContainerConfig."
      echo "Recriando somente o container evolution-api sem apagar dados do Postgres."
      docker rm -f evolution-api || true
      LEGACY_CONTAINER="$(docker ps -aq --filter name=evolution-api | head -n 1)"
      if [ -n "${LEGACY_CONTAINER:-}" ]; then
        docker rm -f "$LEGACY_CONTAINER" || true
      fi
      (cd "$APP_DIR/docker" && docker-compose up -d evolution-api)
    }
  else
    echo "Docker Compose nao encontrado; seguindo com containers existentes."
  fi
  sleep 20
fi
echo

echo "== Containers =="
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | sed -n '1,12p'
echo

KEY="$(docker inspect evolution-api --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '/^AUTHENTICATION_API_KEY=/{print $2}')"
if [ -z "${KEY:-}" ]; then
  echo "ERRO: nao encontrei AUTHENTICATION_API_KEY no container evolution-api."
  exit 1
fi

echo "== Testando Evolution local =="
curl -fsS --max-time 8 -H "apikey: $KEY" "$EVOLUTION_LOCAL_URL/instance/fetchInstances" || true
echo
echo

echo "== Testando webhook do app =="
curl -fsS --max-time 8 "$APP_URL/api/whatsapp/webhook" || true
echo
echo

echo "== Backup da sessao Evolution =="
if [ -d "$APP_DIR/docker/evolution-instances" ]; then
  cp -a "$APP_DIR/docker/evolution-instances" "$BACKUP_DIR/evolution-instances"
  find "$APP_DIR/docker/evolution-instances" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  echo "Sessao local movida para backup: $BACKUP_DIR/evolution-instances"
else
  echo "Pasta docker/evolution-instances nao encontrada; seguindo somente com reset via API."
fi
echo

echo "== Limpando instancia antiga via Evolution API =="
curl -sS --max-time 8 -X DELETE -H "apikey: $KEY" "$EVOLUTION_LOCAL_URL/instance/logout/$INSTANCE" || true
echo
curl -sS --max-time 8 -X DELETE -H "apikey: $KEY" "$EVOLUTION_LOCAL_URL/instance/delete/$INSTANCE" || true
echo
echo

echo "== Reiniciando Evolution =="
docker restart evolution-api
sleep 20
echo

echo "== Publicando app com ambiente corrigido =="
npm run build
pm2 restart cariocas-pro --update-env
echo

echo "== Status final do app =="
curl -fsS --max-time 8 "http://127.0.0.1:3000/api/whatsapp/status" || true
echo
echo

echo "== Diagnostico final WhatsApp =="
curl -fsS --max-time 8 "http://127.0.0.1:3000/api/whatsapp/diagnostico" || true
echo
echo

echo "Pronto. Abra $APP_URL/configuracoes/carioquinha e clique em Conectar WhatsApp para gerar um QR novo."
echo "Se quiser diagnosticar depois de enviar 'oi', rode:"
echo "pm2 logs cariocas-pro --lines 120 --nostream"
echo "docker logs evolution-api --tail 120"
