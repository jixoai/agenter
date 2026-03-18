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
