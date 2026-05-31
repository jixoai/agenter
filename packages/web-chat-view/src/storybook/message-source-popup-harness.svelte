<script lang="ts">
  import type { MessageContactId } from "@agenter/message-system/types";
  import type { WebChatMessage } from "../types";

  import MessageSourcePopup from "../message-source-popup.svelte";
  import StoryRoot from "./framework7-story-root.svelte";

  let {
    width = 390,
    height = 844,
    open = true,
  }: {
    width?: number;
    height?: number;
    open?: boolean;
  } = $props();

  const message = {
    rowId: 42,
    messageId: 12,
    chatId: "room-1",
    viewKey: "room-1:12",
    sourceSystemId: "0x0000000000000000000000000000000000000001",
    from: "Kai",
    senderContactId: "auth:kai" as MessageContactId,
    kind: "text",
    content: [
      "# Review checklist",
      "",
      "Use lightweight inline tokens like `[^Image 1]` inside the body. [^Comment 1]",
      "",
      '[^Comment 1]: [Expose comment detail in view mode by default.](msg://room-1/12#L3 "Use lightweight inline tokens like `[^Image 1]` inside the body.")',
    ].join("\n"),
    attachments: [
      {
        assetId: "asset-image-1",
        kind: "image",
        name: "source-image-name",
        mimeType: "image/jpeg",
        sizeBytes: 2048,
        url: "https://assets.example/image.jpg",
      },
      {
        assetId: "asset-file-1",
        kind: "file",
        name: "resource-map.pdf",
        mimeType: "application/pdf",
        sizeBytes: 4096,
        url: "https://assets.example/resource-map.pdf",
      },
    ],
    metadata: {},
    createdAt: new Date("2026-05-03T09:12:00Z").getTime(),
    updatedAt: new Date("2026-05-03T09:12:00Z").getTime(),
    readContactIds: [],
    unreadContactIds: [],
  } satisfies WebChatMessage;

  const actorPresentation = {
    actorId: "actor:kai",
    label: "Kai",
    subtitle: "Reviewer",
    iconUrl: null,
    kind: "participant",
  } as const;
</script>

<StoryRoot {width} {height}>
  <div class="surface">
    <MessageSourcePopup {message} {actorPresentation} {open} activeLineNumber={3} />
  </div>
</StoryRoot>

<style>
  .surface {
    height: 100%;
    background: #f2f2f7;
  }
</style>
