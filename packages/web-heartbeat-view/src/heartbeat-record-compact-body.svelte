<script lang="ts">
  import HeartbeatEntry from "./heartbeat-entry.svelte";
  import HeartbeatRecordIcon from "./heartbeat-record-icon.svelte";
  import { formatHeartbeatRecordPayload, readHeartbeatRecordPayloadValue } from "./heartbeat-record-detail-model";
  import { getHeartbeatGroupLabel, type HeartbeatSubjectSection } from "./heartbeat-parts";
  import type { HeartbeatRecordItem } from "./types";

  type CompactTab = "new" | "old";

  let {
    record,
    payload = null,
    sections = [],
    variant = "card",
    title,
    detailTab = "new",
    tabPanelId = "ag-heartbeat-record-compact-panel",
    tabPanelLabelledBy = undefined,
  }: {
    record: HeartbeatRecordItem;
    payload?: unknown;
    sections?: HeartbeatSubjectSection[];
    variant?: "card" | "detail";
    title: string;
    detailTab?: CompactTab;
    tabPanelId?: string;
    tabPanelLabelledBy?: string | undefined;
  } = $props();

  const resolveNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    return null;
  };

  const beforeValue = $derived(
    resolveNumber(readHeartbeatRecordPayloadValue(payload, ["before", "beforeContext", "beforeUsage", "beforePercent", "from"])),
  );
  const afterValue = $derived(
    resolveNumber(readHeartbeatRecordPayloadValue(payload, ["after", "afterContext", "afterUsage", "afterPercent", "to"])),
  );
  const normalizePercent = (value: number): number => (Math.abs(value) <= 1 ? value * 100 : value);
  const clampPercent = (value: number): number => Math.min(100, Math.max(0, normalizePercent(value)));
  const compactError = $derived(readHeartbeatRecordPayloadValue(payload, ["error", "message"]) ?? null);
  const newContext = $derived(
    readHeartbeatRecordPayloadValue(payload, ["newContext", "new", "after", "context", "text", "content"]) ??
      (payload === null ? null : payload),
  );
  const oldContext = $derived(readHeartbeatRecordPayloadValue(payload, ["oldContext", "old", "before", "previousContext"]) ?? null);
  const compactSource = $derived.by(() => {
    if (detailTab === "old") {
      return oldContext === null ? "" : formatHeartbeatRecordPayload(oldContext);
    }
    return newContext === null ? "" : formatHeartbeatRecordPayload(newContext);
  });
  const compactState = $derived(
    record.status === "error" ? "error" : record.status === "running" ? "running" : "completed",
  );
  const beforeWidth = $derived(beforeValue === null ? 100 : clampPercent(beforeValue));
  const afterWidth = $derived.by(() => {
    if (afterValue !== null) {
      return clampPercent(afterValue);
    }
    if (compactState === "error") {
      return beforeWidth;
    }
    if (compactState === "running") {
      return 42;
    }
    return 34;
  });
  const formatUsageValue = (value: number): string => `${normalizePercent(value).toFixed(1)}%`;
  const coreText = $derived.by(() => {
    if (beforeValue !== null && afterValue !== null) {
      return `${formatUsageValue(beforeValue)} -> ${formatUsageValue(afterValue)}`;
    }
    if (compactState === "error") {
      return beforeValue === null ? "error" : `${formatUsageValue(beforeValue)} -> error`;
    }
    if (compactState === "running") {
      return "streaming";
    }
    return "rebuilt";
  });
  const compactGroupLabel = $derived(
    getHeartbeatGroupLabel({
      id: record.id,
      groupId: record.recordKey,
      kind: "compact",
      aiCallId: record.primaryAiCallId,
      createdAt: record.startedAt,
      updatedAt: record.updatedAt,
      isComplete: record.isComplete,
      items: sections.flatMap((section) => section.entries),
    }),
  );
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
    <span class="ag-heartbeat-record-compact__before" style={`width:${beforeWidth}%`}></span>
    <span class="ag-heartbeat-record-compact__after" style={`width:${afterWidth}%`}></span>
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
        <span class="ag-heartbeat-record-compact__before" style={`width:${beforeWidth}%`}></span>
        <span class="ag-heartbeat-record-compact__after" style={`width:${afterWidth}%`}></span>
        <span class="ag-heartbeat-record-compact__core">
          <HeartbeatRecordIcon kind={compactState === "error" ? "error" : compactState === "running" ? "pending" : "compact"} size={15} />
          <span>{coreText}</span>
        </span>
      </div>
    </div>

    <div
      id={tabPanelId}
      class="ag-heartbeat-record-compact-detail__panel"
      role="tabpanel"
      aria-labelledby={tabPanelLabelledBy}
    >
      {#if detailTab === "new" && compactError !== null}
        <div class="ag-heartbeat-record-compact-detail__error">{formatHeartbeatRecordPayload(compactError)}</div>
      {/if}

      {#if compactState === "running" && detailTab === "new"}
        <div class="ag-heartbeat-record-compact-detail__streaming">streaming</div>
      {/if}

      {#if detailTab === "new" && sections.length > 0}
        <div class="ag-heartbeat-record-compact-detail__entries">
          {#each sections as section (section.key)}
            <HeartbeatEntry
              {section}
              layoutMode="detailed"
              groupLabel={compactGroupLabel}
              groupTimestamp={record.startedAt}
              presentation="compact-special"
              allowLayoutModeSwitch={false}
            />
          {/each}
        </div>
      {:else if compactSource}
        <pre class="ag-heartbeat-record-compact-detail__source">{compactSource}</pre>
      {:else}
        <div class="ag-heartbeat-record-compact-detail__empty ag-heartbeat-record-compact-detail__empty--pulse">
          {detailTab === "new" ? "0 chunks" : "No snapshot"}
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

  .ag-heartbeat-record-compact-detail__entries {
    display: grid;
    min-inline-size: 0;
    gap: 8px;
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
