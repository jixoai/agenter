import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dlopen, ptr, suffix, toArrayBuffer } from "bun:ffi";

export type RasterImageFormat = "png" | "jpeg";

interface ResvgLibrary {
  symbols: {
    render_svg: (
      svgPtr: number,
      svgLen: number,
      width: number,
      height: number,
      format: number,
      outPtrPtr: number,
      outLenPtr: number,
    ) => number;
    free_buffer: (bufferPtr: number, bufferLen: number) => void;
  };
  close: () => void;
}

const cargoManifestPath = fileURLToPath(new URL("../../native/resvg_bridge/Cargo.toml", import.meta.url).href);
const defaultLibraryPath = fileURLToPath(
  new URL(`../../native/resvg_bridge/target/release/libprofile_resvg_bridge.${suffix}`, import.meta.url).href,
);

let loadedLibrary: ResvgLibrary | null = null;
let loadedLibraryPath: string | null = null;

type NativePointer = Parameters<typeof toArrayBuffer>[0];

const renderFormatCode = (format: RasterImageFormat): number => (format === "png" ? 1 : 2);

const ensureBridgeBinary = (libraryPath: string): void => {
  if (existsSync(libraryPath)) {
    return;
  }
  const result = spawnSync("cargo", ["build", "--release", "--manifest-path", cargoManifestPath], {
    encoding: "utf8",
  });
  if (result.status === 0 && existsSync(libraryPath)) {
    return;
  }
  throw new Error(
    `failed to build resvg bridge (${result.status ?? "unknown"}): ${(result.stderr || result.stdout || "unknown error").trim()}`,
  );
};

const openBridge = (libraryPath: string): ResvgLibrary =>
  dlopen(libraryPath, {
    render_svg: {
      args: ["ptr", "usize", "u32", "u32", "u32", "ptr", "ptr"],
      returns: "u32",
    },
    free_buffer: {
      args: ["ptr", "usize"],
      returns: "void",
    },
  }) as unknown as ResvgLibrary;

const getLibrary = (libraryPath?: string): ResvgLibrary => {
  const resolvedPath = libraryPath ?? defaultLibraryPath;
  if (loadedLibrary && loadedLibraryPath === resolvedPath) {
    return loadedLibrary;
  }
  ensureBridgeBinary(resolvedPath);
  loadedLibrary?.close();
  loadedLibrary = openBridge(resolvedPath);
  loadedLibraryPath = resolvedPath;
  return loadedLibrary;
};

export const rasterizeSvg = (input: {
  svg: string | Uint8Array;
  format: RasterImageFormat;
  width: number;
  height: number;
  libraryPath?: string;
}): Uint8Array => {
  const svgBytes = typeof input.svg === "string" ? new TextEncoder().encode(input.svg) : input.svg;
  const outPtr = new BigUint64Array(1);
  const outLen = new BigUint64Array(1);
  const library = getLibrary(input.libraryPath);
  const status = library.symbols.render_svg(
    ptr(svgBytes),
    svgBytes.byteLength,
    input.width,
    input.height,
    renderFormatCode(input.format),
    ptr(outPtr),
    ptr(outLen),
  );
  if (status !== 0) {
    throw new Error(`resvg bridge render failed with status=${status}`);
  }
  const bufferPtr = Number(outPtr[0]);
  const bufferLen = Number(outLen[0]);
  const output = new Uint8Array(toArrayBuffer(bufferPtr as unknown as NativePointer, 0, bufferLen));
  const owned = new Uint8Array(output);
  library.symbols.free_buffer(bufferPtr, bufferLen);
  return owned;
};
