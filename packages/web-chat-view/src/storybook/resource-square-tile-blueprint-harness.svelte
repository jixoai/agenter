<script lang="ts">
  import StoryRoot from "./framework7-story-root.svelte";
  import ResourceCard from "../resource-card.svelte";

  let {
    width = 720,
    height = 520,
  }: {
    width?: number;
    height?: number;
  } = $props();

  const imageResource = {
    id: "image-1",
    label: "Image 1",
    tokenText: "[^Image 1]",
    kind: "image",
    fileName: "cover.jpg",
    extension: "jpg",
    previewUrl:
      "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=300&q=80",
  } as const;

  const fileResource = {
    id: "file-1",
    label: "File 1",
    tokenText: "[^File 1]",
    kind: "file",
    fileName: "brief.pdf",
    extension: "pdf",
  } as const;

  const commentResource = {
    id: "comment-2",
    label: "Comment 2",
    tokenText: "[^Comment 2]",
    kind: "comment",
    extension: "comment",
    detailText: "评论内容",
  } as const;
</script>

<StoryRoot {width} {height}>
  <div class="board">
    <section>
      <div class="eyebrow">Core Variants</div>
      <div class="row">
        <ResourceCard resource={imageResource} mode="sent" />
        <ResourceCard resource={fileResource} mode="sent" />
        <ResourceCard resource={commentResource} mode="sent" />
      </div>
    </section>

    <section>
      <div class="eyebrow">Pending</div>
      <div class="row">
        <ResourceCard resource={imageResource} mode="pending" onRemove={() => undefined} />
        <ResourceCard resource={fileResource} mode="pending" onRemove={() => undefined} />
        <ResourceCard resource={commentResource} mode="pending" onRemove={() => undefined} />
      </div>
    </section>

    <section>
      <div class="eyebrow">Rail</div>
      <div class="rail">
        <ResourceCard resource={imageResource} mode="sent" />
        <ResourceCard resource={fileResource} mode="sent" />
        <ResourceCard resource={commentResource} mode="sent" />
        <ResourceCard resource={imageResource} mode="sent" />
        <ResourceCard resource={fileResource} mode="sent" />
      </div>
    </section>
  </div>
</StoryRoot>

<style>
  .board {
    display: grid;
    gap: 1.25rem;
    height: 100%;
    padding: 1.5rem;
    background: #f2f2f7;
  }

  .eyebrow {
    margin-bottom: 0.6rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .row,
  .rail {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }

  .rail {
    overflow-x: auto;
    padding-bottom: 0.2rem;
  }
</style>
