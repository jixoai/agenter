import { encode as encodeJpeg } from "jpeg-js";

export type RasterImageFormat = "png" | "jpeg";

type ResvgModule = typeof import("@resvg/resvg-js");
type ResvgModuleLoader = () => Promise<ResvgModule>;

let loadedModulePromise: Promise<ResvgModule> | null = null;

const normalizeRuntimeError = (error: unknown): Error => {
  if (error instanceof Error && error.message.startsWith("packaged resvg runtime is unavailable")) {
    return error;
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(
    `packaged resvg runtime is unavailable on ${process.platform}/${process.arch}: ${detail}`,
  );
};

// Package install is the raster runtime truth. Requests must never fall back to
// building a repo-local bridge just to serve a default icon variant.
const loadResvgModule: ResvgModuleLoader = async () => {
  if (!loadedModulePromise) {
    loadedModulePromise = import("@resvg/resvg-js").catch((error: unknown) => {
      loadedModulePromise = null;
      throw normalizeRuntimeError(error);
    });
  }
  return await loadedModulePromise;
};

const encodeRasterBytes = (input: {
  pixels: Buffer;
  width: number;
  height: number;
}): Uint8Array => {
  return new Uint8Array(
    encodeJpeg(
      {
        data: input.pixels,
        width: input.width,
        height: input.height,
      },
      90,
    ).data,
  );
};

export const rasterizeSvg = async (
  input: {
    svg: string | Uint8Array;
    format: RasterImageFormat;
    width: number;
    height: number;
  },
  loadModule: ResvgModuleLoader = loadResvgModule,
): Promise<Uint8Array> => {
  const { Resvg } = await loadModule().catch((error: unknown) => {
    throw normalizeRuntimeError(error);
  });
  const svgBytes = typeof input.svg === "string" ? new TextEncoder().encode(input.svg) : input.svg;
  const resvg = new Resvg(Buffer.from(svgBytes), {
    fitTo:
      input.width >= input.height
        ? { mode: "width", value: input.width }
        : { mode: "height", value: input.height },
  });
  const rendered = resvg.render();
  if (input.format === "png") {
    return new Uint8Array(rendered.asPng());
  }
  return encodeRasterBytes({
    pixels: rendered.pixels,
    width: rendered.width,
    height: rendered.height,
  });
};
