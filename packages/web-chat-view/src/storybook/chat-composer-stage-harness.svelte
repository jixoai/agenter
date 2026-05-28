<script lang="ts">
  import ImagePlus from "@lucide/svelte/icons/image-plus";
  import MonitorUp from "@lucide/svelte/icons/monitor-up";
  import SendHorizontal from "@lucide/svelte/icons/send-horizontal";

  import ResourceCard from "../resource-card.svelte";
  import { Link } from "../framework7-components";
  import StoryRoot from "./framework7-story-root.svelte";

  let {
    width = 390,
    height = 300,
  }: {
    width?: number;
    height?: number;
  } = $props();

  const imageResource = {
    id: "image-1",
    label: "Image 1",
    tokenText: "[^Image 1]",
    kind: "image",
    extension: "jpg",
    fileName: "cover.jpg",
    previewUrl:
      "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=300&q=80",
  } as const;

  const fileResource = {
    id: "file-1",
    label: "File 1",
    tokenText: "[^File 1]",
    kind: "file",
    extension: "pdf",
    fileName: "brief.pdf",
  } as const;

  const commentResource = {
    id: "comment-1",
    label: "Comment 1",
    tokenText: "[^Comment 1]",
    kind: "comment",
    extension: "cmt",
    detailText: "Selected line note",
  } as const;
</script>

<StoryRoot {width} {height} background="#ffffff">
  <div class="surface">
    <div class="transcript-spacer">
      <div class="spacer-pill">Transcript stage</div>
    </div>

    <div class="composer-frame">
      <div class="messagebar" role="group" aria-label="Message composer">
        <div class="attachment-shelf">
          <ResourceCard resource={imageResource} mode="pending" onRemove={() => undefined} />
          <ResourceCard resource={fileResource} mode="pending" onRemove={() => undefined} />
          <ResourceCard resource={commentResource} mode="pending" onRemove={() => undefined} />
        </div>

        <div class="messagebar-main">
          <div class="messagebar-area">
            <div class="message-input">
              Use [^Image 1] in the body and keep resource detail in the shelf.
            </div>
            <div class="messagebar-hints">
              <span>@</span>
              <span>people+resources</span>
              <span>^</span>
              <span>resources</span>
              <span>/</span>
              <span>command</span>
            </div>
          </div>

          <div class="messagebar-actions">
            <Link href="#" role="button" class="action-chip" title="Attach files" aria-label="Attach files">
              <ImagePlus size={16} />
            </Link>
            <Link href="#" role="button" class="action-chip" title="Capture screenshot" aria-label="Capture screenshot">
              <MonitorUp size={16} />
            </Link>
            <Link href="#" role="button" class="send-chip" title="Send message" aria-label="Send message">
              <SendHorizontal size={18} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  </div>
</StoryRoot>

<style>
  .surface {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    height: 100%;
    background: #fff;
  }

  .transcript-spacer {
    display: grid;
    place-items: center;
    min-height: 0;
    color: #8e8e93;
  }

  .spacer-pill {
    border-radius: 999px;
    padding: 0.35rem 0.7rem;
    background: #f2f2f7;
    font-size: 12px;
    font-weight: 600;
  }

  .composer-frame {
    border-top: 1px solid rgba(60, 60, 67, 0.16);
    background: rgba(248, 248, 252, 0.94);
    padding: 0.2rem 0.3rem calc(0.3rem + env(safe-area-inset-bottom));
  }

  .messagebar {
    display: grid;
    gap: 0.35rem;
  }

  .attachment-shelf {
    display: flex;
    gap: 0.45rem;
    overflow-x: auto;
  }

  .messagebar-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.4rem;
    align-items: end;
  }

  .messagebar-area {
    display: grid;
    gap: 0.28rem;
  }

  .message-input {
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.96);
    color: #111827;
    padding: 0.7rem 1rem 0.58rem;
    font-size: 17px;
    line-height: 1.24;
  }

  .messagebar-hints {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.5rem;
    padding-inline: 0.1rem;
    color: #475467;
    font-size: 11px;
  }

  .messagebar-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  :global(.action-chip.link),
  :global(.send-chip.link) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }

  :global(.action-chip.link) {
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    background: transparent;
    color: #007aff;
  }

  :global(.send-chip.link) {
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 999px;
    background: #007aff;
    color: #fff;
  }
</style>
