# @jixo/ghostty-native

Native [Ghostty](https://ghostty.org/) backend for [termless](https://termless.dev/) — headless terminal emulation using libghostty-vt via Zig N-API bindings.

Same VT processing as the Ghostty terminal emulator, running natively (no WASM overhead). Compare with `@termless/ghostty` which uses the WASM build.

Supported release installs resolve the native `.node` binding from explicit platform packages:

- `@jixo/ghostty-native-darwin-arm64`
- `@jixo/ghostty-native-darwin-x64`
- `@jixo/ghostty-native-linux-arm64-gnu`
- `@jixo/ghostty-native-linux-x64-gnu`
- `@jixo/ghostty-native-win32-arm64-msvc`
- `@jixo/ghostty-native-win32-x64-msvc`

This umbrella package keeps the JavaScript API and development fallback path. Production installs should use the packaged platform artifact, not a local build as the default runtime path.

## Build

Requires **Zig 0.15.2+** (available via nix).

```bash
# From the ghostty-native package directory:
bash build/build.sh

# Or via the termless CLI:
bunx termless backends install ghostty-native
```

The first build fetches the ghostty source (~large download, cached after).

## Architecture

```
TypeScript backend (src/backend.ts)
  └── N-API bindings (native/src/main.zig) — via napigen
        └── libghostty-vt C API — Ghostty's terminal emulation core
```

- **napigen** — comptime N-API bindings for Zig (single toolchain, no Rust needed)
- **libghostty-vt** — Ghostty's VT parser + terminal state as a C library
- Uses the **Render State API** for efficient cell-by-cell reading
- Uses the **Formatter API** for bulk text extraction

## API

```typescript
import { createGhosttyNativeBackend } from "@jixo/ghostty-native"

const backend = createGhosttyNativeBackend({ cols: 80, rows: 24 })
backend.feed(new TextEncoder().encode("Hello, world!\r\n"))
console.log(backend.getText())
backend.destroy()
```

## Pinned version

Built against ghostty v1.3.1 (`22efb0be`).
