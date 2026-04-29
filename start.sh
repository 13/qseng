#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR/backend"
WEB_DIR="$SCRIPT_DIR/frontend"

API_URL="http://localhost:5000"
WEB_URL="http://localhost:4200"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

info()    { echo -e "${CYAN}[qseng]${NC} $*"; }
success() { echo -e "${GREEN}[qseng]${NC} $*"; }
warn()    { echo -e "${YELLOW}[qseng]${NC} $*"; }
error()   { echo -e "${RED}[qseng]${NC} $*" >&2; }

# ── Prerequisites ────────────────────────────────────────────────────────────

check_tool() {
    local cmd=$1 label=$2 hint=$3
    if ! command -v "$cmd" &>/dev/null; then
        error "Missing: $label"
        error "  → $hint"
        exit 1
    fi
}

check_tool dotnet ".NET SDK 10"  "https://aka.ms/dotnet/download"
check_tool node   "Node.js 20+"  "https://nodejs.org"
check_tool npm    "npm"          "bundled with Node.js"

DOTNET_MAJOR=$(dotnet --version | cut -d. -f1)
if [[ "$DOTNET_MAJOR" -lt 10 ]]; then
    warn ".NET $DOTNET_MAJOR detected; .NET 10 recommended"
fi

NODE_MAJOR=$(node --version | tr -d 'v' | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 20 ]]; then
    warn "Node $(node --version) detected; v20+ recommended"
fi

# ── Install dependencies ─────────────────────────────────────────────────────

info "Restoring NuGet packages…"
dotnet restore "$API_DIR/Qseng.slnx" -q

if [[ ! -d "$WEB_DIR/node_modules" ]]; then
    info "Installing npm dependencies…"
    (cd "$WEB_DIR" && npm install --silent)
else
    info "node_modules present — skipping npm install"
fi

# ── Cleanup on exit ──────────────────────────────────────────────────────────

API_PID=""
WEB_PID=""

cleanup() {
    echo ""
    info "Shutting down…"
    [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null && wait "$API_PID" 2>/dev/null || true
    [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null && wait "$WEB_PID" 2>/dev/null || true
    success "Stopped. Bye!"
}
trap cleanup EXIT INT TERM

# ── Start API ────────────────────────────────────────────────────────────────

API_LOG="$SCRIPT_DIR/.api.log"

info "Starting API on $API_URL …"
(
    cd "$API_DIR"
    DB_PROVIDER=sqlite CONNECTION_STRING="Data Source=$API_DIR/qseng.db" \
        dotnet run --project src/Qseng.Api --no-launch-profile 2>&1
) > "$API_LOG" &
API_PID=$!

# Wait for API to become ready (up to 30 s)
API_READY=false
for i in $(seq 1 30); do
    if curl -sf "$API_URL/api/v1/health" &>/dev/null; then
        API_READY=true
        break
    fi
    sleep 1
done

if [[ "$API_READY" == false ]]; then
    error "API did not start within 30 seconds."
    error "Check $API_LOG for details."
    cat "$API_LOG"
    exit 1
fi

success "API ready  →  $API_URL"
info    "Swagger    →  $API_URL/swagger"

# ── Start Frontend ────────────────────────────────────────────────────────────

info "Starting Angular dev server on $WEB_URL …"
(cd "$WEB_DIR" && npm start -- --open=false 2>&1) &
WEB_PID=$!

# Wait for frontend to become ready (up to 60 s)
WEB_READY=false
for i in $(seq 1 60); do
    if curl -sf "$WEB_URL" &>/dev/null; then
        WEB_READY=true
        break
    fi
    sleep 1
done

if [[ "$WEB_READY" == false ]]; then
    warn "Frontend did not respond within 60 seconds — it may still be compiling."
fi

echo ""
echo -e "  ${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}  Qseng is running!${NC}"
echo -e "  ${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  App      →  ${CYAN}$WEB_URL${NC}"
echo -e "  API      →  ${CYAN}$API_URL${NC}"
echo -e "  Swagger  →  ${CYAN}$API_URL/swagger${NC}"
echo ""
echo -e "  Demo login:"
echo -e "    Email:    demo@qseng.app"
echo -e "    Password: Demo123!"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop."
echo ""

# ── Keep alive ───────────────────────────────────────────────────────────────

# Wait for either child to exit unexpectedly
wait -n "$API_PID" "$WEB_PID" 2>/dev/null || true

# If a child died, report it
if ! kill -0 "$API_PID" 2>/dev/null; then
    error "API process exited unexpectedly. Last log:"
    tail -20 "$API_LOG"
fi
