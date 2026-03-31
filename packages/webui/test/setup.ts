import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class IntersectionObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

if (!window.scrollTo) {
  window.scrollTo = vi.fn();
}

const emptyRectList = {
  length: 0,
  item: () => null,
  [Symbol.iterator]: function* iterator() {
    return;
  },
} as unknown as DOMRectList;

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => emptyRectList;
}

if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
}

const canvasContext2D = {
  fillRect: () => undefined,
  clearRect: () => undefined,
  getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  putImageData: () => undefined,
  createImageData: () => ({ data: new Uint8ClampedArray(4) }),
  setTransform: () => undefined,
  drawImage: () => undefined,
  save: () => undefined,
  fillText: () => undefined,
  restore: () => undefined,
  beginPath: () => undefined,
  moveTo: () => undefined,
  lineTo: () => undefined,
  closePath: () => undefined,
  stroke: () => undefined,
  translate: () => undefined,
  scale: () => undefined,
  rotate: () => undefined,
  arc: () => undefined,
  fill: () => undefined,
  measureText: () => ({ width: 0 }),
  transform: () => undefined,
  rect: () => undefined,
  clip: () => undefined,
  createLinearGradient: () => ({ addColorStop: () => undefined }),
} as unknown as CanvasRenderingContext2D;

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: ((contextId: string) => (contextId === "2d" ? canvasContext2D : null)) as typeof HTMLCanvasElement.prototype.getContext,
});
