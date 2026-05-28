<script lang="ts">
  import StoryRoot from "./framework7-story-root.svelte";
  import CommentAnchorBadge from "../comment-anchor-badge.svelte";

  let {
    width = 390,
    height = 844,
    mode = "view",
  }: {
    width?: number;
    height?: number;
    mode?: "view" | "edit" | null;
  } = $props();
</script>

<StoryRoot {width} {height}>
  <div class="surface">
    <div class="source-line">
      <span class="line-number">3</span>
      <span class="line-text">Use lightweight inline tokens like `[^Image 1]` inside the body.</span>
    </div>
    <CommentAnchorBadge
      label="Comment 1"
      selectedText="Use lightweight inline tokens like `[^Image 1]` inside the body."
      commentText="Keep the resource as a shelf item and leave the prose readable."
      sourceSummary="Kai · Line 3"
      {mode}
    />
  </div>
</StoryRoot>

<style>
  .surface {
    min-height: 100%;
    box-sizing: border-box;
    background: #f2f2f7;
    padding: 1.5rem 0.75rem;
  }

  .source-line {
    display: grid;
    grid-template-columns: 1.4rem minmax(0, 1fr);
    gap: 0.42rem;
    border-radius: 0.9rem 0.9rem 0 0;
    background: white;
    padding: 0.44rem 0.5rem;
  }

  .line-number {
    color: #94a3b8;
    font-size: 0.62rem;
    text-align: end;
  }

  .line-text {
    color: #0f172a;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    font-size: 0.7rem;
    line-height: 1.36;
  }
</style>
