<script lang="ts">
  import { Block, BlockTitle, Link, List, ListInput, PageContent, Sheet, Toolbar } from "../../../src/framework7-components";
  import { useHeartbeatExampleState } from "./heartbeat-example-context";

  const state = useHeartbeatExampleState();
  const opened = $derived(state.connectionSheetOpen);
  const connectionError = $derived(state.error ?? state.connectionState.error);
  const connectionLocked = $derived(state.connectionPhase === "connecting" || state.connectionPhase === "success");

  const connect = (): void => {
    void state.connect();
  };
</script>

{#if connectionError}
  <span class="heartbeat-connection-sheet__sr-error" aria-live="polite">{connectionError}</span>
{/if}
<span
  class="heartbeat-connection-sheet__sr-error"
  data-connection-open={opened ? "true" : "false"}
  data-connection-phase={state.connectionPhase}
  aria-hidden="true"
></span>

<Sheet
  class="heartbeat-connection-sheet"
  data-connection-open={opened ? "true" : "false"}
  data-connection-phase={state.connectionPhase}
  {opened}
  backdrop
  push
  style="height: auto; max-height: min(92vh, 640px)"
  closeByBackdropClick={state.connectionState.connected}
  swipeToClose={state.connectionState.connected}
  onSheetClosed={() => state.requestConnectionSheetClosed()}
>
  <Toolbar class="heartbeat-connection-sheet__toolbar">
    <span class="heartbeat-connection-sheet__title">Connection</span>
    {#if state.connectionState.connected}
      <Link sheetClose iconOnly iconF7="xmark" aria-label="Close connection settings" tooltip="Close" />
    {/if}
  </Toolbar>

  <PageContent class="heartbeat-connection-sheet__content">
    <BlockTitle>Agenter target</BlockTitle>
    <List strongIos insetIos dividersIos>
      <ListInput
        label="Endpoint"
        type="text"
        inputmode="url"
        spellcheck="false"
        disabled={connectionLocked}
        bind:value={state.wsUrl}
      />
      <ListInput label="Mode" type="select" disabled={connectionLocked} bind:value={state.mode}>
        <option value="readonly">readonly</option>
        <option value="configable">configable</option>
      </ListInput>
      <ListInput
        label="Auth token"
        type="password"
        autocomplete="off"
        disabled={connectionLocked}
        bind:value={state.authToken}
      />
    </List>

    {#if state.connectionPhase === "connecting" || state.connectionPhase === "success"}
      <Block strong class={`heartbeat-connection-sheet__state heartbeat-connection-sheet__state--${state.connectionPhase}`}>
        <span class="heartbeat-connection-sheet__state-icon" aria-hidden="true">
          <span></span>
        </span>
        <span>{state.connectionPhase === "success" ? "Connected" : "Connecting to Agenter"}</span>
      </Block>
    {/if}

    {#if connectionError}
      <Block strong class="heartbeat-connection-sheet__error">{connectionError}</Block>
    {/if}

    <Block>
      <button
        type="button"
        class="button button-fill button-large button-round"
        disabled={connectionLocked}
        onclick={connect}
      >
        {state.connectionPhase === "success" ? "Connected" : state.connectionState.connected ? "Reconnect" : "Connect"}
      </button>
    </Block>
  </PageContent>
</Sheet>

<style>
  .heartbeat-connection-sheet__sr-error {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
