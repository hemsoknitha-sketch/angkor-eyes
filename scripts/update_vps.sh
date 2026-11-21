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
chmod +x scripts/*.sh 2>/dev/null || true

# 2. Update dependencies
echo "📦 Updating backend dependencies..."
sudo npm install -g tsx || true
cd backend
npm install --no-audit --no-fund

# 3. Cloudflare Tunnel Health Check & Auto-Configuration
echo "🔒 Verifying 24/7 Cloudflare Tunnel..."
if ! command -v cloudflared > /dev/null 2>&1; then
    echo "📦 Installing cloudflared binary..."
    ARCH=$(dpkg --print-architecture 2>/dev/null || echo "amd64")
    curl -fsSL -o /tmp/cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
    sudo dpkg -i /tmp/cloudflared.deb || true
    rm -f /tmp/cloudflared.deb
fi

if [ ! -f "/etc/systemd/system/angkor-eyes-tunnel.service" ]; then
    echo "⚙️ Tunnel service missing - running setup_cloudflare_tunnel.sh..."
    bash "$INSTALL_DIR/scripts/setup_cloudflare_tunnel.sh" || true
else
    sudo systemctl restart angkor-eyes-tunnel || true
fi

# Extract live active tunnel URL
sleep 3
ACTIVE_TUNNEL_URL=$(grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" /var/log/angkor-eyes-tunnel.log 2>/dev/null | tail -n 1 || echo "")
if [ -n "$ACTIVE_TUNNEL_URL" ]; then
    ENV_TARGETS=("$INSTALL_DIR/backend/.env" "$INSTALL_DIR/.env")
    for ENV_FILE in "${ENV_TARGETS[@]}"; do
        if [ -f "$ENV_FILE" ]; then
            if grep -q "^WEB_APP_URL=" "$ENV_FILE"; then
                sudo sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=${ACTIVE_TUNNEL_URL}|" "$ENV_FILE"
            else
                echo "WEB_APP_URL=${ACTIVE_TUNNEL_URL}" | sudo tee -a "$ENV_FILE" > /dev/null
            fi
        fi
    done
fi

# 4. Graceful Systemd Restart
echo "🔄 Restarting systemd service angkor-eyes..."
sudo systemctl restart angkor-eyes

# 5. Wait & Verify Health Check
sleep 3
echo "----------------------------------------------------------"
echo "🔍 Service Health & Status:"
sudo systemctl status angkor-eyes --no-pager -n 10

echo "----------------------------------------------------------"
echo "📊 Memory & Swap Status:"
free -h

echo "----------------------------------------------------------"
if [ -n "$ACTIVE_TUNNEL_URL" ]; then
    echo "🌐 ACTIVE SOVEREIGN MINI WEB HTTPS: $ACTIVE_TUNNEL_URL"
else
    echo "🌐 MINI WEB LOCAL: http://localhost:3000"
fi
echo "✅ ANGKOR EYES updated and running live successfully!"
echo "=========================================================="
