#!/bin/bash
# ==============================================================================
# 🇰🇭 ANGKOR EYES - 24/7 365 REAL-TIME GIT AUTO-DEPLOY WATCHER FOR VPS
# Automatically checks GitHub for new commits every 60 seconds.
# When a new commit is detected on GitHub, it automatically pulls and restarts!
# ==============================================================================

INSTALL_DIR="/opt/angkor-eyes"

if [ -d "$INSTALL_DIR" ]; then
    cd "$INSTALL_DIR"
else
    cd "$(dirname "$0")/.."
fi

echo "=========================================================="
echo "⚡ [Auto-Sync Watcher] Initialized."
echo "Monitoring https://github.com/hemsoknitha-sketch/angkor-eyes.git every 60s..."
echo "=========================================================="

while true; do
    git fetch origin main --quiet 2>/dev/null || true
    LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "")
    REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "")

    if [ -n "$REMOTE" ] && [ -n "$LOCAL" ] && [ "$LOCAL" != "$REMOTE" ]; then
        echo ""
        echo "🚨 [Auto-Sync Watcher] New commits detected on GitHub!"
        echo "   Local commit:  $LOCAL"
        echo "   Remote commit: $REMOTE"
        echo "🔄 Auto-deploying latest ANGKOR EYES release..."
        
        bash "$INSTALL_DIR/scripts/update_vps.sh" || true
        
        echo "✅ [Auto-Sync Watcher] Hot deployment complete at $(date)."
        echo "----------------------------------------------------------"
    fi

    sleep 60
done
