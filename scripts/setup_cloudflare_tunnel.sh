#!/bin/bash
# ==============================================================================
# 🇰🇭 ANGKOR EYES - FREE CLOUDFLARE SECURE HTTPS TUNNEL SETUP (24/7 365 FREE)
# Purpose: Gives Angkor Eyes Web GUI / Mini App an instant, free, trusted HTTPS
#          URL without needing a paid domain, open firewall ports, or static IP.
# ==============================================================================
set -e

echo "=========================================================="
echo "⚡ [ANGKOR EYES] Setting up Cloudflare Free HTTPS Tunnel..."
echo "=========================================================="

# 1. Download & Install cloudflared if missing
if ! command -v cloudflared > /dev/null 2>&1; then
    echo "📦 Downloading Cloudflare tunnel binary (cloudflared)..."
    ARCH=$(dpkg --print-architecture || echo "amd64")
    curl -fsSL -o /tmp/cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
    sudo dpkg -i /tmp/cloudflared.deb
    rm -f /tmp/cloudflared.deb
    echo "✅ cloudflared installed successfully: $(cloudflared --version)"
else
    echo "✅ cloudflared is already installed: $(cloudflared --version)"
fi

# 2. Configure 24/7 Systemd Service for Cloudflare Tunnel
echo "⚙️ Configuring systemd service /etc/systemd/system/angkor-eyes-tunnel.service..."
cat << EOF | sudo tee /etc/systemd/system/angkor-eyes-tunnel.service > /dev/null
[Unit]
Description=ANGKOR EYES - Cloudflare Quick HTTPS Tunnel
After=network.target angkor-eyes.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate --url http://localhost:3000
Restart=always
RestartSec=5
StandardOutput=append:/var/log/angkor-eyes-tunnel.log
StandardError=append:/var/log/angkor-eyes-tunnel.log

[Install]
WantedBy=multi-user.target
EOF

# 3. Reload & Start Tunnel Service
sudo systemctl daemon-reload
sudo systemctl enable angkor-eyes-tunnel
sudo systemctl restart angkor-eyes-tunnel

echo "⏳ Waiting for Cloudflare edge connection to establish..."
sleep 6

# 4. Extract and display public HTTPS URL
TUNNEL_URL=$(grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" /var/log/angkor-eyes-tunnel.log | tail -n 1 || echo "")

echo "=========================================================="
if [ -n "$TUNNEL_URL" ]; then
    echo "🎉 FREE HTTPS TUNNEL IS LIVE 24/7 365!"
    echo ""
    echo "🔗 PUBLIC MINI APP HTTPS URL:"
    echo "   $TUNNEL_URL"
    echo ""
    echo "👉 Set this in Telegram @BotFather:"
    echo "   1. Send /mybots to @BotFather"
    echo "   2. Choose your Angkor Eyes bot"
    echo "   3. Bot Settings -> Menu Button -> Configure menu button"
    echo "   4. Paste: $TUNNEL_URL"
    echo "=========================================================="
else
    echo "⚠️ Tunnel service started. Reading logs..."
    tail -n 15 /var/log/angkor-eyes-tunnel.log
    echo ""
    echo "Run: grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /var/log/angkor-eyes-tunnel.log | tail -n 1"
fi
