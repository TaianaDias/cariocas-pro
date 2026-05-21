#!/bin/bash
# Script de deploy automatizado do Carioca's Pro.
# Uso: ./scripts/deploy.sh

set -e

APP_DIR="${APP_DIR:-/var/www/cariocas-pro}"
APP_NAME="${APP_NAME:-cariocas-pro}"

echo "=== Deploy Carioca's Pro: $(date) ==="

cd "${APP_DIR}"

echo "Pull do git..."
git pull origin main

echo "Instalando dependencias..."
npm install

echo "Buildando..."
npm run build

if [ -f "package.json" ] && grep -q '"test"' package.json; then
  echo "Rodando testes..."
  npm test
fi

echo "Restartando PM2..."
pm2 restart "${APP_NAME}"

echo "Health check..."
sleep 5
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)

if [ "${HEALTH}" = "200" ]; then
  echo "Deploy concluido com sucesso. HTTP ${HEALTH}"
else
  echo "Health check retornou HTTP ${HEALTH}. Verifique os logs."
  pm2 logs "${APP_NAME}" --lines 20
fi

echo "=== Deploy finalizado: $(date) ==="

