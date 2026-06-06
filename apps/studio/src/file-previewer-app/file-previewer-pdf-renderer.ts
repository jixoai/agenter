import * as pdfjs from "pdfjs-dist/build/pdf.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

const decodeDataUrlBytes = (dataUrl: string): Uint8Array => {
  const [, base64 = ""] = dataUrl.split(",", 2);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const renderPdfPages = async (input: {
  mediaDataUrl: string;
  container: HTMLDivElement;
  isCurrent: () => boolean;
}): Promise<void> => {
  input.container.replaceChildren();
  const loadingTask = pdfjs.getDocument({
    data: decodeDataUrlBytes(input.mediaDataUrl),
  });
  const pdfDocument = await loadingTask.promise;
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    if (!input.isCurrent()) {
      await pdfDocument.destroy();
      return;
    }
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.25 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      continue;
    }
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = "file-previewer__pdf-page";
    input.container.append(canvas);
    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;
  }
  await pdfDocument.destroy();
};
