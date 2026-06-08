<script lang="ts">
  import type { Component } from "svelte";
  import { onDestroy, tick } from "svelte";
  import { App, View } from "../../../src/framework7-components";

  import HeartbeatAvatarDirectoryPage from "./HeartbeatAvatarDirectoryPage.svelte";
  import HeartbeatConnectionSheet from "./HeartbeatConnectionSheet.svelte";
  import HeartbeatRecordDetailRoutePage from "./HeartbeatRecordDetailRoutePage.svelte";
  import HeartbeatRoutePage from "./HeartbeatRoutePage.svelte";
  import { ensureFramework7 } from "./framework7";
  import { setHeartbeatExampleState } from "./heartbeat-example-context";
  import { HeartbeatExampleState } from "./heartbeat-example-state.svelte";

  ensureFramework7();

  let {
    initialRuntimeId = null,
    initialRecordId = null,
    initialMode = null,
    initialRecordPageSize = null,
    initialWsUrl = null,
    initialSilentConnect = null,
  }: {
    initialRuntimeId?: string | null;
    initialRecordId?: string | number | null;
    initialMode?: string | null;
    initialRecordPageSize?: string | number | null;
    initialSilentConnect?: boolean | string | null;
    initialWsUrl?: string | null;
  } = $props();

  const createInitialState = (): HeartbeatExampleState =>
    new HeartbeatExampleState({
      initialMode,
      initialRecordId,
      initialRecordPageSize,
      initialRuntimeId,
      initialSilentConnect,
      initialWsUrl,
    });
  const exampleState = createInitialState();
  setHeartbeatExampleState(exampleState);

  type Framework7Router = {
    navigate: (url: string, options?: { animate?: boolean }) => void;
  };
  type Framework7View = {
    router?: Framework7Router;
  };
  type Framework7Route = {
    path: string;
    component: Component<Record<string, unknown>>;
  };

  let mainView = $state<Framework7View | null>(null);
  let initialRouteApplied = false;

  const routes: Framework7Route[] = [
    {
      path: "/heartbeat/:runtimeId/records/:recordId",
      component: HeartbeatRecordDetailRoutePage as Component<Record<string, unknown>>,
    },
    {
      path: "/heartbeat/:runtimeId",
      component: HeartbeatRoutePage as Component<Record<string, unknown>>,
    },
  ];

  const f7Params = {
    name: "web-heartbeat-view-example",
    theme: "ios" as const,
    popup: { closeOnEscape: true },
    sheet: { closeOnEscape: true },
    popover: { closeOnEscape: true },
    actions: { closeOnEscape: true },
  };

  const applyInitialRoute = async (): Promise<void> => {
    if (initialRouteApplied || !initialRuntimeId || !mainView?.router) {
      return;
    }
    initialRouteApplied = true;
    await tick();
    const recordId = initialRecordId === null || initialRecordId === undefined ? "" : String(initialRecordId);
    const href = recordId
      ? `${exampleState.buildHeartbeatRecordHref(initialRuntimeId, recordId)}`
      : exampleState.buildHeartbeatListHref(initialRuntimeId);
    mainView.router.navigate(href, {
      animate: false,
    });
  };

  onDestroy(() => {
    exampleState.destroy();
  });
</script>

<App {...f7Params}>
  <View
    main
    class="safe-areas"
    url="/"
    {routes}
    browserHistory={true}
    browserHistoryRoot=""
    browserHistorySeparator=""
    browserHistoryAnimate={false}
    onViewInit={(view: Framework7View) => {
      mainView = view;
      void applyInitialRoute();
    }}
  >
    <HeartbeatAvatarDirectoryPage />
  </View>
  <HeartbeatConnectionSheet />
</App>
