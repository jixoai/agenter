<script lang="ts">
  import ChatDraftEditor from "../composer/chat-draft-editor.svelte";
  import { resolveComposerCapabilities } from "../composer/composer-contract";
  import MessageMarkdownContent from "../components/message-markdown-content.svelte";
  import ResourceIconWithNumber from "../components/resource-icon-with-number.svelte";
  import type { WebChatResourceReference } from "../types";
  import StoryRoot from "./framework7-story-root.svelte";

  let {
    width = 820,
    height = 620,
  }: {
    width?: number;
    height?: number;
  } = $props();

  const resources = [
    {
      id: "image-1",
      label: "Image 1",
      tokenText: "[^Image 1]",
      kind: "image",
      detailText: "Annotated capture",
      fileName: "thread.png",
      extension: "png",
      url: "https://assets.example/thread.png",
      previewUrl: "https://assets.example/thread.png",
    },
    {
      id: "comment-1",
      label: "Comment 1",
      tokenText: "[^Comment 1]",
      kind: "comment",
      detailText: "Line scoped note",
      commentText: "Line scoped note",
      extension: "cmt",
    },
    {
      id: "file-1",
      label: "File 1",
      tokenText: "[^File 1]",
      kind: "file",
      detailText: "Design brief",
      fileName: "brief.pdf",
      extension: "pdf",
      url: "https://assets.example/brief.pdf",
    },
  ] satisfies WebChatResourceReference[];

  let draft = $state("Please inspect [^Comment 1] before release.");
  let submittedDraft = $state("");
  let openedResourceLabel = $state("");

  const capabilities = $derived(
    resolveComposerCapabilities(
      {
        resourceReferences: resources,
        attachmentEnabled: false,
        imageEnabled: false,
        screenshotEnabled: false,
      },
      "Message Review...",
    ),
  );

  const bubbleMarkdown = [
    "Readonly bubble projects [^Image 1], [^Comment 1], and [^File 1].",
    "",
    "[^Image 1]: [!thread.png](https://assets.example/thread.png)",
    "[^Comment 1]: [Line scoped note](msg://review-room/1#L42)",
    "[^File 1]: [!brief.pdf](https://assets.example/brief.pdf)",
  ].join("\n");

  const iconPalette = [
    {
      id: "slate",
      ink: "#0f172a",
      surface: "#f8fafc",
      border: "rgba(15, 23, 42, 0.18)",
      badge: "#ffffff",
    },
    {
      id: "teal",
      ink: "#0f766e",
      surface: "#ccfbf1",
      border: "rgba(15, 118, 110, 0.24)",
      badge: "#f0fdfa",
    },
    {
      id: "rose",
      ink: "#9f1239",
      surface: "#ffe4e6",
      border: "rgba(159, 18, 57, 0.22)",
      badge: "#fff1f2",
    },
    {
      id: "indigo",
      ink: "#3730a3",
      surface: "#e0e7ff",
      border: "rgba(55, 48, 163, 0.22)",
      badge: "#eef2ff",
    },
  ] as const;
</script>

<StoryRoot {width} {height} background="#f8f8fc">
  <section class="projection-surface" aria-label="CodeMirror resource projection">
    <div class="projection-panel" data-testid="readonly-bubble-panel">
      <p class="panel-kicker">readonly bubble</p>
      <div class="bubble">
        <MessageMarkdownContent
          value={bubbleMarkdown}
          {resources}
          tone="participant"
          onOpenResource={(resource) => {
            openedResourceLabel = resource.label;
          }}
        />
      </div>
    </div>

    <div class="projection-panel" data-testid="writable-composer-panel">
      <p class="panel-kicker">writable composer</p>
      <div class="composer-preview-shell">
        <ChatDraftEditor
          value={draft}
          placeholder={capabilities.placeholder}
          disabled={false}
          submitting={false}
          {capabilities}
          onOpenResource={(resource) => {
            openedResourceLabel = resource.label;
          }}
          onChange={(value) => {
            draft = value;
          }}
          onSubmit={() => {
            submittedDraft = draft;
          }}
        />
      </div>
      <dl class="projection-state">
        <div>
          <dt>Draft</dt>
          <dd data-testid="draft-value">{draft}</dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd data-testid="submitted-draft">{submittedDraft}</dd>
        </div>
        <div>
          <dt>Opened</dt>
          <dd data-testid="opened-resource">{openedResourceLabel}</dd>
        </div>
      </dl>
    </div>

    <div class="projection-panel" data-testid="resource-icon-palette-panel">
      <p class="panel-kicker">icon palette</p>
      <div class="palette-grid" aria-label="Resource icon color variants">
        {#each iconPalette as variant (variant.id)}
          <div
            class="palette-row"
            style={`--resource-icon-ink: ${variant.ink}; --resource-icon-surface: ${variant.surface}; --resource-icon-border: ${variant.border}; --resource-icon-badge-surface: ${variant.badge}; --resource-icon-badge-border: ${variant.border}`}
          >
            <ResourceIconWithNumber kind="image" number="1" />
            <ResourceIconWithNumber kind="comment" number="2" />
            <ResourceIconWithNumber kind="file" number="3" extension="pdf" />
          </div>
        {/each}
      </div>
    </div>
  </section>
</StoryRoot>

<style>
  .projection-surface {
    display: grid;
    grid-template-rows: auto auto auto;
    align-content: start;
    gap: 0.9rem;
    height: 100%;
    padding: 1rem;
    background: #f8f8fc;
    color: #111827;
  }

  .projection-panel {
    display: grid;
    gap: 0.45rem;
    min-width: 0;
  }

  .panel-kicker {
    margin: 0;
    color: #667085;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .bubble {
    max-width: 36rem;
    border-radius: 1rem;
    background: #e9eef9;
    color: #111827;
    padding: 0.7rem 0.82rem;
  }

  .composer-preview-shell {
    border-radius: 1.35rem;
    border: 1px solid rgba(60, 60, 67, 0.1);
    background: rgba(255, 255, 255, 0.96);
  }

  .projection-state {
    display: grid;
    gap: 0.3rem;
    margin: 0;
    color: #475467;
    font-size: 0.76rem;
  }

  .projection-state div {
    display: grid;
    grid-template-columns: 5.2rem minmax(0, 1fr);
    gap: 0.5rem;
  }

  .palette-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7.5rem, max-content));
    gap: 0.42rem;
    align-items: center;
  }

  .palette-row {
    display: flex;
    align-items: center;
    gap: 0.32rem;
    width: max-content;
    border-radius: 0.86rem;
    background: color-mix(in srgb, var(--resource-icon-surface) 50%, white 50%);
    padding: 0.3rem;
  }

  .projection-state dt {
    color: #667085;
    font-weight: 700;
  }

  .projection-state dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>
