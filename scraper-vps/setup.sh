#!/bin/bash
# Setup RatoAds Scraper on VPS
set -e

echo "=== Criando diretorio ==="
mkdir -p /opt/ratoads-scraper
cd /opt/ratoads-scraper

echo "=== Criando package.json ==="
cat > package.json << 'PKGEOF'
{
  "name": "ratoads-scraper",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "puppeteer-core": "^23.0.0"
  }
}
PKGEOF

echo "=== Instalando dependencias ==="
npm install --production

echo "=== Configurando PM2 ==="
pm2 delete ratoads-scraper 2>/dev/null || true

cat > ecosystem.config.cjs << 'ECOEOF'
module.exports = {
  apps: [{
    name: 'ratoads-scraper',
    script: 'index.js',
    env: {
      PORT: 3000,
      SCRAPER_SECRET: 'TROCAR_AQUI',
      CHROMIUM_PATH: '/usr/bin/chromium-browser',
      NODE_ENV: 'production',
    },
    max_memory_restart: '2G',
    restart_delay: 5000,
    max_restarts: 10,
  }]
}
ECOEOF

echo "=== Setup completo ==="
echo "Agora falta:"
echo "1. Copiar index.js pra /opt/ratoads-scraper/"
echo "2. Editar SCRAPER_SECRET no ecosystem.config.cjs"
echo "3. pm2 start ecosystem.config.cjs"
echo "4. pm2 save && pm2 startup"
