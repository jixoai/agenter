#!/usr/bin/env bash
# Build ghostty-native N-API bindings for termless.
#
# Ghostty's terminal emulation core is compiled directly as a Zig dependency.
# The build:
#   1. Clones ghostty source (if not already present)
#   2. Builds napigen N-API bindings against the minimal ghostty-vt module
#   3. Copies the .node file to the package root
#
# Requirements:
#   - Zig 0.15.2
#   - macOS Command Line Tools / Xcode SDK
#   - Internet access only for the initial ghostty clone
#
# Usage:
#   cd packages/ghostty-native && bash build/build.sh
#
# Output:
#   termless-ghostty-native.node (in package root)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NATIVE_DIR="$PKG_DIR/native"
GHOSTTY_DIR="$NATIVE_DIR/.ghostty-src"
GHOSTTY_VERSION="v1.3.1"

echo "Building @jixo/ghostty-native..."

# ─── Phase 1: Ensure ghostty source is available ─────────

echo
echo "Phase 1: Ensuring ghostty source ($GHOSTTY_VERSION)..."

if [[ ! -d "$GHOSTTY_DIR" ]]; then
  echo "  Cloning ghostty (shallow, pinned to $GHOSTTY_VERSION)..."
  git clone --depth 1 --branch "$GHOSTTY_VERSION" \
    https://github.com/ghostty-org/ghostty.git "$GHOSTTY_DIR"
else
  echo "  Using cached ghostty source in $GHOSTTY_DIR"
  # Verify we have the right version
  CURRENT=$(cd "$GHOSTTY_DIR" && git describe --tags --exact-match 2>/dev/null || echo "unknown")
  if [[ "$CURRENT" != "$GHOSTTY_VERSION" ]]; then
    echo "  Version mismatch ($CURRENT != $GHOSTTY_VERSION), re-cloning..."
    rm -rf "$GHOSTTY_DIR"
    git clone --depth 1 --branch "$GHOSTTY_VERSION" \
      https://github.com/ghostty-org/ghostty.git "$GHOSTTY_DIR"
  fi
fi

# ─── Phase 2: Build N-API bindings ───────────────────────

echo
echo "Phase 2: Building N-API bindings (ghostty-vt minimal dependency graph)..."
echo "  This may take a few minutes on first build."

cd "$NATIVE_DIR"

ZIG_BIN="${ZIG_BIN:-}"
if [[ -z "$ZIG_BIN" ]]; then
  if [[ -x /tmp/zig-0.15.2/zig ]]; then
    ZIG_BIN="/tmp/zig-0.15.2/zig"
  elif command -v zig >/dev/null 2>&1 && [[ "$(zig version 2>/dev/null || true)" == "0.15.2" ]]; then
    ZIG_BIN="$(command -v zig)"
  else
    echo
    echo "ERROR: Zig 0.15.2 is required. Set ZIG_BIN or install Zig 0.15.2."
    exit 1
  fi
fi

SDKROOT="${SDKROOT:-$(xcrun --sdk macosx --show-sdk-path)}"
DEVELOPER_DIR="${DEVELOPER_DIR:-$(xcode-select -p)}"

env SDKROOT="$SDKROOT" DEVELOPER_DIR="$DEVELOPER_DIR" "$ZIG_BIN" build --release=fast || {
  echo
  echo "ERROR: Failed to build N-API bindings."
  echo
  echo "  Expected Zig 0.15.2 plus a working macOS SDK."
  exit 1
}

# ─── Phase 3: Copy output ────────────────────────────────

echo
echo "Phase 3: Copying output..."

NODE_FILE=""

# Check zig-out for the .node file
if [[ -f "$NATIVE_DIR/zig-out/lib/termless-ghostty-native.node" ]]; then
  NODE_FILE="$NATIVE_DIR/zig-out/lib/termless-ghostty-native.node"
fi

# Try .dylib/.so
if [[ -z "$NODE_FILE" ]]; then
  NODE_FILE=$(find "$NATIVE_DIR/zig-out/lib" -maxdepth 1 -name "libtermless_ghostty_native*" \( -name "*.dylib" -o -name "*.so" \) 2>/dev/null | head -1)
fi

if [[ -z "$NODE_FILE" ]]; then
  echo "ERROR: No output binary found."
  ls -la "$NATIVE_DIR/zig-out/lib/" 2>/dev/null || echo "(zig-out/lib/ does not exist)"
  exit 1
fi

cp "$NODE_FILE" "$PKG_DIR/termless-ghostty-native.node"

# macOS validates pages for dlopen()'d native modules. Zig's linker can leave
# copied Mach-O outputs with a stale or unusable ad-hoc signature, which makes
# Node/Bun get SIGKILL(CODESIGNING Invalid Page) at require() time. Re-sign the
# final package artifact after copying so the bytes on disk match the signature.
if [[ "$(uname -s)" == "Darwin" ]] && command -v codesign >/dev/null 2>&1; then
  codesign --force --sign - "$PKG_DIR/termless-ghostty-native.node" >/dev/null
fi

SIZE=$(du -h "$PKG_DIR/termless-ghostty-native.node" | cut -f1)
echo "  termless-ghostty-native.node ($SIZE)"
echo
echo "Build complete."
