import { describe, test } from "vitest";

import * as stories from "../../src/lib/features/runtime/runtime-stage-heartbeat.stories";
import { getPortableStory } from "./portable-stories";

const LoadingOlderKeepsHeartbeatRowsStable = getPortableStory(stories, "LoadingOlderKeepsHeartbeatRowsStable");
const LayoutActionSwitchesGroupPresentation = getPortableStory(stories, "LayoutActionSwitchesGroupPresentation");
const StickyBottomKeepsLatestRowsReachable = getPortableStory(stories, "StickyBottomKeepsLatestRowsReachable");
const BottomAnchorSurvivesLatestAppend = getPortableStory(stories, "BottomAnchorSurvivesLatestAppend");
const LatestAppendPlaysInsertMotion = getPortableStory(stories, "LatestAppendPlaysInsertMotion");
const InteractiveAppendUsesUniqueVisibleLabels = getPortableStory(stories, "InteractiveAppendUsesUniqueVisibleLabels");
const AppendLatestWhilePinnedKeepsViewportStable = getPortableStory(
  stories,
  "AppendLatestWhilePinnedKeepsViewportStable",
);
const AppendLatestWhileAwayKeepsViewportAnchored = getPortableStory(
  stories,
  "AppendLatestWhileAwayKeepsViewportAnchored",
);
const ScrollToLatestInterruptedByWheelKeepsViewportAway = getPortableStory(
  stories,
  "ScrollToLatestInterruptedByWheelKeepsViewportAway",
);
const RepeatedLatestAppendKeepsTrailingSequenceMonotonic = getPortableStory(
  stories,
  "RepeatedLatestAppendKeepsTrailingSequenceMonotonic",
);
const BottomAnchorSurvivesLatestGrowth = getPortableStory(stories, "BottomAnchorSurvivesLatestGrowth");
const RunningFooterShowsShimmerWithoutUsage = getPortableStory(stories, "RunningFooterShowsShimmerWithoutUsage");
const RunningDurationTicks = getPortableStory(stories, "RunningDurationTicks");
const ColdLoadingShowsExplicitState = getPortableStory(stories, "ColdLoadingShowsExplicitState");
const AsyncInitialLoadPinsLatest = getPortableStory(stories, "AsyncInitialLoadPinsLatest");
const WarmRefreshKeepsVisibleRows = getPortableStory(stories, "WarmRefreshKeepsVisibleRows");
const CompactActionForwardsRequest = getPortableStory(stories, "CompactActionForwardsRequest");
const StreamingToolCallRemainsVisible = getPortableStory(stories, "StreamingToolCallRemainsVisible");
const EmptyLedgerShowsExplicitState = getPortableStory(stories, "EmptyLedgerShowsExplicitState");
const OverflowingCardCanExpand = getPortableStory(stories, "OverflowingCardCanExpand");

describe("Feature: Storybook DOM contract for runtime heartbeat stage", () => {
  test("Scenario: Given a compact boundary in the Heartbeat stream When the stage renders and older rows are loaded Then the separator stays in the ordered virtualized list", async () => {
    await LoadingOlderKeepsHeartbeatRowsStable.run();
  });

  test("Scenario: Given a long virtualized Heartbeat stream When the operator scrolls away Then Scroll to latest returns the viewport to the newest rows", async () => {
    await StickyBottomKeepsLatestRowsReachable.run();
  });

  test("Scenario: Given the Heartbeat viewport is pinned to bottom When a new measured group appears Then the latest rows stay bottom-anchored without manual scrolling", async () => {
    await BottomAnchorSurvivesLatestAppend.run();
  });

  test("Scenario: Given a new latest Heartbeat group When it mounts Then the shared WAAPI insert motion actually advances over animation frames", async () => {
    await LatestAppendPlaysInsertMotion.run();
  });

  test("Scenario: Given the insert-motion playground When latest groups are appended repeatedly Then each new card exposes a distinct visible sequence label", async () => {
    await InteractiveAppendUsesUniqueVisibleLabels.run();
  });

  test("Scenario: Given the insert-motion playground is pinned to latest When Append latest is clicked Then the viewport stays near latest while the new row animates in", async () => {
    await AppendLatestWhilePinnedKeepsViewportStable.run();
  });

  test("Scenario: Given the Heartbeat viewport is reading older rows When a new latest group arrives Then the viewport preserves the current reading position instead of snapping to latest", async () => {
    await AppendLatestWhileAwayKeepsViewportAnchored.run();
  });

  test("Scenario: Given the Heartbeat viewport is away from latest When Scroll to latest is interrupted by wheel input Then the viewport remains under user ownership", async () => {
    await ScrollToLatestInterruptedByWheelKeepsViewportAway.run();
  });

  test("Scenario: Given the insert-motion playground has already appended several latest groups When one more latest group arrives Then the trailing visible sequence never regresses to an older card mid-animation", async () => {
    await RepeatedLatestAppendKeepsTrailingSequenceMonotonic.run();
  });

  test("Scenario: Given the Heartbeat viewport is pinned to bottom When the last group grows without changing item count Then the viewport keeps the latest rows anchored", async () => {
    await BottomAnchorSurvivesLatestGrowth.run();
  });

  test("Scenario: Given one heartbeat group card When the operator switches layout Then compact summary and detailed ledger views stay attached to the same group", async () => {
    await LayoutActionSwitchesGroupPresentation.run();
  });

  test("Scenario: Given a running AI call without usage When the Heartbeat footer renders Then the shimmer stays active and context falls back to disabled", async () => {
    await RunningFooterShowsShimmerWithoutUsage.run();
  });

  test("Scenario: Given a running Heartbeat group header When wall-clock time advances Then the elapsed duration label updates without new Heartbeat rows", async () => {
    await RunningDurationTicks.run();
  });

  test("Scenario: Given grouped Heartbeat history is still cold When the stage opens Then loading stays distinct from the empty ledger state", async () => {
    await ColdLoadingShowsExplicitState.run();
  });

  test("Scenario: Given Heartbeat history hydrates after the stage shell opens When the first loaded groups arrive Then the viewport restores latest ownership and keeps Scroll to latest hidden", async () => {
    await AsyncInitialLoadPinsLatest.run();
  });

  test("Scenario: Given persisted Heartbeat rows are visible When a refresh begins Then the stage keeps those rows mounted and adds a secondary refresh signal", async () => {
    await WarmRefreshKeepsVisibleRows.run();
  });

  test("Scenario: Given the footer Compact action is available When the operator clicks it Then the stage forwards the manual runtime compact request", async () => {
    await CompactActionForwardsRequest.run();
  });

  test("Scenario: Given a running Heartbeat tool call without a result When the stage renders Then the tool row remains visible without empty parameter chrome", async () => {
    await StreamingToolCallRemainsVisible.run();
  });

  test("Scenario: Given no persisted Heartbeat rows When the stage opens Then the operator sees an explicit empty state instead of a blank panel", async () => {
    await EmptyLedgerShowsExplicitState.run();
  });

  test("Scenario: Given an overflowing heartbeat card When the operator expands it Then the card grows beyond the default max height and can collapse back", async () => {
    await OverflowingCardCanExpand.run();
  });
});
