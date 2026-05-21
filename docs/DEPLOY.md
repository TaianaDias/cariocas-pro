# Guia de Deploy - Carioca's Pro em VPS Linux

## Pre-requisitos

- VPS Linux Ubuntu 22.04 ou superior.
- Node.js 20 LTS.
- Docker e Docker Compose.
- Nginx.
- PM2 ou systemd.
- Dominio apontado para a VPS.
- SSL com Let's Encrypt.
- Projeto Firebase com Firestore e Auth.
- Conta de servico Firebase Admin para rotinas server-side.

## 1. Acessar a VPS

```bash
ssh usuario@ip-da-vps
```

## 2. Instalar dependencias do servidor

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx docker.io docker-compose
sudo npm install -g pm2
sudo apt-get install -y certbot python3-certbot-nginx

node --version
npm --version
docker --version
```

## 3. Clonar o projeto

```bash
cd /var/www
git clone https://github.com/seu-usuario/cariocas-pro.git
cd cariocas-pro
```

## 4. Configurar variaveis de ambiente

```bash
cp .env.production.example .env.local
nano .env.local
```

Preencha todos os campos do Firebase, Evolution API e WhatsApp admin.

## 5. Build da aplicacao

```bash
npm install
npm run build
```

## 6. Configurar Nginx

Crie o arquivo:

```bash
sudo nano /etc/nginx/sites-available/cariocaspro
```

Conteudo:

```nginx
server {
    listen 80;
    server_name cariocaspro.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ative:

```bash
sudo ln -s /etc/nginx/sites-available/cariocaspro /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 7. SSL

```bash
sudo certbot --nginx -d cariocaspro.seudominio.com
```

## 8. Subir a aplicacao com PM2

```bash
pm2 start npm --name "cariocas-pro" -- start
pm2 save
pm2 startup
```

## 9. Subir Evolution API

```bash
cd docker
docker compose up -d
docker compose ps
cd ..
```

Verifique:

```bash
curl http://localhost:8080
```

## 10. Health check

```bash
curl https://cariocaspro.seudominio.com/api/health
```

Resposta esperada:

```json
{ "status": "ok" }
```

## Tarefas Pos-Deploy

### Backup automatico do Firestore

Agende no crontab:

```cron
0 3 * * * /var/www/cariocas-pro/scripts/backup-firestore.sh >> /var/log/firestore-backup.log 2>&1
```

### Monitoramento basico

```bash
pm2 logs cariocas-pro
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
cd /var/www/cariocas-pro/docker && docker compose logs -f
```

### Atualizar aplicacao

```bash
cd /var/www/cariocas-pro
git pull
npm install
npm run build
pm2 restart cariocas-pro
```

## Checklist Pos-Deploy

- VPS com Node.js 20 LTS.
- Docker e Docker Compose instalados.
- Nginx configurado como reverse proxy.
- SSL ativo.
- Dominio apontado para a VPS.
- `npm run build` passando.
- PM2 rodando a aplicacao.
- `/api/health` respondendo 200.
- `.env.local` preenchido.
- Evolution API online na porta 8080.
- QR Code do WhatsApp conectado.
- Webhook recebendo mensagens.
- Firestore com regras e indices configurados.
- Backup automatico agendado.

