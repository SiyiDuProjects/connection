#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd -P)
missing=0

ok() {
  printf 'ok    %s\n' "$1"
}

warn() {
  printf 'warn  %s\n' "$1"
  missing=1
}

check_command() {
  name=$1
  install_hint=$2

  if command -v "$name" >/dev/null 2>&1; then
    version=$("$name" --version 2>/dev/null || true)
    ok "$name ${version}"
  else
    warn "$name is not on PATH. $install_hint"
  fi
}

echo "Checking local Reachard development prerequisites..."
echo

check_command node "On macOS, install Node.js with Homebrew: brew install node"
check_command npm "npm usually ships with Homebrew or nodejs.org Node.js."
check_command corepack "corepack usually ships with modern Node.js; enable it with: corepack enable"

if command -v pnpm >/dev/null 2>&1; then
  ok "pnpm $(pnpm --version)"
elif command -v corepack >/dev/null 2>&1; then
  ok "pnpm can be run through corepack: corepack pnpm --version"
else
  warn "pnpm is not on PATH. Install Node.js with corepack, then run: corepack enable"
fi

echo

if [ -f "$repo_root/web/.env" ]; then
  ok "web/.env exists"
else
  warn "web/.env is missing. Create it with: cp web/.env.example web/.env"
fi

if [ -f "$repo_root/server/.env" ]; then
  ok "server/.env exists"
else
  warn "server/.env is missing. Create it with: cp server/.env.example server/.env"
fi

if [ -d "$repo_root/web/node_modules" ]; then
  ok "web/node_modules exists"
else
  warn "web dependencies are missing. Run: cd web && corepack pnpm install"
fi

if [ -d "$repo_root/server/node_modules" ]; then
  ok "server/node_modules exists"
else
  warn "server dependencies are missing. Run: cd server && npm install"
fi

echo

if [ "$missing" -eq 0 ]; then
  echo "Local environment looks ready."
else
  echo "Local environment still needs the warnings above."
fi

exit "$missing"
