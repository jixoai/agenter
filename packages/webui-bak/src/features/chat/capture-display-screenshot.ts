export const canCaptureDisplayScreenshot = (): boolean =>
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices !== "undefined" &&
  typeof navigator.mediaDevices.getDisplayMedia === "function";

export const captureDisplayScreenshot = async (): Promise<File> => {
  if (!canCaptureDisplayScreenshot()) {
    throw new Error("screen capture is not supported");
  }

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("failed to load screen capture stream"));
    });
    await video.play();

    const width = Math.max(1, video.videoWidth || 1);
    const height = Math.max(1, video.videoHeight || 1);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("failed to initialize screenshot canvas");
    }
    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((next) => {
        if (next) {
          resolve(next);
          return;
        }
        reject(new Error("failed to encode screenshot"));
      }, "image/png");
    });

    return new File([blob], `screenshot-${Date.now()}.png`, {
      type: "image/png",
      lastModified: Date.now(),
    });
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
};
