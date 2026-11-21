#!/bin/bash
# ==============================================================================
# 🇰🇭 ANGKOR EYES - PERMANENT 24/7 CLOUDFLARE HTTPS TUNNEL (BACKGROUND SERVICE)
# Ensures the tunnel stays alive 24/7 even after you close SSH terminal!
# ==============================================================================
set -e

INSTALL_DIR="/opt/angkor-eyes"

echo "=========================================================="
echo "⚡ [ANGKOR EYES] Starting 24/7 Background Cloudflare Tunnel..."
echo "=========================================================="

# 1. Terminate any previous manual cloudflared processes
sudo pkill -9 -f cloudflared || true
sleep 1

# 2. Check & install cloudflared if missing
if ! command -v cloudflared > /dev/null 2>&1; then
    echo "📦 Downloading and installing cloudflared..."
    ARCH=$(dpkg --print-architecture || echo "amd64")
    curl -fsSL -o /tmp/cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
    sudo dpkg -i /tmp/cloudflared.deb
    rm -f /tmp/cloudflared.deb
fi

BIN=$(which cloudflared || echo "/usr/local/bin/cloudflared")
if [ ! -x "$BIN" ] && [ -x "/usr/bin/cloudflared" ]; then
    BIN="/usr/bin/cloudflared"
fi

echo "✅ Cloudflared binary verified: $BIN"

# 3. Clean previous log so we get the fresh active tunnel URL
sudo rm -f /var/log/angkor-eyes-tunnel.log

# 4. Configure systemd unit with IPv4 127.0.0.1:3000 to prevent IPv6 drops
cat << EOF | sudo tee /etc/systemd/system/angkor-eyes-tunnel.service > /dev/null
[Unit]
Description=ANGKOR EYES - 24/7 Cloudflare Quick HTTPS Tunnel
After=network.target angkor-eyes.service

[Service]
Type=simple
User=root
ExecStart=$BIN tunnel --no-autoupdate --url http://127.0.0.1:3000
Restart=always
RestartSec=3
StandardOutput=append:/var/log/angkor-eyes-tunnel.log
StandardError=append:/var/log/angkor-eyes-tunnel.log

[Install]
WantedBy=multi-user.target
EOF

# 5. Reload and start systemd service
sudo systemctl daemon-reload
sudo systemctl enable angkor-eyes-tunnel
sudo systemctl restart angkor-eyes-tunnel

echo "⏳ Establishing Cloudflare edge connection (waiting 8s)..."
sleep 8

# 6. Extract live active URL
TUNNEL_URL=""
for i in {1..10}; do
    TUNNEL_URL=$(grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" /var/log/angkor-eyes-tunnel.log 2>/dev/null | tail -n 1 || echo "")
    if [ -n "$TUNNEL_URL" ]; then
        break
    fi
    sleep 2
done

echo "=========================================================="
if [ -n "$TUNNEL_URL" ]; then
    echo "🎉 LIVE HTTPS TUNNEL ESTABLISHED SUCCESSFULLY!"
    echo ""
    echo "🔗 YOUR ACTIVE LIVE URL:"
    echo "   $TUNNEL_URL"
    echo ""

    # Test edge response
    echo "🔍 Probing Cloudflare edge connection..."
    sleep 3
    HTTP_CODE=$(curl -s -k -o /dev/null -w "%{http_code}" "$TUNNEL_URL" || echo "000")
    echo "   HTTP Edge Status: $HTTP_CODE"

    # Sync URL to .env
    for ENV_PATH in "$INSTALL_DIR/backend/.env" "$INSTALL_DIR/.env"; do
        if [ -f "$ENV_PATH" ]; then
            if grep -q "^WEB_APP_URL=" "$ENV_PATH"; then
                sudo sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=${TUNNEL_URL}|" "$ENV_PATH"
            else
                echo "WEB_APP_URL=${TUNNEL_URL}" | sudo tee -a "$ENV_PATH" > /dev/null
            fi
            echo "✅ Synced WEB_APP_URL to $(basename $ENV_PATH)"
        fi
    done

    # Restart angkor-eyes so bot gets updated URL
    sudo systemctl restart angkor-eyes || true

    echo "=========================================================="
    echo "✅ Service is running 24/7 in background. You can safely close SSH!"
    echo ""
    echo "👉 IMPORTANT (Next Step in Telegram):"
    echo "   1. Open @BotFather in Telegram"
    echo "   2. Send: /mybots -> choose your bot"
    echo "   3. Bot Settings -> Menu Button -> Configure menu button"
    echo "   4. Paste this exact URL: $TUNNEL_URL"
    echo "=========================================================="
else
    echo "❌ Tunnel URL not found yet. Current log:"
    tail -n 25 /var/log/angkor-eyes-tunnel.log || true
fi
