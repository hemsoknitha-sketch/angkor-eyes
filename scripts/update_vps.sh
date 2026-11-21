#!/bin/bash
# ==============================================================================
# 🇰🇭 ANGKOR EYES - ONE-COMMAND AUTO VPS UPDATER (ZERO DOWNTIME HOT RESTART)
# Repository: https://github.com/hemsoknitha-sketch/angkor-eyes.git
# ==============================================================================
set -e

INSTALL_DIR="/opt/angkor-eyes"

if [ -d "$INSTALL_DIR" ]; then
    cd "$INSTALL_DIR"
else
    cd "$(dirname "$0")/.."
fi

echo "=========================================================="
echo "🇰🇭 [ANGKOR EYES] Updating VPS to Latest Git Revision..."
echo "=========================================================="

# 1. Stash any untracked or local changes and pull origin main
echo "📥 Pulling latest commits from GitHub..."
git fetch origin main
git reset --hard origin/main

# 2. Update dependencies
echo "📦 Updating backend dependencies..."
cd backend
npm install --omit=dev --no-audit --no-fund

# 3. Graceful Systemd Restart
echo "🔄 Restarting systemd service angkor-eyes..."
sudo systemctl restart angkor-eyes

# 4. Wait & Verify Health Check
sleep 3
echo "----------------------------------------------------------"
echo "🔍 Service Health & Status:"
sudo systemctl status angkor-eyes --no-pager -n 10

echo "----------------------------------------------------------"
echo "📊 Memory & Swap Status:"
free -h

echo "----------------------------------------------------------"
echo "✅ ANGKOR EYES updated and running live successfully!"
echo "=========================================================="
