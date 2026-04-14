#!/bin/bash
set -euo pipefail

# Agenter UI Capture Intelligence (v3)
# Usage: ./.gemini/scripts/ui-capture.sh <topic> <url> <wait_target> <stage> [device_preset]

TOPIC=${1:-}
URL=${2:-}
WAIT_TARGET=${3:-}
STAGE=${4:-}
DEVICE=${5:-}

if [ -z "$STAGE" ] || [ -z "$TOPIC" ] || [ -z "$URL" ] || [ -z "$WAIT_TARGET" ]; then
  echo "Usage: $0 <topic> <url> <wait_target> <stage> [device_preset]"
  exit 1
fi

ROOT_DIR=$(git rev-parse --show-toplevel)
SCREENSHOT_DIR="$ROOT_DIR/.screenshot/$TOPIC"
README_PATH="$SCREENSHOT_DIR/README.md"
mkdir -p "$SCREENSHOT_DIR"
TMP_ROOT=${TMPDIR:-/tmp}
EXPECTED_WIDTH=""
EXPECTED_HEIGHT=""

PORT=$(printf '%s' "$URL" | sed -nE 's#.*:([0-9]{4,5}).*#\1#p')
HOST=$(printf '%s' "$URL" | sed -nE 's#^[a-zA-Z]+://([^/:]+).*$#\1#p')
HOST=${HOST:-127.0.0.1}
STARTED_SERVER=0
SERVER_PID=""
SESSION_NAME="capture-${TOPIC//[^a-zA-Z0-9_-]/-}-${STAGE//[^a-zA-Z0-9_-]/-}-$$"

find_webui_dir() {
  while IFS= read -r package_json; do
    if grep -q '"name":[[:space:]]*"@agenter/webui"' "$package_json"; then
      dirname "$package_json"
      return 0
    fi
  done < <(find "$ROOT_DIR" -maxdepth 4 -name package.json | sort)
  return 1
}

wait_for_port() {
  local port="$1"
  local attempts=0
  while [ "$attempts" -lt 60 ]; do
    if lsof -i :"$port" >/dev/null 2>&1; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  return 1
}

wait_for_url() {
  local url="$1"
  local attempts=0
  while [ "$attempts" -lt 60 ]; do
    if curl --silent --show-error --output /dev/null --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  return 1
}

is_retryable_agent_browser_error() {
  local output="$1"
  printf '%s' "$output" | grep -Eiq 'Daemon failed to start|could not connect|ECONNREFUSED|ECONNRESET|ENOENT|socket hang up|channel closed'
}

heal_agent_browser_runtime() {
  echo "⚠️ agent-browser daemon is unhealthy. Cleaning stale runtime and retrying once..."
  pkill -9 -f 'agent-browser.*daemon|agent-browser-darwin-arm64|/dist/daemon.js' >/dev/null 2>&1 || true
  find "$TMP_ROOT" -maxdepth 1 \( -name 'agent-browser-*' -o -name 'agent-browser-chrome-*' \) -exec rm -rf {} + >/dev/null 2>&1 || true
}

run_agent_browser() {
  local output=""
  local status=0
  local attempt=1
  while [ "$attempt" -le 3 ]; do
    set +e
    output=$(agent-browser --session "$SESSION_NAME" "$@" 2>&1)
    status=$?
    set -e
    if [ "$status" -eq 0 ]; then
      if [ -n "$output" ]; then
        printf '%s\n' "$output"
      fi
      return 0
    fi
    if is_retryable_agent_browser_error "$output"; then
      if [ -n "$output" ]; then
        printf '%s\n' "$output" >&2
      fi
      if [ "$attempt" -eq 1 ]; then
        heal_agent_browser_runtime
      fi
      sleep 5
      attempt=$((attempt + 1))
      continue
    fi
    if [ -n "$output" ]; then
      printf '%s\n' "$output" >&2
    fi
    return "$status"
  done
}

configure_capture_surface() {
  if [ -n "$DEVICE" ]; then
    case "$DEVICE" in
      "iPhone 14")
        EXPECTED_WIDTH=390
        EXPECTED_HEIGHT=664
        ;;
    esac
    run_agent_browser set device "$DEVICE"
    return 0
  fi

  EXPECTED_WIDTH=1440
  EXPECTED_HEIGHT=1024
  run_agent_browser set viewport 1440 1024
}

verify_capture_dimensions() {
  local screenshot_path="$1"
  if [ -z "$EXPECTED_WIDTH" ] || [ -z "$EXPECTED_HEIGHT" ]; then
    return 0
  fi

  local actual_width=""
  local actual_height=""
  actual_width=$(sips -g pixelWidth "$screenshot_path" 2>/dev/null | awk '/pixelWidth:/ { print $2 }')
  actual_height=$(sips -g pixelHeight "$screenshot_path" 2>/dev/null | awk '/pixelHeight:/ { print $2 }')

  if [ "$actual_width" != "$EXPECTED_WIDTH" ] || [ "$actual_height" != "$EXPECTED_HEIGHT" ]; then
    echo "❌ Screenshot dimension mismatch for $screenshot_path: expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}, got ${actual_width}x${actual_height}" >&2
    return 1
  fi
}

cleanup() {
  agent-browser --session "$SESSION_NAME" close >/dev/null 2>&1 || true
  if [ "$STARTED_SERVER" -eq 1 ] && [ -n "$SERVER_PID" ]; then
    echo "🛑 Stopping temporary dev server on port $PORT..."
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

if [ -n "$PORT" ] && ! lsof -i :"$PORT" >/dev/null 2>&1; then
  echo "⚠️ Port $PORT is inactive. Starting webui dev server..."
  WEBUI_DIR=$(find_webui_dir || true)
  if [ -z "${WEBUI_DIR:-}" ]; then
    echo "❌ Could not locate @agenter/webui package from $ROOT_DIR"
    exit 1
  fi

  (
    cd "$WEBUI_DIR"
    bun run dev --host "$HOST" --port "$PORT"
  ) >/tmp/agenter-ui-capture-"$PORT".log 2>&1 &
  SERVER_PID=$!
  STARTED_SERVER=1

  if ! wait_for_port "$PORT"; then
    echo "❌ Dev server did not become ready on port $PORT"
    exit 1
  fi
  if ! wait_for_url "$URL"; then
    echo "❌ Dev server did not become reachable at $URL"
    exit 1
  fi
fi

echo "📸 Capturing '$STAGE' for '$TOPIC' at $URL..."

configure_capture_surface
run_agent_browser open "$URL"

if ! run_agent_browser wait --load networkidle; then
  echo "⚠️ networkidle did not settle, falling back to timed wait..."
  run_agent_browser wait 1500
fi
if [[ "$WAIT_TARGET" == *"#"* ]] || [[ "$WAIT_TARGET" == *"."* ]] || [[ "$WAIT_TARGET" == *"["* ]]; then
  run_agent_browser wait "$WAIT_TARGET"
else
  run_agent_browser wait --text "$WAIT_TARGET"
fi
run_agent_browser wait 750
run_agent_browser screenshot "$SCREENSHOT_DIR/$STAGE.png"
verify_capture_dimensions "$SCREENSHOT_DIR/$STAGE.png"

if [ ! -f "$README_PATH" ]; then
  cat <<EOF > "$README_PATH"
# $TOPIC - Visual Comparison

## Topic: [Describe the focus of the change]
**Date:** $(date +%Y-%m-%d)

### Screenshots
- [Before](./before.png)
- [After](./after.png)
- [Desktop](./after_desktop.png)
- [Mobile](./after_mobile.png)

### Key UX Improvements & Design Rationale
*(Explain the changes here, referencing DESIGN.md principles like information density, scroll ownership, and help-hint usage.)*

1.
2.
EOF
  echo "📝 Generated scaffold README at $README_PATH"
fi

echo "✅ Captured: $SCREENSHOT_DIR/$STAGE.png"
