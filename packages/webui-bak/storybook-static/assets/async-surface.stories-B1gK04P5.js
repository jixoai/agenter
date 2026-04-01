import{j as e}from"./jsx-runtime-u17CrQMm.js";import{A as s}from"./async-surface-CwnBr4KY.js";import{S as r}from"./skeleton-D3ZGd0h7.js";import"./utils-VtdL_sx5.js";import"./iframe-BA9U4A2Q.js";import"./preload-helper-PPVm8Dsz.js";import"./loader-circle-BDXf0OYg.js";const{expect:a,within:o}=__STORYBOOK_MODULE_TEST__,h={title:"Components/AsyncSurface",component:s,args:{state:"empty-idle",empty:e.jsx("div",{children:"No data yet"})}},n=({title:d,children:t})=>e.jsxs("section",{className:"rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",children:[e.jsx("h3",{className:"mb-3 text-sm font-semibold text-slate-900",children:d}),e.jsx("div",{className:"h-40",children:t})]}),i={args:{},render:()=>e.jsxs("div",{className:"grid gap-4 p-6 md:grid-cols-2",children:[e.jsx(n,{title:"Empty + Loading",children:e.jsx(s,{state:"empty-loading",emptyLoadingLabel:"Loading the first page...",skeleton:e.jsx(r,{className:"h-full w-full rounded-2xl"}),empty:e.jsx("div",{children:"Empty idle"})})}),e.jsx(n,{title:"Empty + Idle",children:e.jsx(s,{state:"empty-idle",skeleton:e.jsx("div",{children:"Loading"}),empty:e.jsx("div",{children:"No data yet"})})}),e.jsx(n,{title:"Data + Loading",children:e.jsx(s,{state:"ready-loading",loadingOverlayLabel:"Refreshing sessions...",empty:e.jsx("div",{children:"Empty"}),children:e.jsx("div",{className:"rounded-2xl bg-slate-50 p-4 text-sm text-slate-700",children:"Existing rows stay visible while refreshing."})})}),e.jsx(n,{title:"Data + Idle",children:e.jsx(s,{state:"ready-idle",empty:e.jsx("div",{children:"Empty"}),children:e.jsx("div",{className:"rounded-2xl bg-slate-50 p-4 text-sm text-slate-700",children:"Steady-state content remains visible."})})})]}),play:async({canvasElement:d})=>{const t=o(d);await a(t.getByText("Empty + Loading")).toBeInTheDocument(),await a(t.getByText("Loading the first page...")).toBeInTheDocument(),await a(t.getByText("No data yet")).toBeInTheDocument(),await a(t.getByText("Refreshing sessions...")).toBeInTheDocument(),await a(t.getByText("Steady-state content remains visible.")).toBeInTheDocument()}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {},
  render: () => <div className="grid gap-4 p-6 md:grid-cols-2">
      <SurfaceCard title="Empty + Loading">
        <AsyncSurface state="empty-loading" emptyLoadingLabel="Loading the first page..." skeleton={<Skeleton className="h-full w-full rounded-2xl" />} empty={<div>Empty idle</div>} />
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
    </div>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Empty + Loading")).toBeInTheDocument();
    await expect(canvas.getByText("Loading the first page...")).toBeInTheDocument();
    await expect(canvas.getByText("No data yet")).toBeInTheDocument();
    await expect(canvas.getByText("Refreshing sessions...")).toBeInTheDocument();
    await expect(canvas.getByText("Steady-state content remains visible.")).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source}}};const u=["FourStateContract"];export{i as FourStateContract,u as __namedExportsOrder,h as default};
