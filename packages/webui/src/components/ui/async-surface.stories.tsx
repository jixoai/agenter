import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { AsyncSurface } from "./async-surface";
import { Skeleton } from "./skeleton";

const meta = {
  title: "Components/AsyncSurface",
  component: AsyncSurface,
  args: {
    state: "empty-idle",
    empty: <div>No data yet</div>,
  },
} satisfies Meta<typeof AsyncSurface>;

export default meta;

type Story = StoryObj<typeof meta>;

const SurfaceCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
    <div className="h-40">{children}</div>
  </section>
);

export const FourStateContract: Story = {
  args: {},
  render: () => (
    <div className="grid gap-4 p-6 md:grid-cols-2">
      <SurfaceCard title="Empty + Loading">
        <AsyncSurface
          state="empty-loading"
          skeleton={<Skeleton className="h-full w-full rounded-2xl" />}
          empty={<div>Empty idle</div>}
        />
      </SurfaceCard>
      <SurfaceCard title="Empty + Idle">
        <AsyncSurface state="empty-idle" skeleton={<div>Loading</div>} empty={<div>No data yet</div>} />
      </SurfaceCard>
      <SurfaceCard title="Data + Loading">
        <AsyncSurface state="ready-loading" loadingOverlayLabel="Refreshing sessions..." empty={<div>Empty</div>}>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">Existing rows stay visible while refreshing.</div>
        </AsyncSurface>
      </SurfaceCard>
      <SurfaceCard title="Data + Idle">
        <AsyncSurface state="ready-idle" empty={<div>Empty</div>}>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">Steady-state content remains visible.</div>
        </AsyncSurface>
      </SurfaceCard>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Empty + Loading")).toBeInTheDocument();
    await expect(canvas.getByText("No data yet")).toBeInTheDocument();
    await expect(canvas.getByText("Refreshing sessions...")).toBeInTheDocument();
    await expect(canvas.getByText("Steady-state content remains visible.")).toBeInTheDocument();
  },
};
