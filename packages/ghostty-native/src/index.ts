export { createGhosttyNativeBackend } from "./backend.ts"

import { createGhosttyNativeBackend } from "./backend.ts"
import type { TerminalBackend, TerminalOptions } from "@termless/core"

/** Resolve this backend for the registry. Loads native Zig bindings. */
export async function resolve(opts?: Partial<TerminalOptions>): Promise<TerminalBackend> {
  return createGhosttyNativeBackend(opts)
}
