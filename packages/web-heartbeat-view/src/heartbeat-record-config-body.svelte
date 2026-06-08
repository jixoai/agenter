<script lang="ts">
  import Binary from "@lucide/svelte/icons/binary";
  import Brain from "@lucide/svelte/icons/brain";
  import FileText from "@lucide/svelte/icons/file-text";
  import Hourglass from "@lucide/svelte/icons/hourglass";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
  import Thermometer from "@lucide/svelte/icons/thermometer";

  import {
    formatHeartbeatRecordPayload,
    indentHeartbeatYaml,
    isHeartbeatRecordPayload,
    readHeartbeatRecordPayloadValue,
  } from "./heartbeat-record-detail-model";
  import type { HeartbeatRecordItem } from "./types";

  type ConfigTab = "diff" | "new" | "old";

  let {
    record,
    payload = null,
    variant = "card",
    title,
    detailTab = "diff",
    tabPanelId = "ag-heartbeat-record-config-panel",
    tabPanelLabelledBy = undefined,
  }: {
    record: HeartbeatRecordItem;
    payload?: unknown;
    variant?: "card" | "detail";
    title: string;
    detailTab?: ConfigTab;
    tabPanelId?: string;
    tabPanelLabelledBy?: string | undefined;
  } = $props();

  type ConfigControlIcon = "temperature" | "topK" | "maxToken" | "thinking" | "budget" | "systemPrompt";
  type ConfigControlEntry = {
    key: string;
    label: string;
    title: string;
    value: string;
    icon: ConfigControlIcon;
    className: string;
  };
  type ConfigControlDefinition = {
    key: string;
    label: string;
    title: string;
    keys: readonly string[];
    icon: ConfigControlIcon;
    className: string;
    format: (value: unknown) => string;
  };
  type ConfigSyntaxLine = {
    kind: "meta" | "remove" | "add" | "context";
    raw: string;
    key: string | null;
    value: string | null;
  };

  const formatControlScalar = (value: unknown): string => formatHeartbeatRecordPayload(value).replaceAll(/\s+/gu, " ").trim();

  const readNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    return null;
  };

  const formatControlNumber = (value: unknown, suffix = ""): string => {
    const numberValue = readNumber(value);
    if (numberValue === null) {
      return formatControlScalar(value);
    }
    const rounded = Number.isInteger(numberValue)
      ? Math.round(numberValue).toLocaleString()
      : numberValue.toFixed(1);
    return `${rounded}${suffix}`;
  };

  const formatControlBoolean = (value: unknown): string => {
    if (typeof value === "boolean") {
      return value ? "on" : "off";
    }
    if (typeof value === "string") {
      const normalized = value.toLowerCase();
      if (["on", "true", "1", "yes"].includes(normalized)) {
        return "on";
      }
      if (["off", "false", "0", "no"].includes(normalized)) {
        return "off";
      }
      return formatControlScalar(value);
    }
    return formatControlScalar(value);
  };

  const formatPromptValue = (value: unknown): string => {
    const source = formatHeartbeatRecordPayload(value);
    return `${source.length.toLocaleString()}ch`;
  };

  const configControlDefinitions: readonly ConfigControlDefinition[] = [
    {
      key: "temperature",
      label: "temperature",
      title: "Next-call temperature",
      keys: ["temperature"],
      icon: "temperature",
      className: "temperature",
      format: (value) => formatControlNumber(value),
    },
    {
      key: "topK",
      label: "top-k",
      title: "Next-call top-k",
      keys: ["topk", "topK"],
      icon: "topK",
      className: "topk",
      format: (value) => formatControlNumber(value),
    },
    {
      key: "maxToken",
      label: "max tokens",
      title: "Next-call max token budget",
      keys: ["maxtoken", "maxToken", "maxTokens"],
      icon: "maxToken",
      className: "maxtoken",
      format: (value) => formatControlNumber(value, "t"),
    },
    {
      key: "thinking",
      label: "thinking",
      title: "Thinking mode",
      keys: ["thinking", "thinkingEnabled"],
      icon: "thinking",
      className: "thinking",
      format: formatControlBoolean,
    },
    {
      key: "thinkingBudget",
      label: "budget",
      title: "Thinking budget tokens",
      keys: ["thinking-budget", "thinkingBudget", "thinkingBudgetTokens"],
      icon: "budget",
      className: "budget",
      format: (value) => formatControlNumber(value, "t"),
    },
    {
      key: "systemPrompt",
      label: "system prompt",
      title: "System prompt content length",
      keys: ["systemPrompt", "system"],
      icon: "systemPrompt",
      className: "system-prompt",
      format: formatPromptValue,
    },
  ];

  const readConfigValue = (source: unknown, keys: readonly string[]): unknown => {
    if (!isHeartbeatRecordPayload(source)) {
      return undefined;
    }
    return readHeartbeatRecordPayloadValue(source, keys);
  };

  const hasConfigValue = (value: unknown): boolean => value !== undefined && value !== null;
  const compareConfigValue = (value: unknown): string => formatHeartbeatRecordPayload(value);

  const providerLabel = $derived.by(() => {
    const provider = readHeartbeatRecordPayloadValue(payload, ["provider", "modelProvider", "providerLabel"]);
    const model = readHeartbeatRecordPayloadValue(payload, ["model", "modelName", "modelId"]);
    const rendered = [provider, model]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" · ");
    return rendered.length > 0 ? rendered : "next-call config";
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
  const oldConfig = $derived(
    readHeartbeatRecordPayloadValue(payload, ["oldConfig", "old", "before", "previousConfig"]) ?? null,
  );
  const newConfig = $derived(
    readHeartbeatRecordPayloadValue(payload, ["newConfig", "new", "after", "config", "value"]) ?? payload,
  );
  const diffConfig = $derived(readHeartbeatRecordPayloadValue(payload, ["diff", "changes"]) ?? null);
  const configControls = $derived.by<ConfigControlEntry[]>(() =>
    configControlDefinitions.flatMap((definition) => {
      const directValue = readConfigValue(payload, definition.keys);
      const newValue = hasConfigValue(directValue) ? directValue : readConfigValue(newConfig, definition.keys);
      const oldValue = readConfigValue(oldConfig, definition.keys);
      if (!hasConfigValue(newValue)) {
        return [];
      }
      if (hasConfigValue(oldValue) && compareConfigValue(oldValue) === compareConfigValue(newValue)) {
        return [];
      }
      return [
        {
          key: definition.key,
          label: definition.label,
          title: definition.title,
          value: definition.format(newValue),
          icon: definition.icon,
          className: definition.className,
        },
      ];
    }),
  );
  const configSource = $derived.by(() => {
    if (detailTab === "new") {
      return formatHeartbeatRecordPayload(newConfig);
    }
    if (detailTab === "old") {
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
  const configSyntaxLines = $derived.by<ConfigSyntaxLine[]>(() =>
    configSource.split("\n").map((line) => {
      const kind =
        detailTab === "diff" && line.startsWith("@@")
          ? "meta"
          : detailTab === "diff" && line.startsWith("-")
            ? "remove"
            : detailTab === "diff" && line.startsWith("+")
              ? "add"
              : "context";
      const yamlKeyMatch = detailTab === "diff" ? null : /^(\s*[-\w.]+:)(.*)$/u.exec(line);
      return {
        kind,
        raw: line,
        key: yamlKeyMatch?.[1] ?? null,
        value: yamlKeyMatch?.[2] ?? null,
      };
    }),
  );
</script>

{#snippet configControlField(control: ConfigControlEntry)}
  <span
    class={`ag-heartbeat-record-config__field ag-heartbeat-record-config__field--${control.className}`}
    title={control.title}
  >
    <span class="ag-heartbeat-record-config__field-label">
      {#if control.icon === "temperature"}
        <Thermometer size={14} aria-hidden="true" />
      {:else if control.icon === "topK"}
        <SlidersHorizontal size={14} aria-hidden="true" />
      {:else if control.icon === "maxToken"}
        <Binary size={14} aria-hidden="true" />
      {:else if control.icon === "thinking"}
        <Brain size={14} aria-hidden="true" />
      {:else if control.icon === "budget"}
        <Hourglass size={14} aria-hidden="true" />
      {:else}
        <FileText size={14} aria-hidden="true" />
      {/if}
      <span>{control.label}</span>
    </span>
    <span class="ag-heartbeat-record-config__field-value">{control.value}</span>
  </span>
{/snippet}

{#if variant === "card"}
  <div class="ag-heartbeat-record-config" data-state={stateLabel} data-object-kind="config" title={title}>
    <div class="ag-heartbeat-record-config__topline">
      <span class="ag-heartbeat-record-config__provider-pill" title={`Active provider and model · ${scopeLabel}`}>
        <SlidersHorizontal size={14} aria-hidden="true" />
        <span>{providerLabel}</span>
      </span>
    </div>

    {#if configControls.length > 0}
      <div class="ag-heartbeat-record-config__field-grid">
        {#each configControls as control (control.key)}
          {@render configControlField(control)}
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <div class="ag-heartbeat-record-config-detail" data-record-body="config">
    <div class="ag-heartbeat-record-config-detail__object" data-object-kind="config" aria-label="Changed config controls">
      <div class="ag-heartbeat-record-config" data-state={stateLabel}>
        <div class="ag-heartbeat-record-config__topline">
          <span class="ag-heartbeat-record-config__provider-pill" title={`Active provider and model · ${scopeLabel}`}>
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>{providerLabel}</span>
          </span>
        </div>

        {#if configControls.length > 0}
          <div class="ag-heartbeat-record-config__field-grid">
            {#each configControls as control (control.key)}
              {@render configControlField(control)}
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div
      id={tabPanelId}
      class="ag-heartbeat-record-config-detail__panel"
      role="tabpanel"
      aria-labelledby={tabPanelLabelledBy}
    >
      {#if configSource}
        <pre class="ag-heartbeat-record-config-detail__source" data-language={detailTab === "diff" ? "diff" : "yaml"}>{#each configSyntaxLines as line, index (`${index}:${line.raw}`)}<span class={`ag-heartbeat-record-config-detail__syntax-line ag-heartbeat-record-config-detail__syntax-line--${line.kind}`}>{#if line.key !== null}<span class="ag-heartbeat-record-config-detail__syntax-key">{line.key}</span><span class="ag-heartbeat-record-config-detail__syntax-value">{line.value}</span>{:else}{line.raw || " "}{/if}</span>{/each}</pre>
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

  .ag-heartbeat-record-config__field--system-prompt {
    background: color-mix(in oklab, var(--kind-config, #9333ea), white 94%);
    border-color: color-mix(in oklab, var(--kind-config, #9333ea), white 74%);
    color: color-mix(in oklab, var(--kind-config, #9333ea), black 12%);
  }

  .ag-heartbeat-record-config__field-label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-inline-size: 0;
  }

  .ag-heartbeat-record-config__provider-pill :global(svg),
  .ag-heartbeat-record-config__field-label :global(svg) {
    flex: 0 0 auto;
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

  .ag-heartbeat-record-config-detail__object {
    min-inline-size: 0;
  }

  :global(.ag-heartbeat-record-config-detail__tabs) {
    inline-size: 100%;
  }

  :global(.ag-heartbeat-record-config-detail__tabs .button) {
    min-inline-size: 0;
    font: 600 11px/1.1 system-ui, sans-serif;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.ag-heartbeat-record-config-detail__tabs .button-active) {
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
    white-space: pre;
  }

  .ag-heartbeat-record-config-detail__syntax-line {
    display: block;
    min-inline-size: max-content;
    padding-inline: 2px;
  }

  .ag-heartbeat-record-config-detail__syntax-line--meta {
    color: color-mix(in srgb, currentColor, transparent 30%);
  }

  .ag-heartbeat-record-config-detail__syntax-line--remove {
    background: color-mix(in oklab, var(--kind-error, #dc2626), white 94%);
    color: color-mix(in oklab, var(--kind-error, #dc2626), black 4%);
  }

  .ag-heartbeat-record-config-detail__syntax-line--add {
    background: color-mix(in oklab, var(--kind-text, #2563eb), white 94%);
    color: color-mix(in oklab, var(--kind-text, #2563eb), black 12%);
  }

  .ag-heartbeat-record-config-detail__syntax-key {
    color: color-mix(in oklab, var(--kind-config, #9333ea), black 6%);
    font-weight: 760;
  }

  .ag-heartbeat-record-config-detail__syntax-value {
    color: #31445d;
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
