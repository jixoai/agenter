const loadImage = async (blob: Blob): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("failed to decode icon"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

const canvasToBlob = async (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number,
): Promise<Blob | null> => {
  if ("convertToBlob" in canvas) {
    return await canvas.convertToBlob({ type, quality });
  }
  return await new Promise<Blob | null>((resolve) => {
    (canvas as HTMLCanvasElement).toBlob((blob) => resolve(blob), type, quality);
  });
};

export const rasterizeSessionIconFallback = async (input: {
  iconUrl: string;
  fileName?: string;
}): Promise<File | null> => {
  const response = await fetch(input.iconUrl, { cache: "force-cache" });
  if (!response.ok) {
    return null;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("image/svg+xml")) {
    return null;
  }
  const blob = await response.blob();
  const image = await loadImage(blob);
  const size = 96;
  const canvas =
    typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size, size) : Object.assign(document.createElement("canvas"), { width: size, height: size });
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.clearRect(0, 0, size, size);
  context.drawImage(image, 0, 0, size, size);
  const webp = await canvasToBlob(canvas, "image/webp", 0.94);
  if (!webp) {
    return null;
  }
  return new File([webp], input.fileName ?? "session-icon.webp", {
    type: "image/webp",
  });
};
