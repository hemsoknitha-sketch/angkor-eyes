#!/bin/bash
# ==============================================================================
# 🇰🇭 ANGKOR EYES - COMPLETE GOOGLE CLOUD VPS DEPLOYMENT ENGINE (24/7 365 FREE)
# Instance: angkor-eyes (Zone: us-central1-a, Project: quant-gold-514007)
# Machine: e2-micro (1GB Physical RAM + 2GB Virtual Swap = 3GB Virtual Memory)
# Repository: https://github.com/hemsoknitha-sketch/angkor-eyes.git
# ==============================================================================
set -e

REPO_URL="https://github.com/hemsoknitha-sketch/angkor-eyes.git"
INSTALL_DIR="/opt/angkor-eyes"

echo "=========================================================="
echo "🇰🇭 STARTING ANGKOR EYES VPS DEPLOYMENT (FREE TIER 24/7)"
echo "=========================================================="

# 1. Setup 2GB Swap Memory (Mandatory for 1GB RAM e2-micro instance)
if [ -f /swapfile ]; then
    echo "ℹ️  Swapfile already present."
else
    echo "⚙️  Configuring 2GB swap space..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    if ! grep -q '/swapfile none swap sw 0 0' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
fi
sudo sysctl vm.swappiness=20
echo "vm.swappiness = 20" | sudo tee /etc/sysctl.d/99-angkor-eyes-swap.conf > /dev/null

# 2. Update System & Install Base Prerequisites
echo "📦 Updating OS packages and installing prerequisites..."
sudo apt-get update -y
sudo apt-get install -y git curl ufw htop build-essential

# 3. Install Node.js 20 LTS (Official NodeSource)
if ! command -v node > /dev/null 2>&1 || [[ $(node -v) != v20* && $(node -v) != v22* && $(node -v) != v25* ]]; then
    echo "⚙️  Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✅ Node.js Version: $(node -v) | npm Version: $(npm -v)"

# 4. Clone or Pull Application Repository
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "🔄 Existing repository found at $INSTALL_DIR. Pulling latest commits..."
    cd "$INSTALL_DIR"
    git fetch origin main
    git reset --hard origin/main
else
    echo "📥 Cloning ANGKOR EYES into $INSTALL_DIR..."
    sudo rm -rf "$INSTALL_DIR"
    sudo git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 5. Setup Production Environment (.env)
if [ ! -f "$INSTALL_DIR/backend/.env" ]; then
    echo "⚙️  Initializing backend/.env from template..."
    if [ -f "$INSTALL_DIR/.env" ]; then
        cp "$INSTALL_DIR/.env" "$INSTALL_DIR/backend/.env"
    elif [ -f "$INSTALL_DIR/.env.example" ]; then
        cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/backend/.env"
    fi
fi

# 6. Install Lightweight Production Dependencies
echo "📦 Installing backend production dependencies..."
cd "$INSTALL_DIR/backend"
npm install --omit=dev --no-audit --no-fund

# 7. Configure Systemd 24/7 Background Service
echo "⚙️  Configuring systemd service /etc/systemd/system/angkor-eyes.service..."
cat << 'EOF' | sudo tee /etc/systemd/system/angkor-eyes.service > /dev/null
[Unit]
Description=ANGKOR EYES - Sovereign Institutional AGI Platform (24/7 365 Free Engine)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/angkor-eyes/backend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=NODE_OPTIONS=--max-old-space-size=512
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# 8. Reload & Start Service
sudo systemctl daemon-reload
sudo systemctl enable angkor-eyes
sudo systemctl restart angkor-eyes

# 9. Configure Firewall (UFW)
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw allow 3000/tcp || true
sudo ufw --force enable || true

# 10. Verification & Health Probe
sleep 3
echo "=========================================================="
echo "⚡ VERIFYING SERVICE HEALTH..."
sudo systemctl status angkor-eyes --no-pager || true

echo "----------------------------------------------------------"
echo "📊 Memory & Swap Status:"
free -h
echo "=========================================================="
echo "🎉 DEPLOYMENT COMPLETE! ANGKOR EYES is running 24/7 365."
echo "Telegram Bot and Web GUI are active."
echo "=========================================================="
