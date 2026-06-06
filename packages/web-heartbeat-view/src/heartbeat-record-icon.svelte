<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import Ban from "@lucide/svelte/icons/ban";
  import Boxes from "@lucide/svelte/icons/boxes";
  import Brain from "@lucide/svelte/icons/brain";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import CircleHelp from "@lucide/svelte/icons/circle-help";
  import File from "@lucide/svelte/icons/file";
  import GitMerge from "@lucide/svelte/icons/git-merge";
  import Hourglass from "@lucide/svelte/icons/hourglass";
  import Image from "@lucide/svelte/icons/image";
  import MessageSquareText from "@lucide/svelte/icons/message-square-text";
  import Package from "@lucide/svelte/icons/package";
  import UserRound from "@lucide/svelte/icons/user-round";
  import Video from "@lucide/svelte/icons/video";
  import Wrench from "@lucide/svelte/icons/wrench";

  import type { HeartbeatRecordChipKind } from "./heartbeat-record-chips";

  let {
    kind,
    size = 15,
  }: {
    kind: HeartbeatRecordChipKind | "compact" | "config";
    size?: number;
  } = $props();
</script>

{#if kind === "input"}
  <UserRound {size} aria-hidden="true" />
{:else if kind === "text"}
  <MessageSquareText {size} aria-hidden="true" />
{:else if kind === "image"}
  <Image {size} aria-hidden="true" />
{:else if kind === "video"}
  <Video {size} aria-hidden="true" />
{:else if kind === "file"}
  <File {size} aria-hidden="true" />
{:else if kind === "thinking"}
  <Brain {size} aria-hidden="true" />
{:else if kind === "refusal"}
  <Ban {size} aria-hidden="true" />
{:else if kind === "tool"}
  <Wrench {size} aria-hidden="true" />
{:else if kind === "pending"}
  <Hourglass {size} aria-hidden="true" />
{:else if kind === "error"}
  <CircleAlert {size} aria-hidden="true" />
{:else if kind === "combo"}
  <GitMerge {size} aria-hidden="true" />
{:else if kind === "compact"}
  <Archive {size} aria-hidden="true" />
{:else if kind === "config"}
  <Package {size} aria-hidden="true" />
{:else if kind === "unknown"}
  <CircleHelp {size} aria-hidden="true" />
{:else}
  <Boxes {size} aria-hidden="true" />
{/if}
