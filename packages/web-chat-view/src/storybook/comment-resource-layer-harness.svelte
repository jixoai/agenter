<script lang="ts">
  import CommentResourceLayer from "../comment-resource-layer.svelte";
  import StoryRoot from "./framework7-story-root.svelte";

  let {
    width = 390,
    height = 844,
    open = true,
    mode = "view",
    editable = true,
  }: {
    width?: number;
    height?: number;
    open?: boolean;
    mode?: "view" | "edit";
    editable?: boolean;
  } = $props();

  let draftValue = $state("Keep resource detail grouped in the shelf, not in the body.");

  const resource = {
    id: "comment-7",
    label: "Comment 7",
    tokenText: "[^Comment 7]",
    kind: "comment",
    extension: "cmt",
    commentText: "Keep resource detail grouped in the shelf, not in the body.",
    commentAnchor: {
      sourceViewKey: "message-42",
      sourceLineNumber: 6,
      selectedText: "Sent state mirrors edit state: body carries lightweight tokens.",
      sourceActorLabel: "Ava",
      sourceUri: "msg://room-1/42#L6",
    },
  } as const;
</script>

<StoryRoot {width} {height}>
  <div class="surface">
    <CommentResourceLayer
      {resource}
      {open}
      {mode}
      {editable}
      bind:draftValue
      onSave={() => undefined}
    />
  </div>
</StoryRoot>

<style>
  .surface {
    height: 100%;
    background: #f2f2f7;
  }
</style>
