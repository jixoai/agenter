<script lang="ts">
  import HeartbeatView from "../../src/HeartbeatView.svelte";
  import { ensureFramework7Svelte } from "../../src/framework7-bootstrap";
  import { App } from "../../src/framework7-components";
  import type { HeartbeatCapabilityMode, HeartbeatViewCallbacks, HeartbeatViewState } from "../../src/types";

  let {
    state,
    mode = "readonly",
    avatarLabel = "Avatar",
    callbacks = {},
  }: {
    state: HeartbeatViewState;
    mode?: HeartbeatCapabilityMode;
    avatarLabel?: string;
    callbacks?: HeartbeatViewCallbacks;
  } = $props();

  ensureFramework7Svelte();
</script>

<App name="web-heartbeat-view-dom-test" theme="ios">
  <HeartbeatView {state} {mode} {avatarLabel} {callbacks} />
</App>
