<script lang="ts">
  import {
    HeartbeatRecordDetailView,
    type HeartbeatRecordItem,
    type HeartbeatViewState,
  } from "@agenter/web-heartbeat-view";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import { onMount } from "svelte";
  import { Block, Link, Navbar, NavLeft, NavRight, NavTitle, Page, PageContent } from "../../../src/framework7-components";

  import HeartbeatAvatarMedia from "./heartbeat-avatar-media.svelte";
  import { useHeartbeatExampleState } from "./heartbeat-example-context";

  type Framework7RouteProps = {
    f7route?: {
      params?: {
        runtimeId?: string;
        recordId?: string;
      };
    };
    runtimeId?: string;
    recordId?: string | number;
  };

  let { runtimeId: runtimeIdProp, recordId: recordIdProp, f7route }: Framework7RouteProps = $props();

  const exampleState = useHeartbeatExampleState();
  const readRouteFromLocation = (): { runtimeId: string | null; recordId: string | null } => {
    const match = /^\/heartbeat\/([^/?#]+)\/records\/([^/?#]+)/u.exec(window.location.pathname);
    return {
      runtimeId: match ? decodeURIComponent(match[1]) : null,
      recordId: match ? decodeURIComponent(match[2]) : null,
    };
  };
  const locationRoute = readRouteFromLocation();
  const runtimeId = $derived(
    runtimeIdProp ?? f7route?.params?.runtimeId ?? locationRoute.runtimeId ?? exampleState.initialRuntimeId ?? "",
  );
  const recordIdValue = $derived(String(recordIdProp ?? f7route?.params?.recordId ?? locationRoute.recordId ?? ""));
  const recordIdNumber = $derived(Number(recordIdValue));
  const backHref = $derived(runtimeId ? exampleState.buildHeartbeatListHref(runtimeId) : "/");

  const activeHeartbeat = $derived.by<HeartbeatViewState | null>(() => {
    const heartbeat = exampleState.connectionState.selectedHeartbeat;
    const target = exampleState.selectedTarget;
    return target?.runtimeId === runtimeId ? heartbeat : null;
  });
  const detailState = $derived(
    Number.isFinite(recordIdNumber) && recordIdNumber > 0 ? activeHeartbeat?.recordDetailsState?.[recordIdNumber] : undefined,
  );
  const detailRecord = $derived.by<HeartbeatRecordItem | null>(() => {
    if (detailState?.data?.record) {
      return detailState.data.record;
    }
    return activeHeartbeat?.recordsState?.data?.records.find((record) => record.id === recordIdNumber) ?? null;
  });
  let loadedDetailKey = $state("");

  onMount(() => {
    if (runtimeId) {
      void exampleState.openRuntimeId(runtimeId);
    }
  });

  $effect(() => {
    if (!activeHeartbeat || !Number.isFinite(recordIdNumber) || recordIdNumber <= 0) {
      return;
    }
    const sessionId = exampleState.selectedTarget?.sessionId ?? "";
    const nextKey = `${sessionId}:${recordIdNumber}`;
    if (nextKey === loadedDetailKey) {
      return;
    }
    loadedDetailKey = nextKey;
    void exampleState.loadSelectedHeartbeatRecordDetail(recordIdNumber);
  });
</script>

<Page name="heartbeat-record-detail" pageContent={false}>
  <Navbar>
    <NavLeft>
      <Link
        iconOnly
        iconF7="chevron_left_ios"
        href={backHref}
        aria-label="Back to Heartbeat records"
      />
    </NavLeft>
    <NavTitle>
      <span class="heartbeat-example-record-navbar-title">
        {#if exampleState.selectedTarget}
          <HeartbeatAvatarMedia
            label={exampleState.selectedTarget.displayName ?? exampleState.selectedTarget.avatar}
            src={exampleState.selectedTarget.iconUrl ?? null}
          />
        {/if}
        <span>Record #{Number.isFinite(recordIdNumber) ? recordIdNumber : recordIdValue}</span>
      </span>
    </NavTitle>
    <NavRight>
      <Link
        iconOnly
        aria-label="Refresh Heartbeat record"
        tooltip="Refresh"
        class={activeHeartbeat ? "" : "disabled"}
        onClick={() => {
          if (activeHeartbeat && Number.isFinite(recordIdNumber) && recordIdNumber > 0) {
            void exampleState.loadSelectedHeartbeatRecordDetail(recordIdNumber);
          }
        }}
      >
        <RefreshIcon size={20} aria-hidden="true" />
      </Link>
    </NavRight>
  </Navbar>

  <PageContent class="heartbeat-example-record-detail-content">
    {#if exampleState.error}
      <Block strong>{exampleState.error}</Block>
    {:else if !Number.isFinite(recordIdNumber) || recordIdNumber <= 0}
      <Block strong>Invalid Heartbeat record id.</Block>
    {:else if detailRecord}
      <HeartbeatRecordDetailView record={detailRecord} detailState={detailState} />
    {:else if detailState?.error}
      <Block strong>{detailState.error}</Block>
    {:else}
      <Block strong>Loading Heartbeat record...</Block>
    {/if}
  </PageContent>
</Page>

<style>
  :global(.heartbeat-example-record-detail-content) {
    box-sizing: border-box;
    overflow-x: clip;
  }

  .heartbeat-example-record-navbar-title {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    gap: 0.45rem;
  }

  .heartbeat-example-record-navbar-title > span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
