import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { MasterDetailPage } from "../src/features/shell/master-detail-page";

const originalMatchMedia = globalThis.window?.matchMedia;
const originalInnerWidth = globalThis.window?.innerWidth;

const stubMatchMedia = (matches: boolean) => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches,
    media: "(max-width: 1279px)",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
};

afterEach(() => {
  window.localStorage.clear();
  if (originalMatchMedia) {
    window.matchMedia = originalMatchMedia;
  } else {
    stubMatchMedia(false);
  }
  if (originalInnerWidth) {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
  }
});

describe("Feature: master detail page", () => {
  test("Scenario: Given compact viewport When selection key changes Then mobile detail sheet opens", () => {
    const onMobileDetailOpenChange = vi.fn();
    stubMatchMedia(true);

    render(
      <MasterDetailPage
        main={<div>Main</div>}
        detail={<div>Detail</div>}
        detailTitle="Sessions"
        mobileDetailOpen={false}
        onMobileDetailOpenChange={onMobileDetailOpenChange}
        detailSelectionKey="workspace:/repo/demo"
        autoOpenMobileOnSelection
      />,
    );

    expect(onMobileDetailOpenChange).toHaveBeenCalledWith(true);
  });

  test("Scenario: Given persistent desktop split When dragging resize Then restore and persist the shared width", () => {
    stubMatchMedia(false);
    window.localStorage.setItem("agenter:test:split", "70");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });

    const { container } = render(
      <MasterDetailPage
        main={<div>Main</div>}
        detail={<div>Detail</div>}
        detailTitle="Tools"
        mobileDetailOpen={false}
        onMobileDetailOpenChange={() => {}}
        desktopResizable
        desktopSplitStorageKey="agenter:test:split"
        defaultDesktopMainWidthPercent={60}
        minDesktopMainWidthPercent={45}
        maxDesktopMainWidthPercent={82}
      />,
    );

    const mainPane = container.querySelector('[data-slot="master-detail-main"]');
    const separator = container.querySelector('[data-slot="master-detail-resizer"]');

    expect(mainPane).not.toBeNull();
    expect(separator).not.toBeNull();
    expect((mainPane as HTMLDivElement).style.width).toBe("70%");

    fireEvent.mouseDown(separator as HTMLDivElement, { clientX: 500 });
    fireEvent.mouseMove(window, { clientX: 540 });
    fireEvent.mouseUp(window);

    expect((mainPane as HTMLDivElement).style.width).toBe("74%");
    expect(window.localStorage.getItem("agenter:test:split")).toBe("74");
  });
});
