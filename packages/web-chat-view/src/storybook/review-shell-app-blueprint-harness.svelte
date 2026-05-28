<script lang="ts">
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import MessageCircle from "@lucide/svelte/icons/message-circle";
  import Server from "@lucide/svelte/icons/server";
  import UserRound from "@lucide/svelte/icons/user-round";
  import UsersRound from "@lucide/svelte/icons/users-round";

  import { Link } from "../framework7-components";
  import StoryRoot from "./framework7-story-root.svelte";
  import ResourceCard from "../resource-card.svelte";

  let {
    width = 390,
    height = 844,
  }: {
    width?: number;
    height?: number;
  } = $props();

  type Surface = "messages" | "room" | "contacts" | "contact-detail" | "me" | "sources" | "source-detail";

  let surface = $state<Surface>("messages");

  const imageResource = {
    id: "image-1",
    label: "Image 1",
    tokenText: "[^Image 1]",
    kind: "image",
    extension: "jpg",
    fileName: "ios26-thread.jpg",
    previewUrl:
      "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=300&q=80",
  } as const;

  const commentResource = {
    id: "comment-1",
    label: "Comment 1",
    tokenText: "[^Comment 1]",
    kind: "comment",
    extension: "cmt",
    detailText: "Line 4 comment",
  } as const;

  const title = $derived.by(() => {
    switch (surface) {
      case "room":
        return "Canonical review room";
      case "contacts":
        return "Contacts";
      case "contact-detail":
        return "Contact Details";
      case "me":
        return "Me";
      case "sources":
        return "Sources";
      case "source-detail":
        return "Source Details";
      default:
        return "Messages";
    }
  });

  const subtitle = $derived.by(() => {
    switch (surface) {
      case "room":
        return "2 online · Thu";
      case "contact-detail":
        return "Main office · auth:kai";
      case "sources":
        return "3 sources";
      case "source-detail":
        return "https://remote-lab.example.invalid";
      default:
        return "Iris review";
    }
  });

  const goBack = (): void => {
    if (surface === "room") {
      surface = "messages";
      return;
    }
    if (surface === "contact-detail") {
      surface = "contacts";
      return;
    }
    if (surface === "source-detail") {
      surface = "sources";
      return;
    }
    if (surface === "sources") {
      surface = "me";
    }
  };

  const tabSurface = $derived(surface === "room" ? "messages" : surface === "contact-detail" ? "contacts" : surface === "sources" || surface === "source-detail" ? "me" : surface);
  const tabbarVisible = $derived(surface === "messages" || surface === "contacts" || surface === "me");
</script>

<StoryRoot {width} {height} background="#ffffff">
  <div class="shell" data-surface={surface}>
    <header class="navbar">
      {#if surface !== "messages" && surface !== "contacts" && surface !== "me"}
        <Link href="#" role="button" class="nav-button" aria-label="Back" onclick={(event: MouseEvent) => {
          event.preventDefault();
          goBack();
        }}>
          <ChevronLeft size={20} />
        </Link>
      {:else}
        <span class="nav-spacer" aria-hidden="true"></span>
      {/if}
      <div class="title-block">
        <div class="title">{title}</div>
        <div class="subtitle">{subtitle}</div>
      </div>
      <span class="nav-spacer" aria-hidden="true"></span>
    </header>

    <main class="stage">
      {#if surface === "messages"}
        <section class="list-stack" aria-label="Messages blueprint">
          <Link href="#" role="button" class="row" aria-label="Open room chat" onclick={(event: MouseEvent) => {
            event.preventDefault();
            surface = "room";
          }}>
            <span class="avatar room">CR</span>
            <span class="row-main">
              <strong>Canonical review room</strong>
              <small>Keep resources in the shelf and body text light.</small>
            </span>
            <span class="time">4:41 PM</span>
          </Link>
          <Link href="#" role="button" class="row" aria-label="Open direct Kai">
            <span class="avatar direct">K</span>
            <span class="row-main">
              <strong>Kai</strong>
              <small>Main office · direct room available</small>
            </span>
            <span class="time">direct</span>
          </Link>
        </section>
      {:else if surface === "room"}
        <section class="transcript" aria-label="Room chat blueprint">
          <article class="message received">
            <span class="avatar small">I</span>
            <div class="bubble">
              <small>4:41 PM</small>
              <p>Mobile-first review surface is seeded. Body stays light with [^Image 1] and [^Comment 1].</p>
              <div class="resource-rail">
                <ResourceCard resource={imageResource} mode="sent" />
                <ResourceCard resource={commentResource} mode="sent" />
              </div>
            </div>
          </article>
          <article class="message sent">
            <div class="bubble sent-bubble">
              <small>4:42 PM</small>
              <p>Keep setup, sources, and profile out of the chat first viewport.</p>
            </div>
            <span class="avatar small">K</span>
          </article>
        </section>
      {:else if surface === "contacts"}
        <section class="list-stack" aria-label="Contacts blueprint">
          <div class="section-title">Requests</div>
          <Link href="#" role="button" class="row">
            <span class="avatar request">M</span>
            <span class="row-main">
              <strong>Mira</strong>
              <small>Remote lab · inbound · pending</small>
            </span>
            <span class="badge">1</span>
          </Link>
          <div class="section-title">Main office</div>
          <Link href="#" role="button" class="row" aria-label="Open Kai contact" onclick={(event: MouseEvent) => {
            event.preventDefault();
            surface = "contact-detail";
          }}>
            <span class="avatar direct">K</span>
            <span class="row-main">
              <strong>Kai</strong>
              <small>Main office design owner</small>
            </span>
            <span class="time">contact</span>
          </Link>
        </section>
      {:else if surface === "contact-detail"}
        <section class="detail" aria-label="Contact detail blueprint">
          <span class="hero-avatar">K</span>
          <h2>Kai</h2>
          <p>Main office · auth:kai</p>
          <div class="detail-list">
            <span>Source</span><strong>Main office</strong>
            <span>Remote actor</span><strong>auth:kai</strong>
            <span>Direct room</span><strong>Not created</strong>
          </div>
          <Link href="#" role="button" class="primary-action">Start Chat</Link>
        </section>
      {:else if surface === "me"}
        <section class="list-stack" aria-label="Me blueprint">
          <div class="profile-card">
            <span class="hero-avatar">I</span>
            <div>
              <strong>Iris review</strong>
              <small>auth:owner</small>
            </div>
          </div>
          <Link href="#" role="button" class="row" aria-label="Open source management" onclick={(event: MouseEvent) => {
            event.preventDefault();
            surface = "sources";
          }}>
            <span class="avatar source"><Server size={18} /></span>
            <span class="row-main">
              <strong>Source Management</strong>
              <small>3 configured sources</small>
            </span>
            <span class="time">ready</span>
          </Link>
          <Link href="#" role="button" class="row">
            <span class="avatar setup">R</span>
            <span class="row-main">
              <strong>Review Setup</strong>
              <small>URL, token, and viewer actor</small>
            </span>
          </Link>
        </section>
      {:else if surface === "sources"}
        <section class="list-stack" aria-label="Sources blueprint">
          <Link href="#" role="button" class="row" aria-label="Open remote lab source" onclick={(event: MouseEvent) => {
            event.preventDefault();
            surface = "source-detail";
          }}>
            <span class="avatar source"><Server size={18} /></span>
            <span class="row-main">
              <strong>Remote lab</strong>
              <small>https://remote-lab.example.invalid</small>
            </span>
            <span class="time">ready</span>
          </Link>
          <Link href="#" role="button" class="primary-action secondary">Add Source</Link>
        </section>
      {:else}
        <section class="detail" aria-label="Source detail blueprint">
          <span class="hero-avatar source-hero"><Server size={24} /></span>
          <h2>Remote lab</h2>
          <p>https://remote-lab.example.invalid</p>
          <div class="detail-list">
            <span>Contacts</span><strong>1</strong>
            <span>Pending requests</span><strong>1</strong>
            <span>Callback</span><strong>local-review</strong>
          </div>
          <Link href="#" role="button" class="primary-action secondary">Edit Source</Link>
        </section>
      {/if}
    </main>

    {#if tabbarVisible}
      <nav class="tabbar" aria-label="Primary navigation">
        <Link href="#" role="tab" aria-selected={tabSurface === "messages"} onclick={(event: MouseEvent) => {
          event.preventDefault();
          surface = "messages";
        }}>
          <MessageCircle size={18} />
          <span>Messages</span>
        </Link>
        <Link href="#" role="tab" aria-selected={tabSurface === "contacts"} onclick={(event: MouseEvent) => {
          event.preventDefault();
          surface = "contacts";
        }}>
          <UsersRound size={18} />
          <span>Contacts</span>
        </Link>
        <Link href="#" role="tab" aria-selected={tabSurface === "me"} onclick={(event: MouseEvent) => {
          event.preventDefault();
          surface = "me";
        }}>
          <UserRound size={18} />
          <span>Me</span>
        </Link>
      </nav>
    {/if}
  </div>
</StoryRoot>

<style>
  .shell {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    height: 100%;
    background: #fff;
    color: #111827;
  }

  .navbar {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    align-items: center;
    min-height: 72px;
    padding: 10px 10px 8px;
    border-bottom: 1px solid rgba(60, 60, 67, 0.12);
    background: rgba(248, 248, 252, 0.86);
    backdrop-filter: saturate(180%) blur(24px);
  }

  :global(.nav-button.link),
  .nav-spacer {
    width: 34px;
    height: 34px;
  }

  :global(.nav-button.link) {
    display: grid;
    place-items: center;
    background: transparent;
    color: #007aff;
    text-decoration: none;
  }

  .title-block {
    min-width: 0;
    text-align: center;
  }

  .title {
    overflow: hidden;
    font-size: 15px;
    font-weight: 680;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .subtitle {
    overflow: hidden;
    margin-top: 2px;
    color: rgba(60, 60, 67, 0.64);
    font-size: 10px;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stage {
    min-height: 0;
    overflow: auto;
    background: #f2f2f7;
  }

  .list-stack {
    display: grid;
    gap: 8px;
    padding: 12px;
  }

  .section-title {
    margin: 8px 4px 0;
    color: rgba(0, 122, 255, 0.86);
    font-size: 11px;
    font-weight: 720;
    text-transform: uppercase;
  }

  :global(.row.link),
  .profile-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.94);
    color: inherit;
    padding: 10px 12px;
    text-align: left;
    box-shadow: inset 0 0 0 1px rgba(60, 60, 67, 0.08);
    text-decoration: none;
  }

  .profile-card {
    grid-template-columns: auto minmax(0, 1fr);
    min-height: 82px;
  }

  .row-main {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  :global(.row.link strong),
  .profile-card strong {
    overflow: hidden;
    font-size: 15px;
    font-weight: 650;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.row.link small),
  .profile-card small,
  .time {
    overflow: hidden;
    color: rgba(60, 60, 67, 0.62);
    font-size: 12px;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .time {
    max-width: 72px;
    text-align: right;
  }

  .badge {
    display: grid;
    min-width: 22px;
    height: 22px;
    place-items: center;
    border-radius: 999px;
    background: #ff3b30;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
  }

  .avatar,
  .hero-avatar {
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: 14px;
    background: #e5e7eb;
    color: #344054;
    font-weight: 760;
  }

  .avatar {
    width: 42px;
    height: 42px;
    font-size: 13px;
  }

  .avatar.small {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    font-size: 11px;
  }

  .avatar.room {
    background: color-mix(in srgb, #007aff 14%, #f2f2f7);
    color: #007aff;
  }

  .avatar.direct {
    border-radius: 999px;
    background: linear-gradient(135deg, #f1f5f9, #dbeafe);
    color: #1d4ed8;
  }

  .avatar.request {
    border-radius: 999px;
    background: rgba(255, 149, 0, 0.16);
    color: #9a5a00;
  }

  .avatar.source,
  .source-hero {
    background: rgba(52, 199, 89, 0.13);
    color: #16823a;
  }

  .avatar.setup {
    background: rgba(0, 122, 255, 0.12);
    color: #007aff;
  }

  .transcript {
    display: grid;
    gap: 12px;
    align-content: end;
    min-height: 100%;
    padding: 16px 10px;
    background: #fff;
  }

  .message {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .message.sent {
    justify-content: flex-end;
  }

  .bubble {
    max-width: 78%;
    border-radius: 16px;
    background: #e9f8f2;
    padding: 10px 12px 12px;
    font-size: 16px;
    line-height: 1.3;
  }

  .sent-bubble {
    background: #007aff;
    color: #fff;
  }

  .bubble small {
    display: block;
    margin-bottom: 4px;
    color: rgba(60, 60, 67, 0.62);
    font-size: 11px;
    text-align: right;
  }

  .sent-bubble small {
    color: rgba(255, 255, 255, 0.74);
  }

  .bubble p {
    margin: 0;
  }

  .resource-rail {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .detail {
    display: grid;
    justify-items: center;
    gap: 10px;
    padding: 28px 18px;
    text-align: center;
  }

  .hero-avatar {
    width: 68px;
    height: 68px;
    border-radius: 20px;
    font-size: 26px;
  }

  .detail h2 {
    margin: 4px 0 0;
    font-size: 24px;
    line-height: 1.1;
  }

  .detail p {
    max-width: 100%;
    margin: 0;
    overflow-wrap: anywhere;
    color: rgba(60, 60, 67, 0.66);
    font-size: 13px;
    line-height: 1.35;
  }

  .detail-list {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 10px 14px;
    width: 100%;
    margin-top: 10px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.94);
    padding: 14px;
    text-align: left;
    box-shadow: inset 0 0 0 1px rgba(60, 60, 67, 0.08);
  }

  .detail-list span {
    color: rgba(60, 60, 67, 0.64);
    font-size: 13px;
  }

  .detail-list strong {
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 13px;
    font-weight: 650;
    text-align: right;
  }

  :global(.primary-action.link) {
    width: 100%;
    min-height: 44px;
    margin-top: 6px;
    border-radius: 12px;
    background: #007aff;
    color: #fff;
    font-size: 16px;
    font-weight: 650;
    text-decoration: none;
    display: inline-grid;
    place-items: center;
  }

  :global(.primary-action.secondary.link) {
    background: #fff;
    color: #007aff;
    box-shadow: inset 0 0 0 1px rgba(0, 122, 255, 0.24);
  }

  .tabbar {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    min-height: 78px;
    padding: 5px 12px 18px;
    border-top: 1px solid rgba(60, 60, 67, 0.12);
    background: rgba(248, 248, 252, 0.94);
    backdrop-filter: saturate(180%) blur(24px);
  }

  :global(.tabbar .link) {
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 2px;
    background: transparent;
    color: rgba(60, 60, 67, 0.7);
    font-size: 10px;
    line-height: 1.1;
    text-decoration: none;
  }

  :global(.tabbar .link[aria-selected="true"]) {
    color: #007aff;
  }
</style>
