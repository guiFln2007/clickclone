#!/bin/bash
set -e

echo "==> Installing dependencies..."
npm install

echo "==> Building Next.js..."
npm run build

echo "==> Starting with PM2..."
pm2 start ecosystem.config.js --update-env
pm2 save

echo "==> Deploy complete!"
