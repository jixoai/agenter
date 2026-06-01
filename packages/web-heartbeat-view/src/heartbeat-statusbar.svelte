<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import type { HeartbeatAttentionFocusSummary, HeartbeatContextState, HeartbeatStatusState } from "./heartbeat-statusbar-state";
  import type { HeartbeatCapabilityMode, HeartbeatConfigActions, HeartbeatConfigBinding, HeartbeatConfigDraft } from "./types";

  let {
    mode,
    statusState,
    contextState,
    attentionSummary,
    groupCount,
    groupCountVisible = true,
    compactPending = false,
    configBinding = null,
    configLoading = false,
    configSaving = false,
    configError = null,
    actions = {},
  }: {
    mode: HeartbeatCapabilityMode;
    statusState: HeartbeatStatusState;
    contextState: HeartbeatContextState;
    attentionSummary: HeartbeatAttentionFocusSummary;
    groupCount: number;
    groupCountVisible?: boolean;
    compactPending?: boolean;
    configBinding?: HeartbeatConfigBinding | null;
    configLoading?: boolean;
    configSaving?: boolean;
    configError?: string | null;
    actions?: HeartbeatConfigActions;
  } = $props();

  let configOpen = $state(false);
  let draft = $state<HeartbeatConfigDraft | null>(null);

  // Write affordances are mode-gated UI capabilities; transport auth remains host-owned.
  const compactAvailable = $derived(mode === "configable" && actions.compact?.available === true && actions.onRequestCompact);
  const configAvailable = $derived(mode === "configable" && actions.config?.available === true && actions.onSaveConfig && configBinding);
  const contextLabel = $derived.by(() => {
    if (contextState.kind === "absent") {
      return "No model call";
    }
    if (contextState.kind === "unavailable") {
      return contextState.providerLabel ? `${contextState.providerLabel} · usage unavailable` : "Usage unavailable";
    }
    const max = contextState.maxContextTokens ? ` / ${contextState.maxContextTokens}` : "";
    return `${contextState.usedTokens}${max} tokens`;
  });
  const attentionLabel = $derived(
    attentionSummary.total > 0 ? attentionSummary.labelParts.join(" · ") : "No attention contexts",
  );

  const openConfig = (): void => {
    if (!configBinding) {
      return;
    }
    draft = { ...configBinding.draft };
    configOpen = true;
  };

  const saveConfig = async (): Promise<void> => {
    if (!draft || !actions.onSaveConfig) {
      return;
    }
    const ok = await actions.onSaveConfig(draft);
    if (ok) {
      configOpen = false;
    }
  };
</script>

<footer class="ag-heartbeat-statusbar" data-testid="heartbeat-statusbar">
  <div class="ag-heartbeat-status" data-tone={statusState.tone}>
    <span class:active={statusState.animated}></span>
    <strong>{statusState.label}</strong>
    {#if statusState.detail}
      <small>{statusState.detail}</small>
    {/if}
  </div>

  <div class="ag-heartbeat-statusbar__middle">
    <span>{contextLabel}</span>
    <span>{attentionLabel}</span>
  </div>

  <div class="ag-heartbeat-statusbar__actions">
    {#if groupCountVisible}
      <span class="ag-heartbeat-pill">{groupCount} groups</span>
    {/if}
    {#if compactAvailable}
      <button type="button" disabled={compactPending} onclick={() => void actions.onRequestCompact?.()} title="Request compact">
        {#if compactPending}
          <span class="ag-heartbeat-spin">
            <LoaderCircle size={15} />
          </span>
        {:else}
          <Sparkles size={15} />
        {/if}
        <span>{compactPending ? "Compacting" : "Compact"}</span>
      </button>
    {/if}
    {#if configAvailable}
      <button type="button" disabled={configLoading || configSaving} onclick={openConfig} title="Configure next call">
        <Settings2 size={15} />
        <span>Config</span>
      </button>
    {/if}
  </div>
</footer>

{#if configOpen && draft}
  <div class="ag-heartbeat-config-sheet" data-testid="heartbeat-config-sheet">
    <div class="ag-heartbeat-config-sheet__panel">
      <header>
        <strong>Next call config</strong>
        <button type="button" onclick={() => (configOpen = false)}>Close</button>
      </header>
      {#if configError}
        <p class="ag-heartbeat-config-error">{configError}</p>
      {/if}
      <label>
        Temperature
        <input
          type="number"
          step="0.1"
          value={draft.temperature ?? ""}
          oninput={(event) => {
            const value = event.currentTarget.value.trim();
            draft = { ...draft!, temperature: value.length > 0 ? Number(value) : null };
          }}
        />
      </label>
      <label>
        Top K
        <input
          type="number"
          step="1"
          value={draft.topK ?? ""}
          oninput={(event) => {
            const value = event.currentTarget.value.trim();
            draft = { ...draft!, topK: value.length > 0 ? Number(value) : null };
          }}
        />
      </label>
      <label>
        Max tokens
        <input
          type="number"
          step="1"
          value={draft.maxToken ?? ""}
          oninput={(event) => {
            const value = event.currentTarget.value.trim();
            draft = { ...draft!, maxToken: value.length > 0 ? Number(value) : null };
          }}
        />
      </label>
      <label class="ag-heartbeat-checkbox">
        <input
          type="checkbox"
          checked={draft.thinkingEnabled}
          onchange={(event) => {
            draft = { ...draft!, thinkingEnabled: event.currentTarget.checked };
          }}
        />
        Thinking
      </label>
      <div class="ag-heartbeat-config-sheet__actions">
        <button type="button" onclick={() => void actions.onRefreshConfig?.()} disabled={configLoading}>Refresh</button>
        <button type="button" onclick={() => void saveConfig()} disabled={configSaving}>Save</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .ag-heartbeat-statusbar {
    display: grid;
    gap: 0.55rem;
    border-block-start: 1px solid color-mix(in srgb, currentColor, transparent 86%);
    background: color-mix(in srgb, Canvas, currentColor 2%);
    padding: 0.55rem max(0.75rem, env(safe-area-inset-left)) max(0.55rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-right));
  }

  .ag-heartbeat-status,
  .ag-heartbeat-statusbar__middle,
  .ag-heartbeat-statusbar__actions {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.45rem;
  }

  .ag-heartbeat-status span {
    inline-size: 0.52rem;
    block-size: 0.52rem;
    border-radius: 999px;
    background: currentColor;
    opacity: 0.45;
  }

  .ag-heartbeat-status span.active {
    opacity: 1;
    animation: ag-heartbeat-pulse 1.4s ease-in-out infinite;
  }

  .ag-heartbeat-status small,
  .ag-heartbeat-statusbar__middle {
    color: color-mix(in srgb, currentColor, transparent 42%);
    font: 0.74rem/1.25 system-ui, sans-serif;
  }

  .ag-heartbeat-statusbar__middle {
    flex-wrap: wrap;
  }

  .ag-heartbeat-statusbar__middle span + span::before {
    content: "· ";
  }

  .ag-heartbeat-statusbar__actions {
    justify-content: space-between;
  }

  .ag-heartbeat-pill,
  .ag-heartbeat-statusbar__actions button {
    border: 1px solid color-mix(in srgb, currentColor, transparent 84%);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    padding: 0.28rem 0.58rem;
    font: 600 0.75rem/1.1 system-ui, sans-serif;
  }

  .ag-heartbeat-statusbar__actions button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .ag-heartbeat-config-sheet {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    align-items: end;
    background: color-mix(in srgb, CanvasText, transparent 72%);
  }

  .ag-heartbeat-config-sheet__panel {
    display: grid;
    gap: 0.75rem;
    border-radius: 18px 18px 0 0;
    background: Canvas;
    padding: 1rem max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  }

  .ag-heartbeat-config-sheet__panel header,
  .ag-heartbeat-config-sheet__actions {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
  }

  .ag-heartbeat-config-sheet label {
    display: grid;
    gap: 0.25rem;
    font: 600 0.78rem/1.3 system-ui, sans-serif;
  }

  .ag-heartbeat-config-sheet input[type="number"] {
    border: 1px solid color-mix(in srgb, currentColor, transparent 82%);
    border-radius: 10px;
    padding: 0.55rem;
    font: inherit;
  }

  .ag-heartbeat-checkbox {
    grid-template-columns: auto 1fr;
    align-items: center;
  }

  .ag-heartbeat-config-error {
    margin: 0;
    color: #a11;
    font: 0.78rem/1.4 system-ui, sans-serif;
  }

  .ag-heartbeat-spin {
    display: inline-grid;
    place-items: center;
    animation: ag-heartbeat-spin 1s linear infinite;
  }

  @keyframes ag-heartbeat-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes ag-heartbeat-pulse {
    50% {
      opacity: 0.35;
    }
  }

  @media (min-width: 760px) {
    .ag-heartbeat-statusbar {
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
    }

    .ag-heartbeat-statusbar__actions {
      justify-content: end;
    }
  }
</style>
