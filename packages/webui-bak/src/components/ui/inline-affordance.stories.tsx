import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bell, ChevronRight, Sparkles } from "lucide-react";
import { expect, within } from "storybook/test";

import { Badge, BadgeLabel, BadgeLeadingVisual } from "./badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "./button";
import {
  InlineAffordance,
  InlineAffordanceLabel,
  InlineAffordanceLeadingVisual,
  InlineAffordanceMeta,
  InlineAffordanceTrailingVisual,
} from "./inline-affordance";

const meta = {
  title: "Components/UI/InlineAffordance",
  render: () => (
    <div className="flex w-[480px] flex-col gap-4 p-6">
      <Button data-testid="leading-button" variant="outline">
        <ButtonLeadingVisual>
          <Sparkles className="h-4 w-4" />
        </ButtonLeadingVisual>
        <ButtonLabel>Generate</ButtonLabel>
      </Button>

      <Badge data-testid="leading-badge" variant="secondary">
        <BadgeLeadingVisual>
          <Bell className="h-3.5 w-3.5" />
        </BadgeLeadingVisual>
        <BadgeLabel>Watching</BadgeLabel>
      </Badge>

      <InlineAffordance data-testid="inline-summary" size="control" className="rounded-lg bg-slate-100 text-slate-700">
        <InlineAffordanceLeadingVisual>
          <Sparkles className="h-4 w-4" />
        </InlineAffordanceLeadingVisual>
        <InlineAffordanceLabel>Assistant summary</InlineAffordanceLabel>
        <InlineAffordanceMeta>2s</InlineAffordanceMeta>
        <InlineAffordanceTrailingVisual>
          <ChevronRight className="h-4 w-4" />
        </InlineAffordanceTrailingVisual>
      </InlineAffordance>
    </div>
  ),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const SpacingContract: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByTestId("leading-button")).toHaveAttribute("data-inline-affordance-layout", "leading");
    await expect(canvas.getByTestId("leading-button")).toHaveClass("ps-2", "pe-4", "py-2");

    await expect(canvas.getByTestId("leading-badge")).toHaveAttribute("data-inline-affordance-layout", "leading");
    await expect(canvas.getByTestId("leading-badge")).toHaveClass("ps-1", "pe-2", "py-1");

    await expect(canvas.getByTestId("inline-summary")).toHaveAttribute("data-inline-affordance-layout", "both");
    await expect(canvas.getByTestId("inline-summary")).toHaveClass("px-2", "py-2");
  },
};
