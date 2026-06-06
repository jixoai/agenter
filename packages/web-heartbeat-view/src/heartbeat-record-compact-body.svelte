<script lang="ts">
  import HeartbeatRecordIcon from "./heartbeat-record-icon.svelte";
  import { Button, Segmented } from "./framework7-components";
  import { formatHeartbeatRecordPayload, readHeartbeatRecordPayloadValue } from "./heartbeat-record-detail-model";
  import type { HeartbeatRecordItem } from "./types";

  let {
    record,
    payload = null,
    variant = "card",
    title,
  }: {
    record: HeartbeatRecordItem;
    payload?: unknown;
    variant?: "card" | "detail";
    title: string;
  } = $props();

  type CompactTab = "new" | "old";

  let compactTab = $state<CompactTab>("new");
  const compactTabIds = Object.freeze({
    new: "ag-heartbeat-record-compact-tab-new",
    old: "ag-heartbeat-record-compact-tab-old",
  });
  const compactPanelId = "ag-heartbeat-record-compact-panel";

  const resolveNumber = (value: unknown, fallback: number): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    return fallback;
  };

  const beforeValue = $derived(
    resolveNumber(
      readHeartbeatRecordPayloadValue(payload, ["before", "beforeContext", "beforeUsage", "beforePercent", "from"]),
      63.4,
    ),
  );
  const afterValue = $derived(
    resolveNumber(
      readHeartbeatRecordPayloadValue(payload, ["after", "afterContext", "afterUsage", "afterPercent", "to"]),
      24.1,
    ),
  );
  const compactError = $derived(readHeartbeatRecordPayloadValue(payload, ["error", "message"]) ?? null);
  const newContext = $derived(
    readHeartbeatRecordPayloadValue(payload, ["newContext", "new", "after", "context", "text", "content"]) ??
      (payload === null ? null : payload),
  );
  const oldContext = $derived(readHeartbeatRecordPayloadValue(payload, ["oldContext", "old", "before", "previousContext"]) ?? null);
  const compactSource = $derived.by(() => {
    if (compactTab === "old") {
      return oldContext === null ? "" : formatHeartbeatRecordPayload(oldContext);
    }
    return newContext === null ? "" : formatHeartbeatRecordPayload(newContext);
  });
  const compactState = $derived(
    record.status === "error" ? "error" : record.status === "running" ? "running" : "completed",
  );
  const coreText = $derived.by(() => {
    if (compactState === "error") {
      return `${beforeValue.toFixed(1)} -> error`;
    }
    return `${beforeValue.toFixed(1)} -> ${afterValue.toFixed(1)}`;
  });
</script>

{#if variant === "card"}
  <div
    class="ag-heartbeat-record-compact"
    class:ag-heartbeat-record-compact--running={compactState === "running"}
    class:ag-heartbeat-record-compact--error={compactState === "error"}
    data-state={compactState}
    data-object-kind="compact"
    title={title}
  >
    <span class="ag-heartbeat-record-compact__before" style={`width:${beforeValue}%`}></span>
    <span class="ag-heartbeat-record-compact__after" style={`width:${afterValue}%`}></span>
    <span class="ag-heartbeat-record-compact__core">
      <HeartbeatRecordIcon kind={compactState === "error" ? "error" : compactState === "running" ? "pending" : "compact"} size={15} />
      <span>{coreText}</span>
    </span>
  </div>
{:else}
  <div class="ag-heartbeat-record-compact-detail" data-record-body="compact">
    <div class="ag-heartbeat-record-compact-detail__object" data-object-kind="compact" aria-label="Compact context object">
      <div
        class="ag-heartbeat-record-compact"
        class:ag-heartbeat-record-compact--running={compactState === "running"}
        class:ag-heartbeat-record-compact--error={compactState === "error"}
        data-state={compactState}
        title={title}
      >
        <span class="ag-heartbeat-record-compact__before" style={`width:${beforeValue}%`}></span>
        <span class="ag-heartbeat-record-compact__after" style={`width:${afterValue}%`}></span>
        <span class="ag-heartbeat-record-compact__core">
          <HeartbeatRecordIcon kind={compactState === "error" ? "error" : compactState === "running" ? "pending" : "compact"} size={15} />
          <span>{coreText}</span>
        </span>
      </div>
    </div>

    <Segmented strong class="ag-heartbeat-record-compact-detail__tabs" role="tablist" aria-label="Compact detail tabs">
      <Button
        id={compactTabIds.new}
        type="button"
        role="tab"
        active={compactTab === "new"}
        aria-selected={compactTab === "new"}
        aria-controls={compactPanelId}
        tabindex={compactTab === "new" ? 0 : -1}
        text="New Context"
        onClick={() => (compactTab = "new")}
      />
      <Button
        id={compactTabIds.old}
        type="button"
        role="tab"
        active={compactTab === "old"}
        aria-selected={compactTab === "old"}
        aria-controls={compactPanelId}
        tabindex={compactTab === "old" ? 0 : -1}
        text="Old Context"
        onClick={() => (compactTab = "old")}
      />
    </Segmented>

    <div id={compactPanelId} class="ag-heartbeat-record-compact-detail__panel" role="tabpanel" aria-labelledby={compactTab === "new" ? compactTabIds.new : compactTabIds.old}>
      {#if compactTab === "new" && compactError !== null}
        <div class="ag-heartbeat-record-compact-detail__error">{formatHeartbeatRecordPayload(compactError)}</div>
      {/if}

      {#if compactState === "running" && compactTab === "new"}
        <div class="ag-heartbeat-record-compact-detail__streaming">streaming</div>
      {/if}

      {#if compactSource}
        <pre class="ag-heartbeat-record-compact-detail__source">{compactSource}</pre>
      {:else}
        <div class="ag-heartbeat-record-compact-detail__empty ag-heartbeat-record-compact-detail__empty--pulse">
          {compactTab === "new" ? "0 chunks" : "No snapshot"}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .ag-heartbeat-record-compact {
    position: relative;
    display: block;
    block-size: 34px;
    border-radius: 999px;
    background: #eef2f7;
    overflow: hidden;
  }

  .ag-heartbeat-record-compact::after {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    inline-size: 34%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.76), transparent);
    opacity: 0;
    pointer-events: none;
  }

  .ag-heartbeat-record-compact__before,
  .ag-heartbeat-record-compact__after {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
  }

  .ag-heartbeat-record-compact__before {
    background: color-mix(in oklab, var(--kind-pending, #b45309), white 88%);
  }

  .ag-heartbeat-record-compact__after {
    background: color-mix(in oklab, var(--kind-thinking, #0f766e), white 22%);
  }

  .ag-heartbeat-record-compact__core {
    position: absolute;
    inset: 50% auto auto 50%;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--tone-border, #d9e1ea);
    border-radius: 999px;
    background: #fff;
    padding: 6px 10px;
    color: #344054;
    font: 760 11px/1 system-ui, sans-serif;
    line-height: 1;
    transform: translate(-50%, -50%);
    white-space: nowrap;
  }

  .ag-heartbeat-record-compact__core :global(svg) {
    flex: 0 0 auto;
  }

  .ag-heartbeat-record-compact--running {
    background: color-mix(in oklab, var(--kind-pending, #b45309), white 91%);
  }

  .ag-heartbeat-record-compact--running::after {
    opacity: 1;
    animation: ag-heartbeat-record-compact-sheen 1.9s ease-in-out infinite;
  }

  .ag-heartbeat-record-compact--running .ag-heartbeat-record-compact__after {
    background: color-mix(in oklab, var(--kind-pending, #b45309), white 35%);
  }

  .ag-heartbeat-record-compact--running .ag-heartbeat-record-compact__core {
    border-color: color-mix(in oklab, var(--kind-pending, #b45309), white 55%);
    color: color-mix(in oklab, var(--kind-pending, #b45309), black 14%);
    animation: ag-heartbeat-record-compact-breathe 2.2s ease-in-out infinite;
  }

  .ag-heartbeat-record-compact--running .ag-heartbeat-record-compact__core :global(svg) {
    animation: ag-heartbeat-record-compact-spin 1.6s linear infinite;
  }

  .ag-heartbeat-record-compact--error {
    background: color-mix(in oklab, var(--kind-error, #dc2626), white 92%);
  }

  .ag-heartbeat-record-compact--error .ag-heartbeat-record-compact__after {
    background: color-mix(in oklab, var(--kind-error, #dc2626), white 38%);
  }

  .ag-heartbeat-record-compact--error .ag-heartbeat-record-compact__core {
    border-color: color-mix(in oklab, var(--kind-error, #dc2626), white 55%);
    color: color-mix(in oklab, var(--kind-error, #dc2626), black 10%);
  }

  .ag-heartbeat-record-compact-detail {
    display: grid;
    gap: 10px;
    min-inline-size: 0;
  }

  .ag-heartbeat-record-compact-detail__object {
    min-inline-size: 0;
  }

  :global(.ag-heartbeat-record-compact-detail__tabs) {
    inline-size: 100%;
  }

  :global(.ag-heartbeat-record-compact-detail__tabs .button) {
    min-inline-size: 0;
    font: 600 11px/1.1 system-ui, sans-serif;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.ag-heartbeat-record-compact-detail__tabs .button-active) {
    color: color-mix(in oklab, var(--tone-accent, #2563eb), black 15%);
  }

  .ag-heartbeat-record-compact-detail__error {
    border: 1px solid color-mix(in oklab, var(--kind-error, #dc2626), white 58%);
    border-radius: 13px;
    background: color-mix(in oklab, var(--kind-error, #dc2626), white 94%);
    color: color-mix(in oklab, var(--kind-error, #dc2626), black 10%);
    padding: 10px;
    font: 12px/1.5 system-ui, sans-serif;
  }

  .ag-heartbeat-record-compact-detail__streaming {
    justify-self: start;
    border: 1px dashed color-mix(in srgb, currentColor, transparent 76%);
    border-radius: 999px;
    padding: 0.22rem 0.56rem;
    color: color-mix(in srgb, currentColor, transparent 34%);
    font: 700 0.72rem/1.15 system-ui, sans-serif;
    animation: ag-heartbeat-record-compact-breathe 1.6s ease-in-out infinite;
  }

  .ag-heartbeat-record-compact-detail__source {
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: auto;
    border: 1px solid color-mix(in srgb, currentColor, transparent 90%);
    border-radius: 12px;
    margin: 0;
    background: color-mix(in srgb, Canvas, currentColor 3%);
    padding: 10px;
    font: 11.5px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .ag-heartbeat-record-compact-detail__empty {
    display: grid;
    place-items: center;
    min-height: 86px;
    border: 1px dashed color-mix(in oklab, var(--tone-accent, #2563eb), white 62%);
    border-radius: 13px;
    color: color-mix(in srgb, currentColor, transparent 42%);
    font: 12px/1.5 system-ui, sans-serif;
    animation: ag-heartbeat-record-compact-breathe 2.8s ease-in-out infinite;
  }

  @keyframes ag-heartbeat-record-compact-sheen {
    0% {
      transform: translateX(-120%);
    }
    100% {
      transform: translateX(220%);
    }
  }

  @keyframes ag-heartbeat-record-compact-breathe {
    0%,
    100% {
      opacity: 0.76;
      transform: translateY(0);
    }
    50% {
      opacity: 1;
      transform: translateY(-1px);
    }
  }

  @keyframes ag-heartbeat-record-compact-spin {
    100% {
      transform: rotate(360deg);
    }
  }
</style>
