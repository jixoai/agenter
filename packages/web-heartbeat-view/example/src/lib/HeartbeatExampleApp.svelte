<script lang="ts">
  import {
    HeartbeatView,
    type AgenterHeartbeatConnectionState,
    type GlobalAvatarCatalogEntry,
    type HeartbeatCapabilityMode,
    type HeartbeatTargetIdentity,
  } from "@agenter/web-heartbeat-view";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import { App, Block, Button, List, ListItem, Navbar, NavLeft, NavRight, NavTitle, Page, View } from "framework7-svelte";
  import { onDestroy, onMount } from "svelte";

  import { createClientSdkAgenterHeartbeatConnection, type ClientSdkAgenterHeartbeatConnection } from "./agenter-heartbeat-connection";
  import { defaultWsUrl, normalizeMode } from "./defaults";
  import { ensureFramework7 } from "./framework7";

  ensureFramework7();

  let {
    initialRuntimeId = null,
    initialMode = null,
    initialWsUrl = null,
  }: {
    initialRuntimeId?: string | null;
    initialMode?: string | null;
    initialWsUrl?: string | null;
  } = $props();

  let wsUrl = $state(defaultWsUrl);
  let authToken = $state("");
  let mode = $state<HeartbeatCapabilityMode>("readonly");
  let connection = $state<ClientSdkAgenterHeartbeatConnection | null>(null);
  let connectionState = $state<AgenterHeartbeatConnectionState | null>(null);
  let selectedTarget = $state<HeartbeatTargetIdentity | null>(null);
  let connecting = $state(false);
  let openingRuntimeId = $state<string | null>(null);
  let error = $state<string | null>(null);
  let unsubscribe: (() => void) | null = null;

  const connect = async (): Promise<void> => {
    connecting = true;
    error = null;
    unsubscribe?.();
    connection?.disconnect();
    const next = createClientSdkAgenterHeartbeatConnection({ wsUrl, authToken });
    connection = next;
    unsubscribe = next.subscribe((state) => {
      connectionState = state;
      selectedTarget = state.selectedTarget;
    });
    try {
      await next.connect();
      if (initialRuntimeId) {
        const avatar = next.state.avatars.data.find((entry) => entry.runtimeId === initialRuntimeId);
        if (avatar) {
          await openAvatar(avatar, false);
        } else {
          error = `Heartbeat target ${initialRuntimeId} was not returned by this Agenter target.`;
        }
      }
    } finally {
      connecting = false;
    }
  };

  const openAvatar = async (avatar: GlobalAvatarCatalogEntry, pushUrl = true): Promise<void> => {
    if (!connection) {
      return;
    }
    openingRuntimeId = avatar.runtimeId;
    error = null;
    try {
      const target = await connection.openAvatar({ avatar, autoStart: false });
      selectedTarget = target;
      if (pushUrl && typeof history !== "undefined") {
        const url = `/heartbeat/${encodeURIComponent(target.runtimeId)}?mode=${mode}&wsUrl=${encodeURIComponent(wsUrl)}`;
        history.pushState({ runtimeId: target.runtimeId }, "", url);
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    } finally {
      openingRuntimeId = null;
    }
  };

  const goBack = (): void => {
    selectedTarget = null;
    if (typeof history !== "undefined") {
      history.pushState({}, "", "/");
    }
  };

  const refreshSelectedHeartbeat = async (): Promise<void> => {
    const target = selectedTarget;
    const activeConnection = connection;
    if (!target || !activeConnection) {
      return;
    }
    await activeConnection.refreshHeartbeat(target);
  };

  const loadOlderSelectedHeartbeat = async (): Promise<{ items: number; hasMore: boolean }> => {
    const target = selectedTarget;
    const activeConnection = connection;
    if (!target || !activeConnection) {
      return { items: 0, hasMore: false };
    }
    return await activeConnection.loadOlderHeartbeat(target);
  };

  const compactSelectedHeartbeat = async (): Promise<void> => {
    const target = selectedTarget;
    const activeConnection = connection;
    if (!target || !activeConnection?.requestCompact) {
      return;
    }
    await activeConnection.requestCompact(target);
  };

  const saveSelectedConfig = async (draft: Parameters<NonNullable<ClientSdkAgenterHeartbeatConnection["saveConfig"]>>[1]): Promise<boolean> => {
    const target = selectedTarget;
    const activeConnection = connection;
    if (!target || !activeConnection?.saveConfig) {
      return false;
    }
    return await activeConnection.saveConfig(target, draft);
  };

  const f7Params = {
    name: "web-heartbeat-view-example",
    theme: "ios",
    popup: { closeOnEscape: true },
    sheet: { closeOnEscape: true },
    popover: { closeOnEscape: true },
    actions: { closeOnEscape: true },
  };

  onMount(() => {
    wsUrl = initialWsUrl ?? defaultWsUrl;
    mode = normalizeMode(initialMode);
    void connect();
    return () => {
      unsubscribe?.();
      connection?.disconnect();
    };
  });

  onDestroy(() => {
    unsubscribe?.();
    connection?.disconnect();
  });
</script>

<App {...f7Params}>
  <View main masterDetailBreakpoint={768}>
    {#if selectedTarget && connectionState?.selectedHeartbeat}
      <Page name="heartbeat" pageContent={false}>
        <Navbar>
          <NavLeft>
            <Button small round outline onclick={goBack} tooltip="Back to Avatars">
              <ArrowLeft size={16} />
            </Button>
          </NavLeft>
          <NavTitle>{selectedTarget.displayName ?? selectedTarget.avatar} Heartbeat</NavTitle>
          <NavRight>
            <Button
              small
              round
              outline
              onclick={() => void refreshSelectedHeartbeat()}
              tooltip="Refresh Heartbeat"
            >
              <RefreshCw size={16} />
            </Button>
          </NavRight>
        </Navbar>
        <div class="heartbeat-example-heartbeat-body">
          <HeartbeatView
            state={connectionState.selectedHeartbeat}
            {mode}
            avatarLabel={selectedTarget.displayName ?? selectedTarget.avatar}
            sessionIconUrl={selectedTarget.iconUrl}
            callbacks={{
              onLoadOlder: loadOlderSelectedHeartbeat,
              actions: {
                compact: {
                  available: mode === "configable" && typeof connection?.requestCompact === "function",
                  reason: mode === "readonly" ? "Readonly presentation mode" : null,
                },
                config: {
                  available:
                    mode === "configable" &&
                    typeof connection?.saveConfig === "function" &&
                    Boolean(connectionState.selectedHeartbeat.configBinding?.editableLayerId),
                  reason:
                    mode === "readonly"
                      ? "Readonly presentation mode"
                      : connectionState.selectedHeartbeat.configBinding?.editableLayerId
                        ? null
                        : "No editable config layer is available for this target",
                },
                onRequestCompact: compactSelectedHeartbeat,
                onRefreshConfig: refreshSelectedHeartbeat,
                onSaveConfig: saveSelectedConfig,
              },
            }}
          />
        </div>
      </Page>
    {:else}
      <Page name="avatars">
        <Navbar>
          <NavTitle>Avatars</NavTitle>
          <NavRight>
            <Button small round outline disabled={connecting} onclick={() => void connect()}>Connect</Button>
          </NavRight>
        </Navbar>
        <div class="heartbeat-example-content">
          <section class="heartbeat-example-connection">
            <label>
              Agenter endpoint
              <input bind:value={wsUrl} inputmode="url" spellcheck="false" />
            </label>
            <label>
              Mode
              <select bind:value={mode}>
                <option value="readonly">readonly</option>
                <option value="configable">configable</option>
              </select>
            </label>
            <Button fill disabled={connecting} onclick={() => void connect()}>
              {connecting ? "Connecting" : "Connect"}
            </Button>
            <label>
              Auth token
              <input bind:value={authToken} type="password" autocomplete="off" />
            </label>
            <div class="heartbeat-example-status">
              {#if connectionState}
                {connectionState.connectionStatus}
                {#if connectionState.avatars.refreshing}
                  · refreshing avatars
                {/if}
                {#if connectionState.avatars.error}
                  · {connectionState.avatars.error}
                {/if}
              {:else}
                waiting for connection
              {/if}
            </div>
          </section>

          {#if error || connectionState?.error}
            <div class="heartbeat-example-status">
              <Block strong>{error ?? connectionState?.error}</Block>
            </div>
          {/if}

          <List strongIos outlineIos dividersIos mediaList>
            {#each connectionState?.avatars.data ?? [] as avatar (avatar.runtimeId)}
              <ListItem
                link="#"
                title={avatar.displayName ?? avatar.nickname}
                subtitle={avatar.nickname}
                text={`${avatar.runtimeId}${avatar.defaultAvatar ? " · default" : ""}`}
                media={avatar.nickname.slice(0, 1).toUpperCase()}
                after={openingRuntimeId === avatar.runtimeId ? "Opening" : "Open"}
                onClick={() => void openAvatar(avatar)}
              />
            {/each}
          </List>

          {#if connectionState?.avatars.loaded && connectionState.avatars.data.length === 0}
            <Block strong>No Avatars returned by this Agenter target.</Block>
          {/if}
        </div>
      </Page>
    {/if}
  </View>
</App>
