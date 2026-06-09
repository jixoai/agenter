<script lang="ts">
  import {
    HeartbeatRecordDetailView,
    type HeartbeatRecordItem,
    type HeartbeatViewState,
  } from "@agenter/web-heartbeat-view";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import { onMount } from "svelte";
  import {
    Block,
    Button,
    Link,
    Navbar,
    NavLeft,
    NavRight,
    NavTitle,
    Page,
    PageContent,
    Segmented,
    Subnavbar,
  } from "../../../src/framework7-components";

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

  type CompactDetailTab = "new" | "old";
  type ConfigDetailTab = "diff" | "new" | "old";

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
  const hasDetailTabs = $derived(detailRecord?.kind === "compact" || detailRecord?.kind === "config");
  const tabBaseId = $derived(`heartbeat-record-detail-${recordIdValue || "unknown"}`);
  const compactTabIds = $derived({
    new: `${tabBaseId}-compact-new`,
    old: `${tabBaseId}-compact-old`,
  });
  const compactPanelId = $derived(`${tabBaseId}-compact-panel`);
  const configTabIds = $derived({
    diff: `${tabBaseId}-config-diff`,
    new: `${tabBaseId}-config-new`,
    old: `${tabBaseId}-config-old`,
  });
  const configPanelId = $derived(`${tabBaseId}-config-panel`);
  let compactTab = $state<CompactDetailTab>("new");
  let configTab = $state<ConfigDetailTab>("diff");
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

<Page name="heartbeat-record-detail" pageContent={false} withSubnavbar={hasDetailTabs}>
  <Navbar>
    <NavLeft
      backLink={true}
      backLinkUrl={backHref}
      backLinkShowText={false}
    />
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
    {#if detailRecord?.kind === "compact"}
      <Subnavbar >
        <Segmented strong round small role="tablist" aria-label="Compact detail tabs">
          <Button
            round small
            id={compactTabIds.new}
            role="tab"
            active={compactTab === "new"}
            aria-selected={compactTab === "new"}
            aria-controls={compactPanelId}
            tabindex={compactTab === "new" ? 0 : -1}
            text="New Context"
            onClick={() => (compactTab = "new")}
          />
          <Button
            round small
            id={compactTabIds.old}
            role="tab"
            active={compactTab === "old"}
            aria-selected={compactTab === "old"}
            aria-controls={compactPanelId}
            tabindex={compactTab === "old" ? 0 : -1}
            text="Old Context"
            onClick={() => (compactTab = "old")}
          />
        </Segmented>
      </Subnavbar>
    {:else if detailRecord?.kind === "config"}
      <Subnavbar>
        <Segmented strong round small role="tablist" aria-label="Config detail tabs">
          <Button
            round small
            id={configTabIds.diff}
            role="tab"
            active={configTab === "diff"}
            aria-selected={configTab === "diff"}
            aria-controls={configPanelId}
            tabindex={configTab === "diff" ? 0 : -1}
            text="Diff Config"
            onClick={() => (configTab = "diff")}
          />
          <Button
            round small
            id={configTabIds.new}
            role="tab"
            active={configTab === "new"}
            aria-selected={configTab === "new"}
            aria-controls={configPanelId}
            tabindex={configTab === "new" ? 0 : -1}
            text="New Config"
            onClick={() => (configTab = "new")}
          />
          <Button
            round small
            id={configTabIds.old}
            role="tab"
            active={configTab === "old"}
            aria-selected={configTab === "old"}
            aria-controls={configPanelId}
            tabindex={configTab === "old" ? 0 : -1}
            text="Old Config"
            onClick={() => (configTab = "old")}
          />
        </Segmented>
      </Subnavbar>
    {/if}
  </Navbar>

  <PageContent class="heartbeat-example-record-detail-content">
    {#if exampleState.error}
      <Block strong>{exampleState.error}</Block>
    {:else if !Number.isFinite(recordIdNumber) || recordIdNumber <= 0}
      <Block strong>Invalid Heartbeat record id.</Block>
    {:else if detailRecord}
      <HeartbeatRecordDetailView
        record={detailRecord}
        detailState={detailState}
        {compactTab}
        {compactPanelId}
        compactPanelLabelledBy={compactTabIds[compactTab]}
        {configTab}
        {configPanelId}
        configPanelLabelledBy={configTabIds[configTab]}
      />
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
