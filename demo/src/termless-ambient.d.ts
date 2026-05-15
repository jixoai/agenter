declare module "gifenc" {
  export interface GifEncoder {
    writeFrame(
      indexedPixels: Uint8Array,
      width: number,
      height: number,
      options: {
        palette: number[] | Uint8Array | Array<[number, number, number]>;
        delay?: number;
        repeat?: number;
      },
    ): void;
    finish(): void;
    bytesView(): Uint8Array;
  }

  export const GIFEncoder: () => GifEncoder;
  export const quantize: (rgba: Uint8Array, maxColors: number) => number[] | Uint8Array | Array<[number, number, number]>;
  export const applyPalette: (
    rgba: Uint8Array,
    palette: number[] | Uint8Array | Array<[number, number, number]>,
  ) => Uint8Array;
}

declare module "upng-js" {
  export const decode: (input: ArrayBuffer | Uint8Array) => unknown;
  export const encode: (
    buffers: ArrayBuffer[] | Uint8Array[],
    width: number,
    height: number,
    colors?: number,
    delays?: number[],
  ) => ArrayBuffer;
}
