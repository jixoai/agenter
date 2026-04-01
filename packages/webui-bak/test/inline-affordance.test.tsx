import { render, screen } from "@testing-library/react";
import { ChevronRight, Sparkles } from "lucide-react";
import { describe, expect, test } from "vitest";

import { Badge, BadgeLabel, BadgeLeadingVisual } from "../src/components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual, ButtonTrailingVisual } from "../src/components/ui/button";
import {
  InlineAffordance,
  InlineAffordanceLabel,
  InlineAffordanceLeadingVisual,
  InlineAffordanceTrailingVisual,
} from "../src/components/ui/inline-affordance";

describe("Feature: inline affordance spacing contract", () => {
  test("Scenario: Given a leading visual button When it renders Then the visual side keeps the compact inline padding", () => {
    render(
      <Button>
        <ButtonLeadingVisual>
          <Sparkles className="h-4 w-4" />
        </ButtonLeadingVisual>
        <ButtonLabel>Generate</ButtonLabel>
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Generate" })).toHaveAttribute(
      "data-inline-affordance-layout",
      "leading",
    );
    expect(screen.getByRole("button", { name: "Generate" })).toHaveClass("ps-2", "pe-4", "py-2");
  });

  test("Scenario: Given a trailing visual button When it renders Then the trailing visual uses the compact inline padding", () => {
    render(
      <Button>
        <ButtonLabel>Next</ButtonLabel>
        <ButtonTrailingVisual>
          <ChevronRight className="h-4 w-4" />
        </ButtonTrailingVisual>
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Next" })).toHaveAttribute("data-inline-affordance-layout", "trailing");
    expect(screen.getByRole("button", { name: "Next" })).toHaveClass("ps-4", "pe-2", "py-2");
  });

  test("Scenario: Given an icon button When it renders Then it stays square without extra inline padding", () => {
    render(
      <Button size="icon" aria-label="Open quick action">
        <Sparkles className="h-4 w-4" />
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Open quick action" })).toHaveAttribute(
      "data-inline-affordance-layout",
      "icon-only",
    );
    expect(screen.getByRole("button", { name: "Open quick action" })).toHaveClass("h-9", "w-9", "p-0");
  });

  test("Scenario: Given a leading badge When it renders Then the badge follows the compact pill spacing contract", () => {
    render(
      <Badge variant="secondary">
        <BadgeLeadingVisual>
          <Sparkles className="h-3.5 w-3.5" />
        </BadgeLeadingVisual>
        <BadgeLabel>Watching</BadgeLabel>
      </Badge>,
    );

    expect(screen.getByText("Watching").closest("div")).toHaveAttribute("data-inline-affordance-layout", "leading");
    expect(screen.getByText("Watching").closest("div")).toHaveClass("ps-1", "pe-2", "py-1");
  });

  test("Scenario: Given a generic inline affordance with leading and trailing visuals When it renders Then both sides use the shared compact padding contract", () => {
    render(
      <InlineAffordance data-testid="inline-affordance" size="control">
        <InlineAffordanceLeadingVisual>
          <Sparkles className="h-4 w-4" />
        </InlineAffordanceLeadingVisual>
        <InlineAffordanceLabel>Assistant summary</InlineAffordanceLabel>
        <InlineAffordanceTrailingVisual>
          <ChevronRight className="h-4 w-4" />
        </InlineAffordanceTrailingVisual>
      </InlineAffordance>,
    );

    expect(screen.getByTestId("inline-affordance")).toHaveAttribute("data-inline-affordance-layout", "both");
    expect(screen.getByTestId("inline-affordance")).toHaveClass("px-2", "py-2");
  });
});
