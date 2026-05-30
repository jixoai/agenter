<script lang="ts">
  import { tick } from "svelte";
  import type { Snippet } from "svelte";
  import X from "@lucide/svelte/icons/x";

  import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    Link,
    NavLeft,
    Navbar,
    NavRight,
    Page,
    PageContent,
    Popup,
    Toolbar,
    View,
  } from "./framework7-components";
  import { useFramework7Runtime } from "./framework7-host";

  let {
    open = $bindable(false),
    title,
    eyebrow = "",
    meta = "",
    tone = "document",
    ariaLabel,
    onOpenChange,
    headerActions,
    footerActions,
    children,
  }: {
    open?: boolean;
    title: string;
    eyebrow?: string;
    meta?: string;
    tone?: "document" | "media";
    ariaLabel?: string;
    onOpenChange?: (next: boolean) => void;
    headerActions?: Snippet;
    footerActions?: Snippet;
    children?: Snippet;
  } = $props();

  const framework7Runtime = useFramework7Runtime();
  let retainedOpen = $state(false);
  const resolvedOpen = $derived(open || retainedOpen);
  const resolvedAriaLabel = $derived(ariaLabel ?? `Preview ${title}`);
  const hasFooterActions = $derived(Boolean(footerActions));

  const close = (): void => {
    open = false;
    onOpenChange?.(false);
  };

  const handlePopupClosed = (): void => {
    open = false;
    onOpenChange?.(false);
    void tick().then(() => {
      retainedOpen = false;
    });
  };

  const handleBackdropKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const stopKeydown = (event: KeyboardEvent): void => {
    event.stopPropagation();
  };

  const stopClick = (event: Event): void => {
    event.stopPropagation();
  };

  $effect(() => {
    if (open) {
      retainedOpen = true;
    }
  });
</script>

{#if $framework7Runtime && resolvedOpen}
  <Popup
    class="resource-preview-shell-popup"
    opened={resolvedOpen}
    containerEl="body"
    tabletFullscreen
    swipeToClose="to-bottom"
    onPopupClosed={handlePopupClosed}
  >
    <View>
      <Page
        class="resource-preview-shell-page"
        data-preview-tone={tone}
        data-has-footer={hasFooterActions ? "true" : "false"}
        noToolbar={!hasFooterActions}
        noSwipeback
      >
        <Navbar>
          <NavLeft
            class="resource-preview-shell-navslot"
            style="--f7-glass-bg-color: transparent; --f7-glass-shadow: none; backdrop-filter: none; border-radius: 0; min-width: 28px; width: 28px; height: 28px; margin: 0; padding: 0;"
          >
            <Link popupClose iconOnly aria-label="Close preview" title="Close preview">
              <X class="size-4" />
            </Link>
          </NavLeft>
          <div class="resource-preview-shell-navbar-copy">
            {#if eyebrow}
              <div class="resource-preview-shell-eyebrow">{eyebrow}</div>
            {/if}
            <div class="resource-preview-shell-title">{title}</div>
            {#if meta}
              <div class="resource-preview-shell-meta">{meta}</div>
            {/if}
          </div>
          <NavRight
            class="resource-preview-shell-navslot resource-preview-shell-actions"
            style="--f7-glass-bg-color: transparent; --f7-glass-shadow: none; backdrop-filter: none; border-radius: 0; min-width: 28px; width: 28px; height: 28px; margin: 0; padding: 0;"
          >
            {@render headerActions?.()}
          </NavRight>
        </Navbar>

        <PageContent class="resource-preview-shell-page-content">
          <div
            class="resource-preview-shell-layer"
            part="resource-preview-layer"
            role="dialog"
            aria-modal="true"
            aria-label={resolvedAriaLabel}
            tabindex="-1"
            onclick={stopClick}
            onkeydown={stopKeydown}
          >
            <div class="resource-preview-shell-body" data-preview-tone={tone} part="resource-preview-body">
              {@render children?.()}
            </div>
          </div>
        </PageContent>

        {#if footerActions}
          <Toolbar bottom class="resource-preview-shell-toolbar">
            {@render footerActions()}
          </Toolbar>
        {/if}
      </Page>
    </View>
  </Popup>
{:else if open}
  <div
    class="resource-preview-shell-backdrop"
    part="resource-preview-backdrop"
    role="button"
    tabindex="0"
    aria-label="Close preview"
    onclick={close}
    onkeydown={handleBackdropKeydown}
  >
    <div
      class="resource-preview-shell-layer"
      part="resource-preview-layer"
      role="dialog"
      aria-modal="true"
      aria-label={resolvedAriaLabel}
      tabindex="-1"
      onclick={stopClick}
      onkeydown={stopKeydown}
    >
      <Card class="resource-preview-shell-card">
        <CardHeader class="resource-preview-shell-header" part="resource-preview-header">
          <div class="resource-preview-shell-header-copy">
            {#if eyebrow}
              <div class="resource-preview-shell-eyebrow">{eyebrow}</div>
            {/if}
            <div class="resource-preview-shell-title">{title}</div>
            {#if meta}
              <div class="resource-preview-shell-meta">{meta}</div>
            {/if}
          </div>

          <div class="resource-preview-shell-actions">
            {@render headerActions?.()}
            <Link href="#" iconOnly aria-label="Close preview" title="Close preview" onclick={(event: MouseEvent) => {
              event.preventDefault();
              close();
            }}>
              <X class="size-4" />
            </Link>
          </div>
        </CardHeader>

        <CardContent class="resource-preview-shell-body" data-preview-tone={tone} part="resource-preview-body">
          {@render children?.()}
        </CardContent>
        {#if footerActions}
          <CardFooter class="resource-preview-shell-fallback-toolbar">
            {@render footerActions()}
          </CardFooter>
        {/if}
      </Card>
    </div>
  </div>
{/if}

<style>
  .resource-preview-shell-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.34);
    backdrop-filter: blur(20px);
  }

  :global(.resource-preview-shell-popup) {
    background: rgba(15, 23, 42, 0.34);
    backdrop-filter: blur(20px);
  }

  :global(.resource-preview-shell-popup.modal-out),
  :global(.resource-preview-shell-popup.popup-behind),
  :global(.resource-preview-shell-popup.modal-out .popup-backdrop),
  :global(.resource-preview-shell-popup.popup-behind .popup-backdrop),
  :global(.resource-preview-shell-popup.modal-out .resource-preview-shell-layer),
  :global(.resource-preview-shell-popup.popup-behind .resource-preview-shell-layer) {
    pointer-events: none;
  }

  .resource-preview-shell-layer {
    width: min(25rem, calc(100vw - 0.7rem));
    margin: 0 auto;
    padding: 0 0.04rem 0.08rem;
  }

  :global(.resource-preview-shell-card) {
    gap: 0;
    overflow: hidden;
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.58);
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 26px 72px rgba(15, 23, 42, 0.22);
  }

  :global(.resource-preview-shell-page) {
    min-height: 100%;
    background: rgba(248, 248, 252, 0.96);
  }

  :global(.resource-preview-shell-page[data-preview-tone="media"]) {
    background:
      linear-gradient(180deg, rgba(70, 76, 92, 0.34), rgba(33, 38, 52, 0.88) 16%, rgba(19, 24, 35, 0.96) 34%, rgba(16, 20, 30, 0.98));
  }

  :global(.resource-preview-shell-page .navbar) {
    background: color-mix(in srgb, var(--f7-bars-bg-color, #f2f2f7) 82%, white);
  }

  :global(.resource-preview-shell-page[data-preview-tone="media"] .navbar) {
    background: rgba(255, 255, 255, 0.04);
  }

  :global(.resource-preview-shell-page .navbar .left.resource-preview-shell-navslot),
  :global(.resource-preview-shell-page .navbar .right.resource-preview-shell-navslot) {
    min-width: 28px;
    width: 28px;
    height: 28px;
    margin: 0;
    padding: 0;
    border-radius: 0 !important;
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
  }

  :global(.resource-preview-shell-page[data-preview-tone="media"] .link) {
    color: rgba(255, 255, 255, 0.96);
  }

  .resource-preview-shell-navbar-copy {
    display: grid;
    justify-items: center;
    gap: 0.02rem;
    text-align: center;
    min-width: 0;
    flex: 1 1 auto;
  }

  :global(.resource-preview-shell-header),
  .resource-preview-shell-header-copy {
    min-width: 0;
  }

  :global(.resource-preview-shell-header) {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.65rem;
  }

  .resource-preview-shell-header-copy {
    display: grid;
    gap: 0.18rem;
  }

  .resource-preview-shell-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .resource-preview-shell-eyebrow {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #0f766e;
  }

  .resource-preview-shell-title {
    font-size: 0.96rem;
    font-weight: 680;
    color: #0f172a;
    word-break: break-word;
  }

  .resource-preview-shell-meta {
    font-size: 0.8rem;
    color: #64748b;
  }

  :global(.resource-preview-shell-page[data-preview-tone="media"] .resource-preview-shell-eyebrow) {
    color: rgba(255, 255, 255, 0.8);
  }

  :global(.resource-preview-shell-page[data-preview-tone="media"] .resource-preview-shell-title) {
    color: rgba(255, 255, 255, 0.98);
  }

  :global(.resource-preview-shell-page[data-preview-tone="media"] .resource-preview-shell-meta) {
    color: rgba(226, 232, 240, 0.8);
  }

  :global(.resource-preview-shell-page-content.page-content) {
    display: grid;
    align-content: start;
    --f7-page-content-extra-padding-top: 0px;
    --f7-page-content-extra-padding-bottom: 0px;
  }

  :global(.resource-preview-shell-page[data-has-footer="true"] .resource-preview-shell-page-content.page-content) {
    --f7-page-content-extra-padding-bottom: 0.36rem;
  }

  :global(.resource-preview-shell-body) {
    min-height: 0;
    display: grid;
    place-items: stretch;
    align-content: start;
    background: transparent;
    padding: 0.5rem 0.72rem calc(0.56rem + env(safe-area-inset-bottom));
  }

  :global(.resource-preview-shell-body[data-preview-tone="media"]) {
    min-height: calc(100vh - 4.1rem - env(safe-area-inset-bottom));
    align-self: stretch;
    align-content: center;
    padding: 0.26rem 0.2rem calc(0.3rem + env(safe-area-inset-bottom));
  }

  :global(.resource-preview-shell-page[data-has-footer="true"] .resource-preview-shell-body[data-preview-tone="media"]) {
    min-height: calc(100vh - 7.2rem - env(safe-area-inset-bottom));
  }

  :global(.resource-preview-shell-toolbar.toolbar) {
    min-height: calc(2.82rem + env(safe-area-inset-bottom));
    border-top: 1px solid rgba(60, 60, 67, 0.12);
    background: rgba(248, 248, 252, 0.9);
    backdrop-filter: saturate(180%) blur(24px);
  }

  :global(.resource-preview-shell-toolbar .toolbar-inner) {
    display: flex;
    justify-content: center;
    gap: 0.38rem;
    padding: 0.34rem 0.58rem calc(0.34rem + env(safe-area-inset-bottom));
  }

  :global(.resource-preview-shell-fallback-toolbar.card-footer) {
    justify-content: center;
    gap: 0.48rem;
    padding: 0.52rem;
    border-top: 1px solid rgba(60, 60, 67, 0.12);
    background: rgba(248, 248, 252, 0.72);
  }

  @media (max-width: 430px) {
    :global(.resource-preview-shell-popup) {
      padding: 0.25rem;
    }

    .resource-preview-shell-layer {
      width: calc(100vw - 0.22rem);
      padding: 0.02rem 0.05rem 0.12rem;
    }
  }
</style>
