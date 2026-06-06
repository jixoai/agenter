<script lang="ts">
  import HeartbeatRecordIcon from "./heartbeat-record-icon.svelte";
  import { formatHeartbeatRecordPayload, indentHeartbeatYaml, readHeartbeatRecordPayloadValue } from "./heartbeat-record-detail-model";
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

  type ConfigTab = "diff" | "new" | "old";

  let configTab = $state<ConfigTab>("diff");
  const configTabIds = Object.freeze({
    diff: "ag-heartbeat-record-config-tab-diff",
    new: "ag-heartbeat-record-config-tab-new",
    old: "ag-heartbeat-record-config-tab-old",
  });
  const configPanelId = "ag-heartbeat-record-config-panel";

  const readNumber = (value: unknown, fallback: number): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    return fallback;
  };

  const providerLabel = $derived.by(() => {
    const provider = readHeartbeatRecordPayloadValue(payload, ["provider", "modelProvider", "providerLabel"]);
    const model = readHeartbeatRecordPayloadValue(payload, ["model", "modelName", "modelId"]);
    const rendered = [provider, model].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" · ");
    return rendered.length > 0 ? rendered : "openai · gpt-5.1";
  });
  const scopeLabel = $derived.by(() => {
    const scope = readHeartbeatRecordPayloadValue(payload, ["scope", "layer", "binding", "target"]);
    if (typeof scope === "string" && scope.trim().length > 0) {
      return scope;
    }
    return "next-call knobs";
  });
  const stateLabel = $derived(
    record.status === "error" ? "error" : record.status === "running" ? "saving" : "applied",
  );
  const temperature = $derived(readNumber(readHeartbeatRecordPayloadValue(payload, ["temperature"]), 0.4));
  const topK = $derived(readNumber(readHeartbeatRecordPayloadValue(payload, ["topk", "topK"]), 32));
  const maxToken = $derived(readNumber(readHeartbeatRecordPayloadValue(payload, ["maxtoken", "maxToken"]), 8192));
  const thinkingEnabled = $derived.by(() => {
    const value = readHeartbeatRecordPayloadValue(payload, ["thinking", "thinkingEnabled"]);
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return ["on", "true", "1", "yes"].includes(value.toLowerCase());
    }
    return true;
  });
  const thinkingBudget = $derived(readNumber(readHeartbeatRecordPayloadValue(payload, ["thinking-budget", "thinkingBudget"]), 2048));
  const oldConfig = $derived(readHeartbeatRecordPayloadValue(payload, ["oldConfig", "old", "before", "previousConfig"]) ?? null);
  const newConfig = $derived(readHeartbeatRecordPayloadValue(payload, ["newConfig", "new", "after", "config", "value"]) ?? payload);
  const diffConfig = $derived(readHeartbeatRecordPayloadValue(payload, ["diff", "changes"]) ?? null);
  const configSource = $derived.by(() => {
    if (configTab === "new") {
      return formatHeartbeatRecordPayload(newConfig);
    }
    if (configTab === "old") {
      return oldConfig === null ? "" : formatHeartbeatRecordPayload(oldConfig);
    }
    if (diffConfig !== null) {
      return formatHeartbeatRecordPayload(diffConfig);
    }
    return [
      "old:",
      oldConfig === null ? "  null" : indentHeartbeatYaml(formatHeartbeatRecordPayload(oldConfig)),
      "new:",
      indentHeartbeatYaml(formatHeartbeatRecordPayload(newConfig)),
    ].join("\n");
  });
</script>

{#if variant === "card"}
  <div class="ag-heartbeat-record-config" data-state={stateLabel} title={title}>
    <div class="ag-heartbeat-record-config__topline">
      <span class="ag-heartbeat-record-config__provider-pill" title="Active provider and model">
        <HeartbeatRecordIcon kind="config" size={14} />
        <span>{providerLabel}</span>
      </span>
    </div>

    <div class="ag-heartbeat-record-config__field-grid">
      <span class="ag-heartbeat-record-config__field ag-heartbeat-record-config__field--temperature" title="Next-call temperature">
        <span class="ag-heartbeat-record-config__field-label">
          <HeartbeatRecordIcon kind="tool" size={14} />
          <span>temperature</span>
        </span>
        <span class="ag-heartbeat-record-config__field-value">{temperature.toFixed(1)}</span>
      </span>
      <span class="ag-heartbeat-record-config__field ag-heartbeat-record-config__field--topk" title="Next-call top-k">
        <span class="ag-heartbeat-record-config__field-label">
          <HeartbeatRecordIcon kind="video" size={14} />
          <span>top-k</span>
        </span>
        <span class="ag-heartbeat-record-config__field-value">{Math.round(topK)}</span>
      </span>
      <span class="ag-heartbeat-record-config__field ag-heartbeat-record-config__field--maxtoken" title="Next-call max token budget">
        <span class="ag-heartbeat-record-config__field-label">
          <HeartbeatRecordIcon kind="text" size={14} />
          <span>max tokens</span>
        </span>
        <span class="ag-heartbeat-record-config__field-value">{Math.round(maxToken).toLocaleString()}t</span>
      </span>
      <span class="ag-heartbeat-record-config__field ag-heartbeat-record-config__field--thinking" title="Thinking mode">
        <span class="ag-heartbeat-record-config__field-label">
          <HeartbeatRecordIcon kind="thinking" size={14} />
          <span>thinking</span>
        </span>
        <span class="ag-heartbeat-record-config__field-value">{thinkingEnabled ? "on" : "off"}</span>
      </span>
      <span class="ag-heartbeat-record-config__field ag-heartbeat-record-config__field--budget" title="Thinking budget tokens">
        <span class="ag-heartbeat-record-config__field-label">
          <HeartbeatRecordIcon kind="pending" size={14} />
          <span>budget</span>
        </span>
        <span class="ag-heartbeat-record-config__field-value">{Math.round(thinkingBudget).toLocaleString()}t</span>
      </span>
    </div>
  </div>
{:else}
  <div class="ag-heartbeat-record-config-detail" data-record-body="config">
    <div class="ag-heartbeat-record-config-detail__tabs" role="tablist" aria-label="Config detail tabs">
      <button
        id={configTabIds.diff}
        type="button"
        role="tab"
        class:active={configTab === "diff"}
        aria-selected={configTab === "diff"}
        aria-controls={configPanelId}
        tabindex={configTab === "diff" ? 0 : -1}
        onclick={() => (configTab = "diff")}
      >
        Diff Config
      </button>
      <button
        id={configTabIds.new}
        type="button"
        role="tab"
        class:active={configTab === "new"}
        aria-selected={configTab === "new"}
        aria-controls={configPanelId}
        tabindex={configTab === "new" ? 0 : -1}
        onclick={() => (configTab = "new")}
      >
        New Config
      </button>
      <button
        id={configTabIds.old}
        type="button"
        role="tab"
        class:active={configTab === "old"}
        aria-selected={configTab === "old"}
        aria-controls={configPanelId}
        tabindex={configTab === "old" ? 0 : -1}
        onclick={() => (configTab = "old")}
      >
        Old Config
      </button>
    </div>

    <div id={configPanelId} class="ag-heartbeat-record-config-detail__panel" role="tabpanel" aria-labelledby={configTabIds[configTab]}>
      {#if configSource}
        <pre class="ag-heartbeat-record-config-detail__source">{configSource}</pre>
      {:else}
        <div class="ag-heartbeat-record-config-detail__empty">No config snapshot</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .ag-heartbeat-record-config {
    display: grid;
    gap: 10px;
    min-inline-size: 0;
  }

  .ag-heartbeat-record-config[data-state="saving"] .ag-heartbeat-record-config__provider-pill {
    background-image: linear-gradient(
      100deg,
      color-mix(in oklch, var(--kind-pending, #b45309), white 82%) 18%,
      color-mix(in oklch, var(--kind-pending, #b45309), white 92%) 46%,
      color-mix(in oklch, var(--kind-pending, #b45309), white 82%) 72%
    );
    background-size: 220% 100%;
    animation: ag-heartbeat-record-config-shine 2.2s linear infinite, ag-heartbeat-record-config-breathe 2.4s ease-in-out infinite;
  }

  .ag-heartbeat-record-config[data-state="unavailable"] {
    opacity: 0.84;
  }

  .ag-heartbeat-record-config[data-state="unavailable"] .ag-heartbeat-record-config__field {
    opacity: 0.72;
  }

  .ag-heartbeat-record-config__topline {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    min-inline-size: 0;
  }

  .ag-heartbeat-record-config__provider-pill,
  .ag-heartbeat-record-config__field {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-inline-size: 0;
    max-inline-size: 100%;
    border: 1px solid color-mix(in srgb, currentColor, transparent 86%);
    border-radius: 999px;
    background: #fff;
    padding: 5px 8px;
    color: color-mix(in srgb, currentColor, transparent 16%);
    font: 600 10.5px/1 system-ui, sans-serif;
    white-space: nowrap;
  }

  .ag-heartbeat-record-config__provider-pill {
    border-color: color-mix(in oklab, var(--tone-accent, #2563eb), white 72%);
    background: color-mix(in oklab, var(--tone-accent, #2563eb), white 94%);
    color: color-mix(in oklab, var(--tone-accent, #2563eb), black 16%);
  }

  .ag-heartbeat-record-config__field-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
    min-inline-size: 0;
  }

  .ag-heartbeat-record-config__field {
    justify-content: space-between;
    padding-inline: 9px;
  }

  .ag-heartbeat-record-config__field--temperature {
    background: color-mix(in oklab, var(--kind-tool, #b45309), white 94%);
    border-color: color-mix(in oklab, var(--kind-tool, #b45309), white 72%);
    color: color-mix(in oklab, var(--kind-tool, #b45309), black 14%);
  }

  .ag-heartbeat-record-config__field--topk {
    background: color-mix(in oklab, var(--kind-video, #4f46e5), white 94%);
    border-color: color-mix(in oklab, var(--kind-video, #4f46e5), white 74%);
    color: color-mix(in oklab, var(--kind-video, #4f46e5), black 14%);
  }

  .ag-heartbeat-record-config__field--maxtoken {
    background: color-mix(in oklab, var(--kind-text, #2563eb), white 94%);
    border-color: color-mix(in oklab, var(--kind-text, #2563eb), white 74%);
    color: color-mix(in oklab, var(--kind-text, #2563eb), black 14%);
  }

  .ag-heartbeat-record-config__field--thinking {
    background: color-mix(in oklab, var(--kind-thinking, #0f766e), white 94%);
    border-color: color-mix(in oklab, var(--kind-thinking, #0f766e), white 74%);
    color: color-mix(in oklab, var(--kind-thinking, #0f766e), black 14%);
  }

  .ag-heartbeat-record-config__field--budget {
    background: color-mix(in oklab, var(--kind-pending, #b45309), white 94%);
    border-color: color-mix(in oklab, var(--kind-pending, #b45309), white 74%);
    color: color-mix(in oklab, var(--kind-pending, #b45309), black 14%);
  }

  .ag-heartbeat-record-config__field-label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-inline-size: 0;
  }

  .ag-heartbeat-record-config__field-value {
    overflow: hidden;
    min-inline-size: 0;
    text-overflow: ellipsis;
    color: inherit;
  }

  .ag-heartbeat-record-config-detail {
    display: grid;
    gap: 10px;
    min-inline-size: 0;
  }

  .ag-heartbeat-record-config-detail__tabs {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .ag-heartbeat-record-config-detail__tabs button {
    overflow: hidden;
    border: 1px solid color-mix(in srgb, currentColor, transparent 86%);
    border-radius: 999px;
    background: #fbfcfe;
    color: color-mix(in srgb, currentColor, transparent 34%);
    padding: 0.35rem 0.5rem;
    font: 600 11px/1.1 system-ui, sans-serif;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-config-detail__tabs button.active,
  .ag-heartbeat-record-config-detail__tabs button[aria-selected="true"] {
    border-color: color-mix(in oklab, var(--tone-accent, #2563eb), white 55%);
    background: color-mix(in oklab, var(--tone-accent, #2563eb), white 92%);
    color: color-mix(in oklab, var(--tone-accent, #2563eb), black 15%);
  }

  .ag-heartbeat-record-config-detail__source {
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

  .ag-heartbeat-record-config-detail__empty {
    display: grid;
    place-items: center;
    min-height: 86px;
    border: 1px dashed color-mix(in oklab, var(--tone-accent, #2563eb), white 62%);
    border-radius: 13px;
    color: color-mix(in srgb, currentColor, transparent 42%);
    font: 12px/1.5 system-ui, sans-serif;
    animation: ag-heartbeat-record-config-breathe 2.8s ease-in-out infinite;
  }

  @keyframes ag-heartbeat-record-config-breathe {
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

  @keyframes ag-heartbeat-record-config-shine {
    0% {
      background-position: 120% center;
    }
    100% {
      background-position: -120% center;
    }
  }
</style>
