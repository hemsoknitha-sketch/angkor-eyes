#!/bin/bash
# ==============================================================================
# 🇰🇭 ANGKOR EYES - 2GB SWAP SETUP FOR GOOGLE CLOUD VPS FREE TIER (1GB RAM)
# Target: e2-micro (us-central1-a, quant-gold-514007)
# ==============================================================================
set -e

echo "=========================================================="
echo "🇰🇭 [ANGKOR EYES] Initializing 2GB Swap Memory..."
echo "=========================================================="

if [ -f /swapfile ]; then
    echo "ℹ️  /swapfile already exists. Verifying current swap..."
    sudo swapon --show
else
    echo "⚙️  Allocating 2GB swap space via fallocate..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile

    if ! grep -q '/swapfile none swap sw 0 0' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
        echo "✅ Added /swapfile to /etc/fstab for persistence across reboots."
    fi
    echo "✅ 2GB Swapfile created and activated successfully!"
fi

# Optimize Swappiness to 20 for minimal disk I/O on e2-micro
sudo sysctl vm.swappiness=20
echo "vm.swappiness = 20" | sudo tee /etc/sysctl.d/99-angkor-eyes-swap.conf > /dev/null

echo "----------------------------------------------------------"
echo "📊 Current System Memory & Swap Allocation:"
free -h
echo "=========================================================="
