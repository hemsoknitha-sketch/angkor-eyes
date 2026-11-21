#!/bin/bash
# ==============================================================================
# 🇰🇭 ANGKOR EYES - FREE CLOUDFLARE SECURE HTTPS TUNNEL SETUP (24/7 365 FREE)
# Purpose: Gives Angkor Eyes Web GUI / Mini App an instant, free, trusted HTTPS
#          URL without needing a paid domain, open firewall ports, or static IP.
# ==============================================================================
set -e

INSTALL_DIR="/opt/angkor-eyes"

echo "=========================================================="
echo "⚡ [ANGKOR EYES] Setting up Cloudflare Free HTTPS Tunnel..."
echo "=========================================================="

# 1. Terminate any previous manual cloudflared processes
sudo pkill -9 -f cloudflared || true
sleep 1

# 2. Download & Install cloudflared if missing
if ! command -v cloudflared > /dev/null 2>&1; then
    echo "📦 Downloading Cloudflare tunnel binary (cloudflared)..."
    ARCH=$(dpkg --print-architecture || echo "amd64")
    curl -fsSL -o /tmp/cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
    sudo dpkg -i /tmp/cloudflared.deb
    rm -f /tmp/cloudflared.deb
fi

BIN=$(which cloudflared || echo "/usr/local/bin/cloudflared")
if [ ! -x "$BIN" ] && [ -x "/usr/bin/cloudflared" ]; then
    BIN="/usr/bin/cloudflared"
fi

echo "✅ cloudflared binary verified: $BIN"

# 3. Clean old log file
sudo rm -f /var/log/angkor-eyes-tunnel.log

# 4. Configure 24/7 Systemd Service for Cloudflare Tunnel
echo "⚙️ Configuring systemd service /etc/systemd/system/angkor-eyes-tunnel.service..."
cat << EOF | sudo tee /etc/systemd/system/angkor-eyes-tunnel.service > /dev/null
[Unit]
Description=ANGKOR EYES - Cloudflare Quick HTTPS Tunnel
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

# 5. Reload & Start Tunnel Service
sudo systemctl daemon-reload
sudo systemctl enable angkor-eyes-tunnel
sudo systemctl restart angkor-eyes-tunnel

echo "⏳ Waiting for Cloudflare edge connection to establish..."
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

# 7. Extract and display public HTTPS URL & sync into .env
echo "=========================================================="
if [ -n "$TUNNEL_URL" ]; then
    echo "🎉 FREE HTTPS TUNNEL IS LIVE 24/7 365!"
    echo ""
    echo "🔗 PUBLIC MINI APP HTTPS URL:"
    echo "   $TUNNEL_URL"
    echo ""

    # Automatically persist WEB_APP_URL into backend/.env and .env
    ENV_TARGETS=("$INSTALL_DIR/backend/.env" "$INSTALL_DIR/.env")
    for ENV_FILE in "${ENV_TARGETS[@]}"; do
        if [ -f "$ENV_FILE" ]; then
            if grep -q "^WEB_APP_URL=" "$ENV_FILE"; then
                sudo sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=${TUNNEL_URL}|" "$ENV_FILE"
            else
                echo "WEB_APP_URL=${TUNNEL_URL}" | sudo tee -a "$ENV_FILE" > /dev/null
            fi
            echo "✅ Synced WEB_APP_URL to $(basename $ENV_FILE)"
        fi
    done

    # Restart angkor-eyes so Telegram Bot picks up the live tunnel URL
    echo "🔄 Reloading ANGKOR EYES service with live WebApp URL..."
    sudo systemctl restart angkor-eyes || true

    echo "----------------------------------------------------------"
    echo "👉 Set this in Telegram @BotFather (Takes only 30 seconds):"
    echo "   1. Send /mybots to @BotFather in Telegram"
    echo "   2. Choose your Angkor Eyes bot"
    echo "   3. Bot Settings -> Menu Button -> Configure menu button"
    echo "   4. Paste: $TUNNEL_URL"
    echo "=========================================================="
else
    echo "⚠️ Tunnel service started. Reading logs..."
    tail -n 20 /var/log/angkor-eyes-tunnel.log || true
fi
