<script lang="ts">
  import { Navbar, NavLeft, NavTitle, Page } from "framework7-svelte";

  import HeartbeatView from "./HeartbeatView.svelte";
  import type { HeartbeatCapabilityMode, HeartbeatViewCallbacks, HeartbeatViewState } from "./types";

  let {
    state: viewState,
    mode = "readonly",
    avatarLabel = "Avatar",
    sessionIconUrl = null,
    callbacks = {},
  }: {
    state: HeartbeatViewState;
    mode?: HeartbeatCapabilityMode;
    avatarLabel?: string;
    sessionIconUrl?: string | null;
    callbacks?: HeartbeatViewCallbacks;
  } = $props();
</script>

<Page name="heartbeat" pageContent={false}>
  <Navbar>
    <NavLeft backLink="Back" />
    <NavTitle>{avatarLabel} Heartbeat</NavTitle>
  </Navbar>
  <div class="ag-heartbeat-page__body">
    <HeartbeatView state={viewState} {mode} {avatarLabel} {sessionIconUrl} {callbacks} />
  </div>
</Page>

<style>
  :global(.ag-heartbeat-page) {
    display: grid;
  }

  .ag-heartbeat-page__body {
    block-size: 100%;
    min-block-size: 0;
  }
</style>
