<script lang="ts">
  import StoryRoot from "./framework7-story-root.svelte";
  import CommentResourceLayer from "../comment-resource-layer.svelte";

  let {
    width = 390,
    height = 844,
    open = true,
  }: {
    width?: number;
    height?: number;
    open?: boolean;
  } = $props();

  const sourceResource = {
    id: "comment-1",
    label: "Comment 1",
    tokenText: "[^Comment 1]",
    kind: "comment",
    extension: "cmt",
    detailText: "这里是一个评论资源预览状态",
    commentText: "这里是一个评论资源预览状态",
    commentAnchor: {
      sourceViewKey: "message-12",
      sourceLineNumber: 3,
      selectedText: "Use lightweight inline tokens like `[^Image 1]` inside the body.",
      sourceActorLabel: "Kai",
      sourceUri: "msg://room-1/12#L3",
    },
  } as const;
</script>

<StoryRoot {width} {height}>
  <div class="surface">
    <CommentResourceLayer resource={sourceResource} {open} mode="view" />
  </div>
</StoryRoot>

<style>
  .surface {
    height: 100%;
    background: #f2f2f7;
  }
</style>
