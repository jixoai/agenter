<script lang="ts">
  import Ban from "@lucide/svelte/icons/ban";
  import Brain from "@lucide/svelte/icons/brain";
  import Combine from "@lucide/svelte/icons/combine";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import CircleHelp from "@lucide/svelte/icons/circle-help";
  import File from "@lucide/svelte/icons/file";
  import Hourglass from "@lucide/svelte/icons/hourglass";
  import Image from "@lucide/svelte/icons/image";
  import MessageSquareText from "@lucide/svelte/icons/message-square-text";
  import Shredder from "@lucide/svelte/icons/shredder";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
  import User from "@lucide/svelte/icons/user";
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
  <User {size} aria-hidden="true" />
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
  <Combine {size} aria-hidden="true" />
{:else if kind === "compact"}
  <Shredder {size} aria-hidden="true" />
{:else if kind === "config"}
  <SlidersHorizontal {size} aria-hidden="true" />
{:else if kind === "unknown"}
  <CircleHelp {size} aria-hidden="true" />
{:else}
  <CircleHelp {size} aria-hidden="true" />
{/if}
