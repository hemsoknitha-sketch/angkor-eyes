#!/bin/bash
set -e
cd /opt/angkor-eyes
git fetch origin main
git reset --hard origin/main
chmod +x scripts/*.sh 2>/dev/null || true
find node_modules -maxdepth 1 -name ".*" -type d -exec rm -rf {} + 2>/dev/null || true
NODE_OPTIONS="--max-old-space-size=768" npm install --no-audit --no-fund
NODE_OPTIONS="--max-old-space-size=768" npm run build
sudo systemctl daemon-reload
sudo systemctl restart angkor-eyes
sleep 3
curl -s http://localhost:3000/health && echo ""
sudo systemctl status angkor-eyes --no-pager -n 8
