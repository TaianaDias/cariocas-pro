#!/bin/bash
# Script de backup automatico do Firestore.
# Uso: ./scripts/backup-firestore.sh

set -e

echo "=== Firestore Backup: $(date) ==="

PROJECT_ID="${FIREBASE_PROJECT_ID:-seu-projeto-id}"
BUCKET_NAME="${FIRESTORE_BACKUP_BUCKET:-gs://seu-bucket-backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BUCKET_NAME}/backups/${TIMESTAMP}"

echo "Exportando Firestore para ${BACKUP_PATH}..."

gcloud firestore export "${BACKUP_PATH}" \
  --project="${PROJECT_ID}" \
  --async

echo "Backup iniciado em: ${BACKUP_PATH}"
echo "Para verificar: gcloud firestore operations list --project=${PROJECT_ID}"
echo "=== Backup concluido: $(date) ==="

