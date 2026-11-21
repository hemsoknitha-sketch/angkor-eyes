#!/usr/bin/env bash
# ANGKOR EYES — install.sh
# Checks prerequisites, installs workspace dependencies, and starts the
# stack with docker compose. Safe to re-run.
# Usage: ./scripts/install.sh [--no-up] [--with-runner]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NO_UP=false
WITH_RUNNER=false
for arg in "$@"; do
  case "$arg" in
    --no-up) NO_UP=true ;;
    --with-runner) WITH_RUNNER=true ;;
    *) echo "Unknown option: $arg" >&2; echo "Usage: $0 [--no-up] [--with-runner]" >&2; exit 1 ;;
  esac
done

fail() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }

# --- 1. Prerequisite checks -------------------------------------------------
info "Checking prerequisites…"
command -v node >/dev/null 2>&1 || fail "Node.js is not installed (need 20+). See https://nodejs.org/"
command -v npm >/dev/null 2>&1 || fail "npm is not installed."
command -v git >/dev/null 2>&1 || fail "git is not installed."
command -v docker >/dev/null 2>&1 || fail "Docker is not installed. See https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is not available (need 'docker compose')."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || fail "Node.js 20+ is required (found $(node -v))."
info "Node $(node -v), npm $(npm -v), git $(git --version | awk '{print $3}'), docker $(docker --version | awk '{print $3}')"

# --- 2. Env file -------------------------------------------------------------
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    info "Created .env from .env.example — EDIT IT before going further:"
    info "  TELEGRAM_BOT_TOKEN, ALLOWED_TELEGRAM_IDS, and one LLM key are required."
  else
    fail ".env.example is missing; cannot create .env."
  fi
else
  info ".env already exists."
fi

# Warn (don't fail) on missing required values so first-time setup is visible.
missing=()
grep -q '^TELEGRAM_BOT_TOKEN=.\+' .env 2>/dev/null || missing+=("TELEGRAM_BOT_TOKEN")
grep -q '^ALLOWED_TELEGRAM_IDS=.\+' .env 2>/dev/null || missing+=("ALLOWED_TELEGRAM_IDS")
if [ "${#missing[@]}" -gt 0 ]; then
  echo "WARNING: these are empty in .env and the bot will not work until set: ${missing[*]}" >&2
fi

# --- 3. Install workspace dependencies ---------------------------------------
info "Installing dependencies…"
for dir in backend bot frontend runner tests; do
  if [ -f "$dir/package.json" ]; then
    info "  npm install -- $dir"
    (cd "$dir" && npm install --no-audit --no-fund)
  else
    info "  (skip $dir — no package.json yet; that builder has not landed)"
  fi
done

# --- 4. Start the stack -------------------------------------------------------
if [ "$NO_UP" = true ]; then
  info "Skipping docker compose up (--no-up). Run 'docker compose up -d --build' when ready."
  exit 0
fi

info "Starting the stack (docker compose up -d --build)…"
if [ "$WITH_RUNNER" = true ]; then
  docker compose --profile runner up -d --build
else
  docker compose up -d --build
fi

info "Waiting for services to become healthy…"
sleep 5
docker compose ps

info "Done. Logs: docker compose logs -f backend bot"
info "Talk to your bot in Telegram, then open Mini Web from its menu."
