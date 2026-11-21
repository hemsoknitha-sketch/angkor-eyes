#!/bin/bash
# ==============================================================================
# 🇰🇭 ANGKOR EYES - INSTALL 24/7 AUTO-SYNC BACKGROUND SERVICE ON VPS
# This makes VPS auto-update whenever you push to GitHub, with ZERO manual commands!
# ==============================================================================
set -e

INSTALL_DIR="/opt/angkor-eyes"

echo "=========================================================="
echo "⚡ [ANGKOR EYES] Enabling 24/7 Git Auto-Sync on VPS..."
echo "=========================================================="

sudo chmod +x "$INSTALL_DIR/scripts/auto_sync_vps.sh" "$INSTALL_DIR/scripts/update_vps.sh"

echo "⚙️ Configuring systemd service /etc/systemd/system/angkor-eyes-autoupdate.service..."
cat << EOF | sudo tee /etc/systemd/system/angkor-eyes-autoupdate.service > /dev/null
[Unit]
Description=ANGKOR EYES - 24/7 Auto-Sync Git Watcher & Hot Deployer
After=network.target angkor-eyes.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/angkor-eyes
ExecStart=/bin/bash /opt/angkor-eyes/scripts/auto_sync_vps.sh
Restart=always
RestartSec=10
StandardOutput=append:/var/log/angkor-eyes-autoupdate.log
StandardError=append:/var/log/angkor-eyes-autoupdate.log

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable angkor-eyes-autoupdate
sudo systemctl restart angkor-eyes-autoupdate

echo "✅ 24/7 Auto-Sync is now ACTIVE on your VPS!"
echo "From now on, whenever you push code from Windows, the VPS updates automatically within 60 seconds."
echo "Check logs anytime with: sudo journalctl -u angkor-eyes-autoupdate -f"
echo "=========================================================="
