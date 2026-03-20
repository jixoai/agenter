import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { resolveAdaptiveViewportState, useAdaptiveViewport } from "../src/features/shell/useAdaptiveViewport";

afterEach(() => {
  cleanup();
});

const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
};

const HookProbe = () => {
  const state = useAdaptiveViewport();
  return <pre data-testid="adaptive-state">{JSON.stringify(state)}</pre>;
};

describe("Feature: adaptive workspace viewport decisions", () => {
  test("Scenario: Given an expanded desktop viewport When resolving layout Then the shell uses rail navigation and top workspace tabs", () => {
    expect(resolveAdaptiveViewportState({ width: 1440, height: 900 })).toMatchObject({
      widthClass: "expanded",
      orientation: "landscape",
      compact: false,
      globalNavMode: "rail",
      workspaceNavMode: "top",
    });
  });

  test("Scenario: Given a portrait compact viewport When resolving layout Then the shell uses drawer navigation and bottom workspace tabs", () => {
    expect(resolveAdaptiveViewportState({ width: 390, height: 844 })).toMatchObject({
      widthClass: "compact",
      orientation: "portrait",
      compact: true,
      globalNavMode: "drawer",
      workspaceNavMode: "bottom",
    });
  });

  test("Scenario: Given a compact landscape viewport When the hook updates Then workspace navigation returns to the top header", () => {
    setViewport(390, 844);
    render(<HookProbe />);

    expect(screen.getByTestId("adaptive-state").textContent).toContain('"workspaceNavMode":"bottom"');

    setViewport(844, 390);

    expect(screen.getByTestId("adaptive-state").textContent).toContain('"orientation":"landscape"');
    expect(screen.getByTestId("adaptive-state").textContent).toContain('"workspaceNavMode":"top"');
  });
});
