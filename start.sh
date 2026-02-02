#!/usr/bin/env bash
# Agenter Queue Workflow Launcher

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
WHITE='\033[1;37m'
NC='\033[0m'

echo -e "${CYAN}"
cat << "EOF"
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║              Agenter - Queue Workflow TUI                        ║
║                                                                  ║
║     Ctrl+Enter=Queue | Shift+Enter=Now | Enter=New/Edit          ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check bun
if ! command -v bun &> /dev/null; then
    echo -e "${RED}✗ Bun not installed. https://bun.sh${NC}"
    exit 1
fi

BUN_VERSION=$(bun --version)
echo -e "${GREEN}✓ Bun $BUN_VERSION${NC}"

# Cleanup
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    if [ -n "$API_PID" ]; then
        kill $API_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}✓ Done${NC}"
}
trap cleanup EXIT

pkill -f "bun run src/api-ws.ts" 2>/dev/null || true
sleep 1

# Start API Server
echo ""
echo -e "${YELLOW}Starting WebSocket API Server...${NC}"
bun run src/api-ws.ts &
API_PID=$!

echo "Waiting for server..."
sleep 3

# Start TUI
echo ""
echo -e "${CYAN}Starting Queue Workflow TUI...${NC}"
echo ""
echo -e "${WHITE}Quick Guide:${NC}"
echo "  1. Type a message"
echo "  2. Ctrl+Enter to queue, or Shift+Enter for immediate"
echo "  3. Press Enter to create/jump to editing tab"
echo "  4. Queue processes automatically (FIFO)"
echo ""

cd tui-react
bun run dev
