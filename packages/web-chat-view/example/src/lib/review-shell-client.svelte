<script lang="ts">
  import type { WebChatActorResolveInput, WebChatComposerMentionSuggestion, WebChatResourceReference } from "@agenter/web-chat-view";
  import { WebChatViewHost } from "@agenter/web-chat-view";
  import ArrowClockwise from "@lucide/svelte/icons/refresh-cw";
  import ChatBubble from "@lucide/svelte/icons/message-circle";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import PersonCircle from "@lucide/svelte/icons/circle-user-round";
  import PersonVerified from "@lucide/svelte/icons/badge-check";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import ShareIcon from "@lucide/svelte/icons/share-2";
  import SlidersIcon from "@lucide/svelte/icons/sliders-horizontal";
  import SourceIcon from "@lucide/svelte/icons/archive";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import UsersIcon from "@lucide/svelte/icons/users-round";
  import type { Router, View as Framework7View } from "framework7/types";
  import { onDestroy, onMount, tick } from "svelte";
  import { app } from "framework7-svelte/shared/f7.js";
  import {
    App,
    Badge,
    Block,
    BlockTitle,
    Button,
    Link,
    List,
    ListGroup,
    ListInput,
    ListItem,
    Navbar,
    NavRight,
    Panel,
    Page,
    PageContent,
    Searchbar,
    Sheet,
    Subnavbar,
    Tab,
    Tabs,
    Toolbar,
    ToolbarPane,
    View,
  } from "../../../src/framework7-components";

  import { ensureFramework7 } from "./framework7";
  import type { ReviewContactProjection } from "./review-people.projection";
  import ReviewShellRoutedPage from "./review-shell-routed-page.svelte";
  import ReviewShellProfileSurface from "./review-shell-profile-surface.svelte";
  import { ReviewShellState } from "./review-shell-state.svelte";

  ensureFramework7();

  type Framework7ActionsInstance = {
    open: (animate?: boolean) => void;
    close: (animate?: boolean) => void;
    destroy: () => void;
  };
  type ReviewShellExposedState = ReviewShellState & {
    openDestination: (destination: "messages" | "contacts" | "me") => void | Promise<void>;
    openContact: (contactKey: string) => void | Promise<void>;
    openSources: (sourceId?: string | null) => void | Promise<void>;
    openRoom: () => void | Promise<void>;
    openProfiles: () => void | Promise<void>;
  };
  type Framework7NavbarHandle = {
    size?: () => void;
  };
  type Framework7Router = Pick<Router.Router, "back" | "history" | "navigate"> & {
    currentRoute?: {
      path?: string;
      url?: string;
    };
  };
  type Framework7ViewHandle = Framework7View.View & {
    router?: Framework7Router;
  };
  type Framework7ActionsButton = {
    text: string;
    color?: string;
    bold?: boolean;
    onClick?: () => void;
  };
  type Framework7AppWithActions = {
    actions: {
      create: (params: {
        buttons: Framework7ActionsButton[][];
        backdrop?: boolean;
        closeByBackdropClick?: boolean;
        convertToPopover?: boolean;
        forceToPopover?: boolean;
        targetEl?: Element | string;
        containerEl?: string;
        on?: {
          closed?: () => void;
        };
      }) => Framework7ActionsInstance;
    };
  };

  const appParameters = {
    name: "web-chat-view-app-view",
    theme: "ios" as const,
    routes: [
      {
        path: "/review-shell-child/",
        component: ReviewShellRoutedPage,
      },
    ],
    popup: {
      closeOnEscape: true,
    },
    sheet: {
      closeOnEscape: true,
    },
    popover: {
      closeOnEscape: true,
    },
    actions: {
      closeOnEscape: true,
    },
  };

  const shellState = new ReviewShellState();
  let topNavbar: unknown = null;
  let mainView: Framework7ViewHandle | null = null;
  let mobileRouteSyncing = $state(false);
  let roomActionsSurface: Framework7ActionsInstance | null = null;
  let wideLayoutMediaQuery: MediaQueryList | null = null;
  let isWideLayout = $state(false);
  let resourcesSheetOpen = $state(false);
  let detailsSheetOpen = $state(false);
  let sourceEditorOpen = $state(false);
  let desktopMasterQuery = $state("");
  let mobileMessagesQuery = $state("");
  let mobileContactsQuery = $state("");
  let mobileSourcesQuery = $state("");
  let mobileProfilesQuery = $state("");
  let sourceDraft = $state({
    sourceId: "",
    label: "",
    endpoint: "",
    authToken: "",
  });

  const childSurfaceOpen = $derived(Boolean(shellState.roomOpen || shellState.selectedContact || shellState.sourcesOpen || shellState.profilesOpen));
  const mobileChildSurfaceOpen = $derived(childSurfaceOpen && !isWideLayout);
  const mobileRootShowsSearch = $derived(shellState.activeDestination !== "me");
  const mobileRootNavbarTitle = $derived.by(() => {
    if (shellState.activeDestination === "contacts") {
      return "Contacts";
    }
    if (shellState.activeDestination === "me") {
      return "Me";
    }
    return "Messages";
  });
  const mobileRootSearchPlaceholder = $derived.by(() => {
    if (shellState.activeDestination === "contacts") {
      return "Search contacts";
    }
    if (shellState.activeDestination === "me") {
      return "Search profiles";
    }
    return "Search conversations";
  });
  const mobileRootSearchValue = $derived.by(() => {
    if (shellState.activeDestination === "contacts") {
      return mobileContactsQuery;
    }
    if (shellState.activeDestination === "me") {
      return mobileProfilesQuery;
    }
    return mobileMessagesQuery;
  });
  const summarizeContactId = (contactId: string): string =>
    contactId.length > 16 ? `${contactId.slice(0, 8)}…${contactId.slice(-4)}` : contactId;

  const summarizeContactIdTight = (contactId: string): string =>
    contactId.length > 14 ? `${contactId.slice(0, 6)}…${contactId.slice(-4)}` : contactId;

  const summarizeEndpoint = (endpoint: string): string => {
    try {
      return new URL(endpoint).host;
    } catch {
      return endpoint.replace(/^https?:\/\//u, "");
    }
  };

  const wideMessagesDetailVisible = $derived(
    isWideLayout &&
      shellState.activeDestination === "messages" &&
      !shellState.roomOpen &&
      !shellState.selectedContact &&
      !shellState.sourcesOpen &&
      Boolean(shellState.activeChannel),
  );
  const roomActionsVisible = $derived(Boolean(shellState.activeChannel) && (shellState.roomOpen || wideMessagesDetailVisible));

  const navbarSubtitle = $derived.by(() => {
    if (wideMessagesDetailVisible || shellState.roomOpen) {
      return shellState.onlineSeatCount > 0 ? `${shellState.onlineSeatCount} online · ${shellState.transcriptDayLabel}` : shellState.roomSlug;
    }
    if (shellState.selectedContact) {
      return null;
    }
    if (shellState.selectedSource) {
      return null;
    }
    if (shellState.sourcesOpen) {
      return `${shellState.peopleProjection.sources.length} sources`;
    }
    if (shellState.activeDestination === "contacts") {
      return `${shellState.peopleProjection.contacts.length} contacts · ${shellState.peopleProjection.pendingRequestCount} pending`;
    }
    if (shellState.activeDestination === "me") {
      return shellState.activeContactProfile?.actorId
        ? summarizeContactId(shellState.activeContactProfile.actorId)
        : shellState.activeProfileMeta;
    }
    return shellState.activeProfileSummary;
  });
  const contactSections = $derived.by(() => {
    const sections = new Map<string, ReviewContactProjection[]>();
    for (const contact of shellState.peopleProjection.contacts) {
      const section = sections.get(contact.sourceLabel) ?? [];
      section.push(contact);
      sections.set(contact.sourceLabel, section);
    }
    return [...sections.entries()];
  });

  const resourceAfterLabel = (resource: WebChatResourceReference): string =>
    resource.extension?.toUpperCase() ?? resource.kind.toUpperCase();

  const resourceSubtitle = (resource: WebChatResourceReference): string =>
    [
      resource.fileName ?? resource.detailText ?? resource.tokenText ?? resource.kind,
      typeof resource.sizeBytes === "number" ? `${resource.sizeBytes} B` : "",
    ]
      .filter((value) => value.length > 0)
      .join(" · ");

  const resourceMediaLabel = (resource: WebChatResourceReference): string =>
    resource.kind === "comment"
      ? resource.label.replace(/^[^\d]*/u, "") || "1"
      : (resource.extension ?? resource.kind).slice(0, 3).toUpperCase();

  const avatarText = (label: string): string => label.trim().slice(0, 1).toUpperCase() || "?";

  const titleCaseWords = (value: string): string =>
    value
      .split(/[-_\s]+/u)
      .filter((part) => part.length > 0)
      .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
      .join(" ");

  const summarizeRequestDirection = (direction: "inbound" | "outbound"): string =>
    direction === "inbound" ? "Incoming" : "Outgoing";

  const summarizeRequestState = (state: string): string => titleCaseWords(state);

  const summarizeSourceHealthTone = (state: string): "positive" | "neutral" | "warning" =>
    state === "online" || state === "ready" ? "positive" : state === "pending" ? "warning" : "neutral";

  const activeSourceCount = $derived(shellState.peopleProjection.sources.length);
  const activeContactCount = $derived(shellState.peopleProjection.contacts.length);
  const activePendingCount = $derived(shellState.peopleProjection.pendingRequestCount);
  const directConversationCount = $derived(shellState.peopleProjection.conversations.filter((conversation) => conversation.kind === "direct").length);
  const totalDirectRoomCount = $derived(
    shellState.peopleProjection.contacts.filter((contact) => contact.localDirectChatId).length,
  );
  const reviewRoomConversation = $derived(
    shellState.peopleProjection.conversations.find((conversation) => conversation.kind === "room") ?? null,
  );
  const selectedSourceContacts = $derived(
    shellState.selectedSource
      ? shellState.peopleProjection.contacts.filter((contact) => contact.sourceId === shellState.selectedSource?.sourceId)
      : [],
  );
  const selectedSourceRequests = $derived(
    shellState.selectedSource
      ? shellState.peopleProjection.contactRequests.filter((request) => request.sourceId === shellState.selectedSource?.sourceId)
      : [],
  );
  const normalizedDesktopMasterQuery = $derived(desktopMasterQuery.trim().toLowerCase());
  const normalizedMobileMessagesQuery = $derived(mobileMessagesQuery.trim().toLowerCase());
  const normalizedMobileContactsQuery = $derived(mobileContactsQuery.trim().toLowerCase());
  const normalizedMobileProfilesQuery = $derived(mobileProfilesQuery.trim().toLowerCase());
  const conversationMatchesQuery = (
    conversation: (typeof shellState.peopleProjection.conversations)[number],
    query: string,
  ): boolean => [conversation.title, conversation.subtitle, conversation.meta].join(" ").toLowerCase().includes(query);
  const sourceMatchesQuery = (
    source: (typeof shellState.peopleProjection.sources)[number],
    query: string,
  ): boolean =>
    [source.label, source.endpoint, source.callbackSummary, source.trustState].join(" ").toLowerCase().includes(query);
  const filteredContactSections = $derived.by(() => {
    const query = normalizedDesktopMasterQuery;
    if (query.length === 0) {
      return contactSections;
    }
    return contactSections
      .map(([sourceLabel, contacts]) => [
        sourceLabel,
        contacts.filter((contact) => {
          const haystack = [contact.label, contact.subtitle, contact.sourceLabel, contact.remoteContactId].join(" ").toLowerCase();
          return haystack.includes(query);
        }),
      ] as const)
      .filter(([, contacts]) => contacts.length > 0);
  });
  const filteredConversations = $derived.by(() => {
    const query = normalizedDesktopMasterQuery;
    if (query.length === 0) {
      return shellState.peopleProjection.conversations;
    }
    return shellState.peopleProjection.conversations.filter((conversation) => conversationMatchesQuery(conversation, query));
  });
  const filteredSources = $derived.by(() => {
    const query = normalizedDesktopMasterQuery;
    if (query.length === 0) {
      return shellState.peopleProjection.sources;
    }
    return shellState.peopleProjection.sources.filter((source) => sourceMatchesQuery(source, query));
  });
  const filteredMobileConversations = $derived.by(() => {
    const query = normalizedMobileMessagesQuery;
    if (query.length === 0) {
      return shellState.peopleProjection.conversations;
    }
    return shellState.peopleProjection.conversations.filter((conversation) => conversationMatchesQuery(conversation, query));
  });
  const filteredMobileContactSections = $derived.by(() => {
    const query = normalizedMobileContactsQuery;
    if (query.length === 0) {
      return contactSections;
    }
    return contactSections
      .map(([sourceLabel, contacts]) => [
        sourceLabel,
        contacts.filter((contact) => {
          const haystack = [contact.label, contact.subtitle, contact.sourceLabel, contact.remoteContactId].join(" ").toLowerCase();
          return haystack.includes(query);
        }),
      ] as const)
      .filter(([, contacts]) => contacts.length > 0);
  });
  const filteredMobileProfiles = $derived.by(() => {
    const query = normalizedMobileProfilesQuery;
    if (query.length === 0) {
      return shellState.profiles;
    }
    return shellState.profiles.filter((profile) =>
      [profile.name, profile.transportUrl, profile.viewerContactId].join(" ").toLowerCase().includes(query),
    );
  });
  const filteredProfiles = $derived.by(() => {
    const query = normalizedDesktopMasterQuery;
    if (query.length === 0) {
      return shellState.profiles;
    }
    return shellState.profiles.filter((profile) =>
      [profile.name, profile.transportUrl, profile.viewerContactId].join(" ").toLowerCase().includes(query),
    );
  });
  const visibleDirectorySources = $derived(filteredSources);

  const desktopMasterTitle = $derived.by(() => {
    if (shellState.sourcesOpen) {
      return shellState.selectedSource ? "Source directory" : "Source management";
    }
    if (shellState.activeDestination === "contacts") {
      return "Contacts";
    }
    if (shellState.activeDestination === "me") {
      return "Profiles";
    }
    return "Conversations";
  });
  const desktopMasterSubtitle = $derived.by(() => {
    if (shellState.sourcesOpen) {
      return `${filteredSources.length} of ${shellState.peopleProjection.sources.length} sources`;
    }
    if (shellState.activeDestination === "contacts") {
      const visible = filteredContactSections.reduce((total, [, contacts]) => total + contacts.length, 0);
      return `${visible} visible · ${shellState.peopleProjection.pendingRequestCount} pending`;
    }
    if (shellState.activeDestination === "me") {
      return `${filteredProfiles.length} visible · ${shellState.profiles.length} saved`;
    }
    return `${filteredConversations.length} visible · ${shellState.peopleProjection.conversations.length} total`;
  });

  const desktopDetailTitle = $derived.by(() => {
    if (wideMessagesDetailVisible || shellState.roomOpen) {
      return shellState.activeChannel?.title ?? "Review room";
    }
    if (shellState.selectedContact) {
      return shellState.selectedContact.label;
    }
    if (shellState.selectedSource) {
      return shellState.selectedSource.label;
    }
    if (shellState.sourcesOpen) {
      return "Source directory";
    }
    if (shellState.activeDestination === "contacts") {
      return "Contact details";
    }
    if (shellState.activeDestination === "me") {
      return "Profile overview";
    }
    return "Review room";
  });

  const desktopDetailSubtitle = $derived.by(() => {
    if (wideMessagesDetailVisible || shellState.roomOpen) {
      return shellState.onlineSeatCount > 0 ? `${shellState.onlineSeatCount} online · ${shellState.transcriptDayLabel}` : shellState.roomSlug;
    }
    if (shellState.selectedContact) {
      return null;
    }
    if (shellState.selectedSource) {
      return null;
    }
    if (shellState.sourcesOpen) {
      return `${shellState.peopleProjection.sources.length} configured sources`;
    }
    if (shellState.activeDestination === "contacts") {
      return `${shellState.peopleProjection.contacts.length} contacts · ${shellState.peopleProjection.pendingRequestCount} pending`;
    }
    if (shellState.activeDestination === "me") {
      return `${activeSourceCount} sources · ${activeContactCount} contacts`;
    }
    return shellState.activeProfileMeta;
  });

  const openSourceEditor = (sourceId: string | null = null): void => {
    const source = sourceId
      ? shellState.peopleProjection.sources.find((candidate) => candidate.sourceId === sourceId)
      : null;
    sourceDraft = source
      ? {
          sourceId: source.sourceId,
          label: source.label,
          endpoint: source.endpoint,
          authToken: source.record.authToken ?? "",
        }
      : {
          sourceId: "",
          label: "",
          endpoint: "",
          authToken: "",
        };
    sourceEditorOpen = true;
  };

  const saveSourceDraft = (): void => {
    sourceEditorOpen = false;
    shellState.copied = "Source draft captured in the review shell; persistence belongs to message-system source APIs.";
  };

  const syncWideLayout = (): void => {
    isWideLayout = wideLayoutMediaQuery?.matches ?? false;
  };

  const destroyRoomActionsSurface = (): void => {
    roomActionsSurface?.destroy();
    roomActionsSurface = null;
  };

  const openRoomActions = (targetEl: EventTarget | null): void => {
    const actionTarget = targetEl instanceof Element ? targetEl : undefined;
    const framework7App = app.f7 as unknown as Framework7AppWithActions | undefined;
    if (!framework7App || !actionTarget) {
      return;
    }
    destroyRoomActionsSurface();
    roomActionsSurface = framework7App.actions.create({
      buttons: [
        [
          {
            text: "Refresh room",
            bold: true,
            onClick: () => {
              void shellState.refreshChannel();
            },
          },
          {
            text: "Copy review link",
            onClick: () => {
              void shellState.shareActiveProfile();
            },
          },
          {
            text: "Room resources",
            onClick: () => {
              resourcesSheetOpen = true;
            },
          },
          {
            text: "Room details",
            onClick: () => {
              detailsSheetOpen = true;
            },
          },
        ],
        [{ text: "Cancel", bold: true }],
      ],
      backdrop: true,
      closeByBackdropClick: true,
      convertToPopover: true,
      forceToPopover: false,
      targetEl: actionTarget,
      containerEl: "body",
      on: {
        closed: () => {
          destroyRoomActionsSurface();
        },
      },
    });
    roomActionsSurface.open();
  };

  const startContactChat = (contact: ReviewContactProjection): void => {
    if (contact.localDirectChatId && contact.localDirectChatId === shellState.activeChannel?.chatId) {
      openShellRoom();
      return;
    }
    shellState.copied = "Direct chat bootstrap is explicit in message-system; this review harness has no remote room yet.";
  };

  const childRoutePath = "/review-shell-child/";
  const hasMobileChildRoute = (): boolean => {
    const router = mainView?.router;
    if (!router) {
      return false;
    }
    const currentRoutePath = router.currentRoute?.path ?? router.currentRoute?.url;
    return (
      currentRoutePath === childRoutePath ||
      Boolean(document.querySelector('.page[data-name="review-shell-child"].page-current'))
    );
  };
  const syncMobileChildRoute = async (): Promise<void> => {
    if (shellState.appViewMode === "room") {
      return;
    }
    if (mobileRouteSyncing) {
      return;
    }
    await tick();
    const router = mainView?.router;
    if (!router) {
      return;
    }
    const routeOpen = hasMobileChildRoute();
    if (isWideLayout) {
      if (routeOpen) {
        mobileRouteSyncing = true;
        try {
          router.back("/", {
            animate: false,
          });
        } finally {
          mobileRouteSyncing = false;
        }
      }
      return;
    }
    if (mobileChildSurfaceOpen && !routeOpen) {
      mobileRouteSyncing = true;
      try {
        router.navigate(childRoutePath, {
          props: { page: mobileChildShellPage },
          animate: true,
        });
      } finally {
        mobileRouteSyncing = false;
      }
      return;
    }
    if (!mobileChildSurfaceOpen && routeOpen) {
      mobileRouteSyncing = true;
      try {
        router.back("/", {
          animate: true,
        });
      } finally {
        mobileRouteSyncing = false;
      }
    }
  };

  const runShellNavigation = async (navigate: () => void): Promise<void> => {
    navigate();
    await syncMobileChildRoute();
  };

  const openShellConversation = (conversation: {
    chatId: string | null;
    contactKey: string | null;
    openableRoom: boolean;
  }): void => {
    void runShellNavigation(() => shellState.openConversation(conversation));
  };

  const openShellDestination = (destination: "messages" | "contacts" | "me"): Promise<void> =>
    runShellNavigation(() => shellState.openDestination(destination));

  const openShellContact = (contactKey: string): Promise<void> => runShellNavigation(() => shellState.openContact(contactKey));

  const openShellSources = (sourceId: string | null = null): Promise<void> =>
    runShellNavigation(() => shellState.openSources(sourceId));

  const openShellProfiles = (): Promise<void> => runShellNavigation(() => shellState.openProfiles());

  const openShellRoom = (): Promise<void> => runShellNavigation(() => shellState.openRoom());

  const backFromShellChildSurface = (): void => {
    shellState.backFromChildSurface();
    void syncMobileChildRoute();
  };

  const handleMobileChildBack = (): void => {
    if (shellState.selectedSourceId) {
      shellState.backFromChildSurface();
      return;
    }
    shellState.backFromChildSurface();
    const router = mainView?.router;
    if (!isWideLayout && router && hasMobileChildRoute()) {
      mobileRouteSyncing = true;
      try {
        router.back("/", {
          animate: true,
        });
      } finally {
        mobileRouteSyncing = false;
      }
    }
  };

  const reviewShellExposedState: ReviewShellExposedState = new Proxy(shellState, {
    get(target, property) {
      if (property === "openDestination") {
        return openShellDestination;
      }
      if (property === "openContact") {
        return openShellContact;
      }
      if (property === "openSources") {
        return openShellSources;
      }
      if (property === "openRoom") {
        return openShellRoom;
      }
      if (property === "openProfiles") {
        return openShellProfiles;
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  const exposeReviewShellState = (): void => {
    if (typeof window === "undefined") {
      return;
    }
    (window as typeof window & { __reviewShellState?: ReviewShellExposedState }).__reviewShellState = reviewShellExposedState;
  };


  const matchesSuggestionQuery = (suggestion: WebChatComposerMentionSuggestion, normalized: string): boolean => {
    if (normalized.length === 0) {
      return true;
    }
    return (
      suggestion.label.toLowerCase().includes(normalized) ||
      suggestion.id.toLowerCase().includes(normalized) ||
      (suggestion.detail?.toLowerCase().includes(normalized) ?? false)
    );
  };

  const resolveComposerMentionSuggestions = ({
    query,
  }: {
    query: string;
  }): readonly WebChatComposerMentionSuggestion[] => {
    const normalized = query.trim().toLowerCase();
    const participantSuggestions = shellState.participantPresentations.map((participant) => ({
      id: participant.actorId,
      label: participant.label,
      detail: participant.actorId,
      iconUrl: participant.iconUrl,
    }));
    const suggestions = [...participantSuggestions, ...shellState.contactMentionSuggestions];
    return suggestions.filter((suggestion) => matchesSuggestionQuery(suggestion, normalized));
  };

  onMount(() => {
    exposeReviewShellState();
    if (typeof window !== "undefined" && "matchMedia" in window) {
      wideLayoutMediaQuery = window.matchMedia("(min-width: 1024px)");
      syncWideLayout();
      wideLayoutMediaQuery.addEventListener("change", syncWideLayout);
    }
    void shellState.initializeShell();

    return () => {
      if (typeof window !== "undefined") {
        delete (window as typeof window & { __reviewShellState?: ReviewShellExposedState }).__reviewShellState;
      }
      wideLayoutMediaQuery?.removeEventListener("change", syncWideLayout);
      wideLayoutMediaQuery = null;
    };
  });

  $effect(() => {
    shellState.navbarTitle;
    navbarSubtitle;
    childSurfaceOpen;
    mobileChildSurfaceOpen;
    shellState.roomOpen;
    shellState.activeDestination;
    shellState.selectedContact?.key;
    shellState.selectedSource?.sourceId;
    isWideLayout;

    void tick().then(() => {
      if (typeof topNavbar === "object" && topNavbar !== null && "size" in topNavbar) {
        const candidate = topNavbar as Framework7NavbarHandle;
        candidate.size?.();
      }
      void syncMobileChildRoute();
    });
  });

  $effect(() => {
    if (!isWideLayout) {
      return;
    }
    if (shellState.activeDestination === "contacts" && !shellState.sourcesOpen && !shellState.selectedContact) {
      const firstContact = shellState.peopleProjection.contacts[0];
      if (firstContact) {
        shellState.openContact(firstContact.key);
      }
    }
  });

  $effect(() => {
    if (!isWideLayout) {
      return;
    }
    if (!shellState.sourcesOpen || shellState.selectedSource) {
      return;
    }
    const firstSource = shellState.peopleProjection.sources[0];
    if (firstSource) {
      shellState.openSources(firstSource.sourceId);
    }
  });

  onDestroy(() => {
    destroyRoomActionsSurface();
  });
</script>

{#snippet shellStatusBlock()}
  {#if shellState.errorMessage || shellState.copied}
    <Block strong inset>
      {#if shellState.errorMessage}
        <div class="review-shell-status review-shell-status--error">{shellState.errorMessage}</div>
      {/if}
      {#if shellState.copied}
        <div class="review-shell-status review-shell-status--success">{shellState.copied}</div>
      {/if}
    </Block>
  {/if}
{/snippet}

{#snippet reviewIcon(kind: "chat" | "source" | "add" | "sourceBack" | "edit" | "profile" | "setup" | "refresh" | "share" | "trash" | "users" | "me" | "more", size = 18)}
  {#if kind === "chat"}
    <ChatBubble size={size} aria-hidden="true" />
  {:else if kind === "source"}
    <SourceIcon size={size} aria-hidden="true" />
  {:else if kind === "add"}
    <PlusIcon size={size} aria-hidden="true" />
  {:else if kind === "sourceBack"}
    <SourceIcon size={size} aria-hidden="true" />
  {:else if kind === "edit"}
    <PencilIcon size={size} aria-hidden="true" />
  {:else if kind === "profile"}
    <PersonVerified size={size} aria-hidden="true" />
  {:else if kind === "setup"}
    <SlidersIcon size={size} aria-hidden="true" />
  {:else if kind === "refresh"}
    <ArrowClockwise size={size} aria-hidden="true" />
  {:else if kind === "share"}
    <ShareIcon size={size} aria-hidden="true" />
  {:else if kind === "trash"}
    <TrashIcon size={size} aria-hidden="true" />
  {:else if kind === "users"}
    <UsersIcon size={size} aria-hidden="true" />
  {:else if kind === "me"}
    <PersonCircle size={size} aria-hidden="true" />
  {:else}
    <EllipsisIcon size={size} aria-hidden="true" />
  {/if}
{/snippet}

{#snippet reviewRoomList(includeOpenSetup: boolean)}
  <List mediaList strongIos dividersIos insetIos>
    {#each filteredConversations as conversation (conversation.id)}
      <ListItem
        link
        title={conversation.title}
        subtitle={conversation.subtitle}
        after={conversation.meta}
        data-review-conversation-id={conversation.id}
        selected={
          conversation.kind === "room"
            ? shellState.roomOpen || wideMessagesDetailVisible
            : shellState.selectedContact?.key === conversation.contactKey
        }
        onClick={() => openShellConversation(conversation)}
      >
        {#snippet media()}
          <span
            class="review-shell-conversation-media"
            data-kind={conversation.kind}
            data-review-conversation-id={conversation.id}
          >
            {conversation.avatarLabel}
          </span>
        {/snippet}
      </ListItem>
    {/each}
  </List>
  {#if includeOpenSetup && !shellState.activeChannel}
    <Block strongIos insetIos>
      <Button fill largeIos onClick={() => (shellState.shellPanelOpen = true)}>Open setup</Button>
    </Block>
  {/if}
{/snippet}

{#snippet requestHistoryList(
  requests = shellState.peopleProjection.contactRequests,
  emptyTitle = "No requests",
  emptyCopy = "No contact requests are recorded right now.",
)}
  {#if requests.length > 0}
    <List mediaList strongIos dividersIos insetIos>
      {#each requests as request (request.key)}
        <ListItem
          title={request.label}
          subtitle={`${request.sourceLabel} · ${request.direction} · ${request.state}`}
          after={request.message ? "note" : undefined}
          data-review-request-key={request.key}
          data-review-request-source={request.sourceId}
          data-review-request-direction={request.direction}
          data-review-request-state={request.state}
        >
          {#snippet media()}
            <span class="review-shell-contact-media">
              {#if request.iconUrl}
                <img src={request.iconUrl} alt={request.label} />
              {:else}
                {avatarText(request.label)}
              {/if}
            </span>
          {/snippet}
        </ListItem>
      {/each}
    </List>
  {:else}
    <Block strongIos insetIos>
      <div class="review-shell-note-title">{emptyTitle}</div>
      <div class="review-shell-meta-copy">{emptyCopy}</div>
    </Block>
  {/if}
{/snippet}

{#snippet contactsSectionList()}
  <List contactsList ul={false} strongIos class="review-shell-contacts-directory">
    {#each filteredContactSections as [sourceLabel, contacts] (sourceLabel)}
      <ListGroup>
        <ListItem title={sourceLabel} groupTitle />
        {#each contacts as contact (contact.key)}
          <ListItem
            link
            title={contact.label}
            subtitle={contact.subtitle}
            after={contact.directLabel}
            data-review-contact-key={contact.key}
            selected={shellState.selectedContact?.key === contact.key}
            onClick={() => openShellContact(contact.key)}
          >
            {#snippet media()}
              <span class="review-shell-contact-media" data-review-contact-key={contact.key}>
                {#if contact.iconUrl}
                  <img src={contact.iconUrl} alt={contact.label} />
                {:else}
                  {avatarText(contact.label)}
                {/if}
              </span>
            {/snippet}
          </ListItem>
        {/each}
      </ListGroup>
    {/each}
  </List>
{/snippet}

{#snippet contactDetailSurface()}
  <PageContent class="review-shell-page-content" data-stage="list" data-child={mobileChildSurfaceOpen ? "true" : "false"}>
    {@render shellStatusBlock()}
    <List strongIos insetIos dividersIos class="review-shell-summary-list">
      <ListItem
        class="review-shell-summary-item"
        title={shellState.selectedContact?.label}
        subtitle={undefined}
        after={shellState.selectedContact?.localDirectChatId ? "Direct" : "Contact"}
      >
        {#snippet media()}
          <span class="review-shell-contact-media review-shell-contact-media--detail">
            {#if shellState.selectedContact?.iconUrl}
              <img src={shellState.selectedContact.iconUrl} alt={shellState.selectedContact.label} />
            {:else}
              {avatarText(shellState.selectedContact?.label ?? "")}
            {/if}
          </span>
        {/snippet}
      </ListItem>
    </List>
    <BlockTitle>Actions</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem
        link
        title={shellState.selectedContact?.localDirectChatId ? "Open Chat" : "Start Chat"}
        subtitle={shellState.selectedContact?.localDirectChatId ? "Open the linked direct room" : "Bootstrap a direct room from this contact"}
        data-review-contact-action="start-chat"
        onClick={() => shellState.selectedContact && startContactChat(shellState.selectedContact)}
      >
        {#snippet media()}
          <span class="review-shell-action-media" data-review-contact-action="start-chat">
            {@render reviewIcon("chat", 17)}
          </span>
        {/snippet}
      </ListItem>
      <ListItem
        link
        title="View Source"
        subtitle="Jump to the owning source and its transport state"
        data-review-contact-action="view-source"
        onClick={() => openShellSources(shellState.selectedContact?.sourceId ?? null)}
      >
        {#snippet media()}
          <span class="review-shell-source-media" data-review-contact-action="view-source">{@render reviewIcon("source", 18)}</span>
        {/snippet}
      </ListItem>
    </List>
    <BlockTitle>Details</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem title="Source" subtitle={shellState.selectedContact?.sourceLabel} after={shellState.selectedContact?.sourceId} />
      <ListItem title="Remote contact" subtitle={shellState.selectedContact?.remoteContactId} />
      <ListItem
        title="Direct room"
        subtitle={shellState.selectedContact?.localDirectChatId ?? "No linked room yet"}
        after={shellState.selectedContact?.localDirectChatId ? "Ready" : undefined}
      />
    </List>
  </PageContent>
{/snippet}

{#snippet desktopContactDetailSurface()}
  <PageContent class="review-shell-page-content" data-stage="list" data-child="false">
    {@render shellStatusBlock()}
    <List strongIos insetIos dividersIos class="review-shell-summary-list">
      <ListItem
        class="review-shell-summary-item"
        title={shellState.selectedContact?.label}
        subtitle={undefined}
        after={shellState.selectedContact?.localDirectChatId ? "Direct" : "Contact"}
      >
        {#snippet media()}
          <span class="review-shell-contact-media review-shell-contact-media--detail">
            {#if shellState.selectedContact?.iconUrl}
              <img src={shellState.selectedContact.iconUrl} alt={shellState.selectedContact.label} />
            {:else}
              {avatarText(shellState.selectedContact?.label ?? "")}
            {/if}
          </span>
        {/snippet}
      </ListItem>
    </List>
    <BlockTitle>Actions</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem
        link
        title={shellState.selectedContact?.localDirectChatId ? "Open Chat" : "Start Chat"}
        subtitle={shellState.selectedContact?.localDirectChatId ? "Open the linked direct room" : "Bootstrap a direct room from this contact"}
        data-review-contact-action="start-chat"
        onClick={() => shellState.selectedContact && startContactChat(shellState.selectedContact)}
      >
        {#snippet media()}
          <span class="review-shell-action-media" data-review-contact-action="start-chat">
            {@render reviewIcon("chat", 17)}
          </span>
        {/snippet}
      </ListItem>
      <ListItem
        link
        title="View Source"
        subtitle="Jump to the owning source and its transport state"
        data-review-contact-action="view-source"
        onClick={() => openShellSources(shellState.selectedContact?.sourceId ?? null)}
      >
        {#snippet media()}
          <span class="review-shell-source-media" data-review-contact-action="view-source">{@render reviewIcon("source", 18)}</span>
        {/snippet}
      </ListItem>
    </List>
    <BlockTitle>Details</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem title="Source" subtitle={shellState.selectedContact?.sourceLabel} after={shellState.selectedContact?.sourceId} />
      <ListItem title="Remote contact" subtitle={shellState.selectedContact?.remoteContactId} />
      <ListItem
        title="Direct room"
        subtitle={shellState.selectedContact?.localDirectChatId ?? "No linked room yet"}
        after={shellState.selectedContact?.localDirectChatId ? "Ready" : undefined}
      />
    </List>
  </PageContent>
{/snippet}

{#snippet sourcesListSurface()}
  <PageContent class="review-shell-page-content" data-stage="list" data-child={mobileChildSurfaceOpen ? "true" : "false"}>
    {@render shellStatusBlock()}
    <BlockTitle>Overview</BlockTitle>
    <List strongIos insetIos dividersIos>
      <ListItem title="Configured sources" subtitle={`${activeSourceCount} endpoints on this review profile`} after={`${activeSourceCount}`} />
      <ListItem
        title="Projected contacts"
        subtitle={activeContactCount > 0 ? `${activeContactCount} contacts mapped through these sources` : "No contacts projected yet"}
        after={`${activeContactCount}`}
      />
    </List>
    <BlockTitle>Sources</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      {#each visibleDirectorySources as source (source.sourceId)}
        <ListItem
          link
          title={source.label}
          subtitle={`${summarizeEndpoint(source.endpoint)} · ${source.callbackSummary === "No callback source" ? "no callback" : "callback ready"}`}
          after={source.trustState}
          data-review-source-id={source.sourceId}
          selected={shellState.selectedSource?.sourceId === source.sourceId}
          onClick={() => openShellSources(source.sourceId)}
        >
          {#snippet media()}
            <span class="review-shell-source-media">{@render reviewIcon("source", 18)}</span>
          {/snippet}
        </ListItem>
      {/each}
    </List>
    {#if visibleDirectorySources.length === 0}
      <Block strongIos insetIos>
        <div class="review-shell-note-title">No matching sources</div>
        <div class="review-shell-meta-copy">Try a different keyword or add another source.</div>
      </Block>
    {/if}
    <BlockTitle>Actions</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem link title="Add source" subtitle="Create another transport endpoint" onClick={() => openSourceEditor()}>
        {#snippet media()}
          <span class="review-shell-action-media">
            {@render reviewIcon("add", 17)}
          </span>
        {/snippet}
      </ListItem>
    </List>
  </PageContent>
{/snippet}

{#snippet sourceDetailSurface()}
  <PageContent class="review-shell-page-content" data-stage="list" data-child={mobileChildSurfaceOpen ? "true" : "false"}>
    {@render shellStatusBlock()}
    <List strongIos insetIos dividersIos class="review-shell-summary-list">
      <ListItem
        class="review-shell-summary-item"
        title={shellState.selectedSource?.label}
        subtitle={undefined}
        after={titleCaseWords(shellState.selectedSource?.trustState ?? "")}
      >
        {#snippet media()}
          <span class="review-shell-source-media review-shell-source-media--detail">{@render reviewIcon("source", 20)}</span>
        {/snippet}
      </ListItem>
    </List>
    <BlockTitle>Runtime</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem title="Contacts" subtitle="Projected from this source" after={`${shellState.selectedSource?.contactCount ?? 0}`} />
      <ListItem title="Pending requests" subtitle="Introductions waiting in review" after={`${shellState.selectedSource?.pendingRequestCount ?? 0}`} />
      <ListItem title="Credential" subtitle={shellState.selectedSource?.record.authToken ? "Auth token saved" : "No auth token saved"} />
    </List>
    <BlockTitle>Actions</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem
        link
        title="Edit Source"
        subtitle="Adjust endpoint, token, and callback routing"
        data-review-source-action="edit"
        onClick={() => openSourceEditor(shellState.selectedSource?.sourceId ?? null)}
      >
        {#snippet media()}
          <span class="review-shell-review-media" data-review-source-action="edit">{@render reviewIcon("edit", 17)}</span>
        {/snippet}
      </ListItem>
      <ListItem link title="All Sources" subtitle="Return to the source directory" onClick={() => backFromShellChildSurface()}>
        {#snippet media()}
          <span class="review-shell-action-media review-shell-action-media--neutral">{@render reviewIcon("sourceBack", 16)}</span>
        {/snippet}
      </ListItem>
    </List>
    <BlockTitle>Transport</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem title="Source id" subtitle={shellState.selectedSource?.sourceId} />
      <ListItem title="Endpoint" subtitle={shellState.selectedSource?.endpoint} />
      <ListItem title="Callback source" subtitle={shellState.selectedSource?.callbackSummary} />
    </List>
    <BlockTitle>Contacts</BlockTitle>
    {#if selectedSourceContacts.length > 0}
      <List mediaList strongIos insetIos dividersIos>
        {#each selectedSourceContacts as contact (contact.key)}
          <ListItem
            link
            title={contact.label}
            subtitle={contact.subtitle}
            after={contact.localDirectChatId ? "direct" : "contact"}
            data-review-contact-key={contact.key}
            onClick={() => openShellContact(contact.key)}
          >
            {#snippet media()}
              <span class="review-shell-contact-media">
                {#if contact.iconUrl}
                  <img src={contact.iconUrl} alt={contact.label} />
                {:else}
                  {avatarText(contact.label)}
                {/if}
              </span>
            {/snippet}
          </ListItem>
        {/each}
      </List>
    {:else}
      <Block strongIos insetIos>
        <div class="review-shell-note-title">No linked contacts</div>
        <div class="review-shell-meta-copy">No contacts are linked to this source yet.</div>
      </Block>
    {/if}
    {#if selectedSourceRequests.length > 0}
      <BlockTitle>Requests</BlockTitle>
      <List mediaList strongIos insetIos dividersIos>
        {#each selectedSourceRequests as request (request.key)}
          <ListItem
            title={request.label}
            subtitle={`${summarizeRequestDirection(request.direction)} · ${summarizeRequestState(request.state)}`}
            data-review-request-key={request.key}
            data-review-request-source={request.sourceId}
            data-review-request-direction={request.direction}
            data-review-request-state={request.state}
          >
            {#snippet media()}
              <span class="review-shell-contact-media">
                {#if request.iconUrl}
                  <img src={request.iconUrl} alt={request.label} />
                {:else}
                  {avatarText(request.label)}
                {/if}
              </span>
            {/snippet}
          </ListItem>
        {/each}
      </List>
    {/if}
  </PageContent>
{/snippet}

{#snippet desktopSourceDetailSurface()}
  <PageContent class="review-shell-page-content" data-stage="list" data-child="false">
    {@render shellStatusBlock()}
    <List strongIos insetIos dividersIos class="review-shell-summary-list">
      <ListItem
        class="review-shell-summary-item"
        title={shellState.selectedSource?.label}
        subtitle={undefined}
        after={titleCaseWords(shellState.selectedSource?.trustState ?? "")}
      >
        {#snippet media()}
          <span class="review-shell-source-media review-shell-source-media--detail">{@render reviewIcon("source", 18)}</span>
        {/snippet}
      </ListItem>
    </List>
    <BlockTitle>Runtime</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem title="Contacts" subtitle="Projected from this source" after={`${shellState.selectedSource?.contactCount ?? 0}`} />
      <ListItem title="Pending requests" subtitle="Introductions waiting in review" after={`${shellState.selectedSource?.pendingRequestCount ?? 0}`} />
      <ListItem title="Credential" subtitle={shellState.selectedSource?.record.authToken ? "Auth token saved" : "No auth token saved"} />
    </List>
    <BlockTitle>Actions</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem
        link
        title="Edit Source"
        subtitle="Adjust endpoint, token, and callback routing"
        data-review-source-action="edit"
        onClick={() => openSourceEditor(shellState.selectedSource?.sourceId ?? null)}
      >
        {#snippet media()}
          <span class="review-shell-review-media" data-review-source-action="edit">{@render reviewIcon("edit", 17)}</span>
        {/snippet}
      </ListItem>
      <ListItem link title="All Sources" subtitle="Return to the source directory" onClick={() => openShellSources()}>
        {#snippet media()}
          <span class="review-shell-action-media review-shell-action-media--neutral">{@render reviewIcon("sourceBack", 16)}</span>
        {/snippet}
      </ListItem>
    </List>
    <BlockTitle>Transport</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem title="Source id" subtitle={shellState.selectedSource?.sourceId} />
      <ListItem title="Endpoint" subtitle={shellState.selectedSource?.endpoint} />
      <ListItem title="Callback source" subtitle={shellState.selectedSource?.callbackSummary} />
    </List>
    <BlockTitle>Contacts</BlockTitle>
    {#if selectedSourceContacts.length > 0}
      <List mediaList strongIos insetIos dividersIos>
        {#each selectedSourceContacts as contact (contact.key)}
          <ListItem
            link
            title={contact.label}
            subtitle={contact.subtitle}
            after={contact.localDirectChatId ? "direct" : "contact"}
            data-review-contact-key={contact.key}
            onClick={() => openShellContact(contact.key)}
          >
            {#snippet media()}
              <span class="review-shell-contact-media">
                {#if contact.iconUrl}
                  <img src={contact.iconUrl} alt={contact.label} />
                {:else}
                  {avatarText(contact.label)}
                {/if}
              </span>
            {/snippet}
          </ListItem>
        {/each}
      </List>
    {:else}
      <Block strongIos insetIos>
        <div class="review-shell-meta-copy">No contacts are linked to this source yet.</div>
      </Block>
    {/if}
    {#if selectedSourceRequests.length > 0}
      <BlockTitle>Requests</BlockTitle>
      <List mediaList strongIos insetIos dividersIos>
        {#each selectedSourceRequests as request (request.key)}
          <ListItem
            title={request.label}
            subtitle={`${summarizeRequestDirection(request.direction)} · ${summarizeRequestState(request.state)}`}
            data-review-request-key={request.key}
            data-review-request-source={request.sourceId}
            data-review-request-direction={request.direction}
            data-review-request-state={request.state}
          >
            {#snippet media()}
              <span class="review-shell-contact-media">
                {#if request.iconUrl}
                  <img src={request.iconUrl} alt={request.label} />
                {:else}
                  {avatarText(request.label)}
                {/if}
              </span>
            {/snippet}
          </ListItem>
        {/each}
      </List>
    {/if}
  </PageContent>
{/snippet}

{#snippet roomChatSurface()}
  <div
    class="review-shell-room-page-content"
    data-stage={shellState.activeChannel ? "room" : "list"}
    data-child={mobileChildSurfaceOpen ? "true" : "false"}
  >
    {@render shellStatusBlock()}
    {#if shellState.activeChannel}
      <WebChatViewHost
        class="review-shell-chat-host"
        channel={shellState.activeChannel}
        initialMessages={shellState.initialMessages}
        initialSnapshotResolved={shellState.initialSnapshotResolved}
        showHeader={false}
        viewerActorId={shellState.activeProfile?.viewerContactId ?? null}
        resolveActorPresentation={
          shellState.actorResolver
            ? ({ actorId, fallbackLabel }: WebChatActorResolveInput) => shellState.actorResolver?.({ actorId, fallbackLabel }) ?? null
            : undefined
        }
        onSendMessage={shellState.activeProfile?.appViewMode === "room" ? undefined : (payload) => shellState.sendMessage(payload)}
        onLatestVisibleMessageIdChange={(message) => {
          if (message?.messageId && shellState.activeProfile?.appViewMode === "room") {
            void shellState.markLatestVisibleMessageRead(message.messageId);
          }
        }}
        composerCapabilities={{
          attachmentEnabled: shellState.activeProfile?.appViewMode !== "room",
          imageEnabled: shellState.activeProfile?.appViewMode !== "room",
          screenshotEnabled: shellState.activeProfile?.appViewMode !== "room",
          placeholder: shellState.activeProfile?.appViewMode === "room" ? "Message room" : "Message review room",
          resourceReferences: shellState.resourceReferences,
        }}
        {resolveComposerMentionSuggestions}
      />
    {:else}
      <Block strongIos insetIos class="review-shell-empty-block">
        <div class="review-shell-empty-copy">
          <div class="review-shell-empty-title">Review room needed</div>
          <p>Save or import a profile before opening chat.</p>
        </div>
      </Block>
    {/if}
  </div>
{/snippet}

{#snippet messagesRootSurface(includeOpenSetup: boolean)}
  {@render shellStatusBlock()}
  <BlockTitle>Conversations</BlockTitle>
  <List mediaList strongIos dividersIos insetIos>
    {#each filteredMobileConversations as conversation (conversation.id)}
    <ListItem
      link
      title={conversation.title}
      subtitle={conversation.subtitle}
      after={conversation.meta}
      data-review-conversation-id={conversation.id}
      selected={
        conversation.kind === "room"
          ? shellState.roomOpen || wideMessagesDetailVisible
            : shellState.selectedContact?.key === conversation.contactKey
        }
        onClick={() => openShellConversation(conversation)}
      >
        {#snippet media()}
          <span class="review-shell-conversation-media" data-kind={conversation.kind}>
            {conversation.avatarLabel}
          </span>
        {/snippet}
      </ListItem>
    {/each}
  </List>
  {#if filteredMobileConversations.length === 0}
    <Block strongIos insetIos>
      <div class="review-shell-note-title">No matching conversations</div>
      <div class="review-shell-meta-copy">Try a different keyword.</div>
    </Block>
  {/if}
  {#if includeOpenSetup && !shellState.activeChannel}
    <Block strongIos insetIos>
      <Button fill largeIos onClick={() => (shellState.shellPanelOpen = true)}>Open setup</Button>
    </Block>
  {/if}
{/snippet}

{#snippet contactsRootSurface()}
  {@render shellStatusBlock()}
  <List strongIos insetIos dividersIos>
    <ListItem
      title="Pending requests"
      subtitle={activePendingCount > 0 ? "Review introductions waiting for a response" : "No pending introductions"}
      after={`${activePendingCount}`}
    />
    <ListItem
      title="Contacts"
      subtitle={activeContactCount > 0 ? "Projected across all active sources" : "No contacts projected yet"}
      after={`${activeContactCount}`}
    />
  </List>
  <BlockTitle>Requests</BlockTitle>
  {@render requestHistoryList()}
  <List contactsList ul={false} strongIos class="review-shell-contacts-directory">
    {#each filteredMobileContactSections as [sourceLabel, contacts] (sourceLabel)}
      <ListGroup>
        <ListItem title={sourceLabel} groupTitle />
        {#each contacts as contact (contact.key)}
          <ListItem
            link
            title={contact.label}
            subtitle={contact.subtitle}
            after={contact.directLabel}
            data-review-contact-key={contact.key}
            selected={shellState.selectedContact?.key === contact.key}
            onClick={() => openShellContact(contact.key)}
          >
            {#snippet media()}
              <span class="review-shell-contact-media">
                {#if contact.iconUrl}
                  <img src={contact.iconUrl} alt={contact.label} />
                {:else}
                  {avatarText(contact.label)}
                {/if}
              </span>
            {/snippet}
          </ListItem>
        {/each}
      </ListGroup>
    {/each}
  </List>
  {#if filteredMobileContactSections.length === 0}
    <Block strongIos insetIos>
      <div class="review-shell-note-title">No matching contacts</div>
      <div class="review-shell-meta-copy">Try a different keyword.</div>
    </Block>
  {/if}
{/snippet}

{#snippet meRootSurface()}
  {@render shellStatusBlock()}
  <BlockTitle>Current profile</BlockTitle>
  <List mediaList strongIos insetIos dividersIos>
    <ListItem
      title={shellState.activeContactProfile?.label ?? shellState.activeProfileSummary}
      subtitle={`${summarizeContactId(shellState.activeContactProfile?.actorId ?? shellState.activeProfileMeta)} · ${shellState.activeChannel ? "online" : "offline"}`}
      after={shellState.activeChannel ? "active" : "offline"}
    >
      {#snippet media()}
        <span class="review-shell-contact-media review-shell-contact-media--profile">
          {avatarText(shellState.activeContactProfile?.label ?? shellState.activeProfileSummary)}
        </span>
      {/snippet}
    </ListItem>
  </List>
  <BlockTitle>Access</BlockTitle>
  <List mediaList strongIos insetIos dividersIos>
    <ListItem
      link
      title="Profiles"
      subtitle={`${shellState.profiles.length} saved review identities`}
      data-review-me-action="profiles"
      onClick={() => openShellProfiles()}
    >
      {#snippet media()}
        <span class="review-shell-profile-media" data-review-me-entry="profiles">{@render reviewIcon("profile", 20)}</span>
      {/snippet}
    </ListItem>
    <ListItem
      link
      title="Source Management"
      subtitle={`${shellState.peopleProjection.sources.length} configured sources`}
      data-review-me-action="source-directory"
      onClick={() => openShellSources()}
    >
      {#snippet media()}
        <span class="review-shell-source-media" data-review-me-entry="source-management">{@render reviewIcon("source", 20)}</span>
      {/snippet}
    </ListItem>
    <ListItem
      link
      title="Review Setup"
      subtitle="Transport identity, token, and viewer contact"
      onClick={() => (shellState.shellPanelOpen = true)}
    >
      {#snippet media()}
        <span class="review-shell-review-media" data-review-me-entry="review-setup">{@render reviewIcon("setup", 20)}</span>
      {/snippet}
    </ListItem>
  </List>
  <BlockTitle>Overview</BlockTitle>
  <List strongIos insetIos dividersIos>
    <ListItem title="Sources" subtitle="Configured on this review profile" after={`${activeSourceCount}`} />
    <ListItem title="Contacts" subtitle="Projected across connected sources" after={`${activeContactCount}`} />
    <ListItem title="Direct rooms" subtitle="Linked from contact identity" after={`${totalDirectRoomCount}`} />
    <ListItem
      title="Pending requests"
      subtitle={activePendingCount > 0 ? "Introductions waiting in review" : "No pending introductions"}
      after={`${activePendingCount}`}
    />
  </List>
  <BlockTitle>Live state</BlockTitle>
  <List mediaList strongIos insetIos dividersIos>
    <ListItem title="Profile name" subtitle={shellState.activeProfile?.name ?? "none"} />
    <ListItem title="Viewer contact" subtitle={shellState.activeProfileMeta} />
    <ListItem title="Connected room" subtitle={shellState.activeChannel?.title ?? "Waiting for bootstrap"} />
    <ListItem title="Pending requests" after={`${activePendingCount}`} />
  </List>
{/snippet}

{#snippet profilesListSurface()}
  <PageContent class="review-shell-page-content" data-stage="list" data-child="true">
    {@render shellStatusBlock()}
    <BlockTitle>Profiles</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      {#each filteredMobileProfiles as profile (profile.id)}
        <ListItem
          link
          title={profile.name}
          subtitle={`${summarizeEndpoint(profile.transportUrl)} · ${summarizeContactId(profile.viewerContactId)}`}
          selected={shellState.selectedProfileId === profile.id}
          after={shellState.selectedProfileId === profile.id ? "Active" : undefined}
          onClick={() => {
            void shellState.selectProfile(profile);
          }}
        >
          {#snippet media()}
            <span class="review-shell-profile-media review-shell-profile-media--list">{avatarText(profile.name)}</span>
          {/snippet}
        </ListItem>
      {/each}
    </List>
    {#if filteredMobileProfiles.length === 0}
      <Block strongIos insetIos>
        <div class="review-shell-note-title">No matching profiles</div>
        <div class="review-shell-meta-copy">Try a different keyword.</div>
      </Block>
    {/if}
  </PageContent>
{/snippet}

{#snippet desktopMeDetailSurface()}
  <PageContent class="review-shell-page-content" data-stage="list" data-child="false">
    {@render shellStatusBlock()}
    <List mediaList strongIos insetIos dividersIos>
      <ListItem
        title={shellState.activeContactProfile?.label ?? shellState.activeProfileSummary}
        subtitle={`${summarizeContactId(shellState.activeContactProfile?.actorId ?? shellState.activeProfileMeta)} · ${shellState.activeChannel ? "online" : "offline"}`}
        after={shellState.activeProfile ? "active" : "offline"}
      >
        {#snippet media()}
          <span class="review-shell-large-avatar review-shell-large-avatar--desktop">
            {avatarText(shellState.activeContactProfile?.label ?? shellState.activeProfileSummary)}
          </span>
        {/snippet}
      </ListItem>
    </List>
    <BlockTitle>Overview</BlockTitle>
    <List strongIos insetIos dividersIos>
      <ListItem title="Sources" subtitle="Configured on this review profile" after={`${activeSourceCount}`} />
      <ListItem title="Contacts" subtitle="Projected across connected sources" after={`${activeContactCount}`} />
      <ListItem title="Direct rooms" subtitle="Linked from contact identity" after={`${totalDirectRoomCount}`} />
      <ListItem
        title="Pending requests"
        subtitle={activePendingCount > 0 ? "Introductions waiting in review" : "No pending introductions"}
        after={`${activePendingCount}`}
      />
    </List>
    <BlockTitle>Active room</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem title="Connected" subtitle={shellState.activeChannel ? shellState.activeChannel.title : "Waiting for bootstrap"} after={shellState.activeChannel ? "Live" : "Idle"} />
      <ListItem title="Viewer" subtitle={shellState.activeProfileMeta} />
      <ListItem title="Transport" subtitle={summarizeEndpoint(shellState.activeProfile?.transportUrl ?? "No transport configured")} />
    </List>
    <BlockTitle>Control center</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem
        link
        title="Source directory"
        subtitle={`${activeSourceCount} configured sources`}
        data-review-me-action="source-directory"
        onClick={() => openShellSources()}
      >
        {#snippet media()}
          <span class="review-shell-source-media">{@render reviewIcon("source", 18)}</span>
        {/snippet}
      </ListItem>
      <ListItem link title="Review setup" subtitle="Transport URL, token, and viewer contact" onClick={() => (shellState.shellPanelOpen = true)}>
        {#snippet media()}
          <span class="review-shell-review-media">{@render reviewIcon("setup", 18)}</span>
        {/snippet}
      </ListItem>
      <ListItem link title="Refresh room state" subtitle={shellState.loading ? "Refreshing bootstrap and people projection" : "Reload room transcript and people data"} onClick={() => void shellState.refreshChannel()}>
        {#snippet media()}
          <span class="review-shell-action-media">
            {@render reviewIcon("refresh", 18)}
          </span>
        {/snippet}
      </ListItem>
      <ListItem link title="Share review link" subtitle="Copy URL with transport, token, and viewer contact" onClick={() => void shellState.shareActiveProfile()}>
        {#snippet media()}
          <span class="review-shell-action-media">{@render reviewIcon("share", 17)}</span>
        {/snippet}
      </ListItem>
    </List>
    <BlockTitle>Local storage</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      <ListItem link title="Remove active profile" subtitle="Delete the current local profile from this browser" onClick={() => void shellState.removeActiveProfile()}>
        {#snippet media()}
          <span class="review-shell-action-media review-shell-action-media--danger">{@render reviewIcon("trash", 17)}</span>
        {/snippet}
      </ListItem>
      <ListItem link title="Clear local profiles" subtitle="Reset all locally stored review profiles" onClick={() => void shellState.resetProfiles()}>
        {#snippet media()}
          <span class="review-shell-action-media review-shell-action-media--neutral">{@render reviewIcon("sourceBack", 16)}</span>
        {/snippet}
      </ListItem>
    </List>
  </PageContent>
{/snippet}

{#snippet desktopSidebarNav()}
  <BlockTitle>Review</BlockTitle>
  <List strongIos dividersIos class="review-shell-desktop-nav-list">
    <ListItem
      link
      title="Messages"
      subtitle={`${shellState.peopleProjection.conversations.length} conversations`}
      selected={shellState.activeDestination === "messages"}
      data-review-root-nav="messages"
      onClick={() => openShellDestination("messages")}
    >
      {#snippet media()}
        <span class="review-shell-desktop-nav-media review-shell-desktop-nav-media--messages">
          {@render reviewIcon("chat", 18)}
        </span>
      {/snippet}
    </ListItem>
    <ListItem
      link
      title="Contacts"
      subtitle={`${activeContactCount} contacts · ${activePendingCount} pending`}
      selected={shellState.activeDestination === "contacts"}
      data-review-root-nav="contacts"
      onClick={() => openShellDestination("contacts")}
    >
      {#snippet media()}
        <span class="review-shell-desktop-nav-media review-shell-desktop-nav-media--contacts">
          {@render reviewIcon("users", 18)}
        </span>
      {/snippet}
      {#snippet after()}
        {#if activePendingCount > 0}
          <Badge color="red">{activePendingCount}</Badge>
        {/if}
      {/snippet}
    </ListItem>
    <ListItem
      link
      title="Me"
      subtitle={`${activeSourceCount} sources · ${totalDirectRoomCount} direct rooms`}
      selected={shellState.activeDestination === "me"}
      data-review-root-nav="me"
      onClick={() => openShellDestination("me")}
    >
      {#snippet media()}
        <span class="review-shell-desktop-nav-media review-shell-desktop-nav-media--me">
          {@render reviewIcon("me", 18)}
        </span>
      {/snippet}
    </ListItem>
  </List>
{/snippet}

{#snippet desktopMasterSurface()}
  <Navbar
    class="review-shell-desktop-navbar review-shell-desktop-navbar--master"
    title={desktopMasterTitle}
    subtitle={desktopMasterSubtitle}
  >
    <Subnavbar class="review-shell-desktop-subnavbar" inner={false}>
      <Searchbar
        class="review-shell-desktop-searchbar"
        clearButton={true}
        customSearch={true}
        placeholder="Search"
        value={desktopMasterQuery}
        onInput={(event: Event) => {
          desktopMasterQuery = String((event.currentTarget as HTMLInputElement | null)?.value ?? "");
        }}
        onClear={() => {
          desktopMasterQuery = "";
        }}
      />
    </Subnavbar>
  </Navbar>
  {#if shellState.sourcesOpen}
    <PageContent class="review-shell-page-content" data-stage="list" data-child="false">
      <BlockTitle>Overview</BlockTitle>
      <List strongIos insetIos dividersIos>
        <ListItem title="Configured sources" subtitle={`${activeSourceCount} endpoints on this review profile`} after={`${activeSourceCount}`} />
        <ListItem
          title="Projected contacts"
          subtitle={activeContactCount > 0 ? `${activeContactCount} contacts mapped through these sources` : "No contacts projected yet"}
          after={`${activeContactCount}`}
        />
      </List>
      <BlockTitle>Sources</BlockTitle>
      <List mediaList strongIos insetIos dividersIos>
        {#each filteredSources as source (source.sourceId)}
          <ListItem
            link
            title={source.label}
            subtitle={`${summarizeEndpoint(source.endpoint)} · ${source.callbackSummary === "No callback source" ? "no callback" : "callback ready"}`}
            after={source.trustState}
            data-review-source-id={source.sourceId}
            selected={shellState.selectedSource?.sourceId === source.sourceId}
            onClick={() => openShellSources(source.sourceId)}
          >
            {#snippet media()}
              <span class="review-shell-source-media">{@render reviewIcon("source", 18)}</span>
            {/snippet}
          </ListItem>
        {/each}
      </List>
      {#if filteredSources.length === 0}
        <Block strongIos insetIos>
          <div class="review-shell-note-title">No matching sources</div>
          <div class="review-shell-meta-copy">Try a different keyword or add another source.</div>
        </Block>
      {/if}
      <BlockTitle>Actions</BlockTitle>
      <List mediaList strongIos insetIos dividersIos>
        <ListItem link title="Add source" subtitle="Create another transport endpoint" onClick={() => openSourceEditor()}>
          {#snippet media()}
            <span class="review-shell-action-media">
              {@render reviewIcon("add", 17)}
            </span>
          {/snippet}
        </ListItem>
      </List>
    </PageContent>
  {:else if shellState.activeDestination === "contacts"}
    <PageContent class="review-shell-page-content review-shell-tab-page-content" data-stage="list" data-child="false">
      <BlockTitle>Requests</BlockTitle>
      {@render requestHistoryList()}
      {@render contactsSectionList()}
      {#if filteredContactSections.length === 0}
        <Block strongIos insetIos>
          <div class="review-shell-note-title">No matching contacts</div>
          <div class="review-shell-meta-copy">Try a different keyword.</div>
        </Block>
      {/if}
    </PageContent>
  {:else if shellState.activeDestination === "me"}
    <PageContent class="review-shell-page-content" data-stage="list" data-child="false">
      {@render shellStatusBlock()}
    <BlockTitle>Profiles</BlockTitle>
    <List mediaList strongIos insetIos dividersIos>
      {#each filteredProfiles as profile (profile.id)}
          <ListItem
            link
            title={profile.name}
            subtitle={`${summarizeEndpoint(profile.transportUrl)} · ${summarizeContactId(profile.viewerContactId)}`}
            selected={shellState.selectedProfileId === profile.id}
            after={shellState.selectedProfileId === profile.id ? "Active" : undefined}
            onClick={() => {
              void shellState.selectProfile(profile);
            }}
          />
        {/each}
      </List>
      {#if filteredProfiles.length === 0}
        <Block strongIos insetIos>
          <div class="review-shell-note-title">No matching profiles</div>
          <div class="review-shell-meta-copy">Try a different keyword.</div>
        </Block>
      {/if}
      <BlockTitle>Access</BlockTitle>
      <List mediaList strongIos insetIos dividersIos>
        <ListItem
          link
          title="Source directory"
          subtitle={`${activeSourceCount} configured sources`}
          data-review-me-action="source-directory"
          onClick={() => openShellSources()}
        >
          {#snippet media()}
            <span class="review-shell-source-media" data-review-me-entry="source-management">{@render reviewIcon("source", 18)}</span>
          {/snippet}
        </ListItem>
        <ListItem link title="Edit review setup" subtitle="Transport URL, access token, and viewer contact" onClick={() => (shellState.shellPanelOpen = true)}>
          {#snippet media()}
            <span class="review-shell-review-media">{@render reviewIcon("setup", 18)}</span>
          {/snippet}
        </ListItem>
      </List>
    </PageContent>
  {:else}
    <PageContent class="review-shell-page-content" data-stage="list" data-child="false">
      {@render shellStatusBlock()}
      {@render reviewRoomList(false)}
      {#if filteredConversations.length === 0}
        <Block strongIos insetIos>
          <div class="review-shell-note-title">No matching conversations</div>
          <div class="review-shell-meta-copy">Try a different keyword.</div>
        </Block>
      {/if}
    </PageContent>
  {/if}
{/snippet}

{#snippet desktopDetailSurface()}
  <Navbar
    class="review-shell-desktop-navbar review-shell-desktop-navbar--detail"
    title={desktopDetailTitle}
    subtitle={desktopDetailSubtitle}
  >
    {#if roomActionsVisible}
      <NavRight>
        <Link
          iconOnly
          aria-label="Room actions"
          tooltip="Room actions"
          onClick={(event: MouseEvent) => {
            openRoomActions(event.currentTarget);
          }}
        >
          {@render reviewIcon("more", 18)}
        </Link>
      </NavRight>
    {/if}
  </Navbar>
  {#if shellState.roomOpen || wideMessagesDetailVisible}
    {@render roomChatSurface()}
  {:else if shellState.selectedContact}
    {@render desktopContactDetailSurface()}
  {:else if shellState.selectedSource}
    {@render desktopSourceDetailSurface()}
  {:else if shellState.sourcesOpen}
    <PageContent class="review-shell-page-content" data-stage="list" data-child="false">
      <BlockTitle>Source directory</BlockTitle>
      <List mediaList strongIos insetIos dividersIos>
        {#each shellState.peopleProjection.sources as source (source.sourceId)}
          <ListItem
            link
            title={source.label}
            subtitle={`${summarizeEndpoint(source.endpoint)} · ${source.pendingRequestCount} pending`}
            after={source.trustState}
            data-review-source-id={source.sourceId}
            onClick={() => openShellSources(source.sourceId)}
          >
            {#snippet media()}
              <span class="review-shell-source-media" data-review-source-id={source.sourceId}>{@render reviewIcon("source", 18)}</span>
            {/snippet}
          </ListItem>
        {/each}
      </List>
    </PageContent>
  {:else if shellState.activeDestination === "contacts"}
    <PageContent class="review-shell-page-content" data-stage="list" data-child="false">
      <BlockTitle>Requests</BlockTitle>
      {@render requestHistoryList()}
    </PageContent>
  {:else if shellState.activeDestination === "me"}
    {@render desktopMeDetailSurface()}
  {:else}
    <PageContent class="review-shell-page-content" data-stage="list" data-child="false">
      <BlockTitle>Next step</BlockTitle>
      <List mediaList strongIos insetIos dividersIos>
        <ListItem link title="Open room setup" subtitle="Connect a room before opening transcript" onClick={() => (shellState.shellPanelOpen = true)}>
          {#snippet media()}
            <span class="review-shell-review-media">{@render reviewIcon("setup", 18)}</span>
          {/snippet}
        </ListItem>
        <ListItem link title="Open profile" subtitle={`${activeSourceCount} sources · ${activeContactCount} contacts`} onClick={() => openShellDestination("me")}>
          {#snippet media()}
            <span class="review-shell-desktop-nav-media review-shell-desktop-nav-media--me">
              {@render reviewIcon("me", 18)}
            </span>
          {/snippet}
        </ListItem>
      </List>
    </PageContent>
  {/if}
{/snippet}

{#snippet desktopSidebarPanel()}
  <Panel
    left
    reveal
    backdrop={false}
    visibleBreakpoint={1024}
    class="review-shell-desktop-sidebar-panel"
  >
    <View class="review-shell-desktop-sidebar review-shell-desktop-column-view" router={false}>
      <Page pageContent={false} class="review-shell-desktop-page" name="review-shell-desktop-sidebar">
        <Navbar
          class="review-shell-desktop-navbar review-shell-desktop-navbar--sidebar"
          title="Review"
          subtitle={shellState.activeProfileSummary}
        />
        <PageContent class="review-shell-page-content review-shell-desktop-column-page" data-stage="list" data-child="false">
          {@render desktopSidebarNav()}
        </PageContent>
      </Page>
    </View>
  </Panel>
{/snippet}

{#snippet desktopWorkspaceView()}
  <View
    class="review-shell-desktop-workspace review-shell-desktop-column-view"
    masterDetailBreakpoint={1024}
    masterDetailResizable={false}
  >
    <Page pageContent={false} class="review-shell-desktop-page review-shell-desktop-master page-master" name="review-shell-desktop-master">
      {@render desktopMasterSurface()}
    </Page>
    <Page
      pageContent={shellState.roomOpen || wideMessagesDetailVisible}
      messagesContent={shellState.roomOpen || wideMessagesDetailVisible}
      class={`review-shell-desktop-page review-shell-desktop-detail page-master-detail ${
        shellState.roomOpen || wideMessagesDetailVisible ? "review-shell-room-page" : ""
      }`}
      name="review-shell-desktop-detail"
    >
      {@render desktopDetailSurface()}
    </Page>
  </View>
{/snippet}

{#snippet mobileRootShellPage()}
  <Page
    name="review-shell-home"
    pageContent={false}
    withSubnavbar={mobileRootShowsSearch}
  >
    <Navbar
      bind:this={topNavbar}
      title={mobileRootNavbarTitle}
    >
      {#if mobileRootShowsSearch}
        <Subnavbar class="review-shell-mobile-subnavbar" inner={false}>
          <Searchbar
            class="review-shell-mobile-searchbar"
            clearButton={true}
            customSearch={true}
            placeholder={mobileRootSearchPlaceholder}
            value={mobileRootSearchValue}
            onInput={(event: Event) => {
              const nextValue = String((event.currentTarget as HTMLInputElement | null)?.value ?? "");
              if (shellState.activeDestination === "contacts") {
                mobileContactsQuery = nextValue;
                return;
              }
              mobileMessagesQuery = nextValue;
            }}
            onClear={() => {
              if (shellState.activeDestination === "contacts") {
                mobileContactsQuery = "";
                return;
              }
              mobileMessagesQuery = "";
            }}
          />
        </Subnavbar>
      {/if}
    </Navbar>

    <Toolbar
      tabbar
      icons
      position="bottom"
      class={`review-shell-tabbar ${mobileChildSurfaceOpen ? "review-shell-tabbar--suspended" : ""}`}
    >
      <ToolbarPane>
        <Link
          tabLink="#review-shell-tab-messages"
          tabLinkActive={shellState.activeDestination === "messages"}
          aria-label="Messages"
          onClick={() => openShellDestination("messages")}
        >
          <span class="review-shell-tab-icon">{@render reviewIcon("chat", 20)}</span>
          <span class="tabbar-label">Messages</span>
        </Link>
        <Link
          tabLink="#review-shell-tab-contacts"
          tabLinkActive={shellState.activeDestination === "contacts"}
          aria-label="Contacts"
          onClick={() => openShellDestination("contacts")}
        >
          <span class="review-shell-tab-icon">{@render reviewIcon("users", 20)}</span>
          <span class="tabbar-label">Contacts</span>
        </Link>
        <Link
          tabLink="#review-shell-tab-me"
          tabLinkActive={shellState.activeDestination === "me"}
          aria-label="Me"
          onClick={() => openShellDestination("me")}
        >
          <span class="review-shell-tab-icon">{@render reviewIcon("me", 20)}</span>
          <span class="tabbar-label">Me</span>
        </Link>
      </ToolbarPane>
    </Toolbar>

    <Tabs animated={false} class="review-shell-root-tabs">
      <Tab
        id="review-shell-tab-messages"
        class="review-shell-root-tab page-content"
        tab={true}
        tabActive={shellState.activeDestination === "messages"}
        data-stage="list"
        data-root-search="true"
        data-child="false"
      >
        {@render messagesRootSurface(true)}
      </Tab>

      <Tab
        id="review-shell-tab-contacts"
        class="review-shell-root-tab page-content"
        tab={true}
        tabActive={shellState.activeDestination === "contacts"}
        data-stage="list"
        data-root-search="true"
        data-child="false"
      >
        {@render contactsRootSurface()}
      </Tab>

      <Tab
        id="review-shell-tab-me"
        class="review-shell-root-tab page-content"
        tab={true}
        tabActive={shellState.activeDestination === "me"}
        data-stage="list"
        data-root-search="false"
        data-child="false"
      >
        {@render meRootSurface()}
      </Tab>
    </Tabs>
  </Page>
{/snippet}

{#snippet mobileChildShellPage()}
  <Page
    name="review-shell-child"
    pageContent={shellState.roomOpen}
    messagesContent={shellState.roomOpen}
    withSubnavbar={(shellState.sourcesOpen && !shellState.selectedSource) || shellState.profilesOpen}
    class={shellState.roomOpen ? "review-shell-room-page" : undefined}
  >
    <Navbar
      bind:this={topNavbar}
      title={shellState.navbarTitle}
      subtitle={navbarSubtitle}
    >
      {#snippet navLeft()}
        <Link href={false} icon="icon-back" iconOnly aria-label="Back" onClick={handleMobileChildBack} />
      {/snippet}
      {#if shellState.sourcesOpen && !shellState.selectedSource}
        <Subnavbar class="review-shell-mobile-subnavbar" inner={false}>
          <Searchbar
            class="review-shell-mobile-searchbar"
            clearButton={true}
            customSearch={true}
            placeholder="Search sources"
            value={mobileSourcesQuery}
            onInput={(event: Event) => {
              mobileSourcesQuery = String((event.currentTarget as HTMLInputElement | null)?.value ?? "");
            }}
            onClear={() => {
              mobileSourcesQuery = "";
            }}
          />
        </Subnavbar>
      {:else if shellState.profilesOpen}
        <Subnavbar class="review-shell-mobile-subnavbar" inner={false}>
          <Searchbar
            class="review-shell-mobile-searchbar"
            clearButton={true}
            customSearch={true}
            placeholder="Search profiles"
            value={mobileProfilesQuery}
            onInput={(event: Event) => {
              mobileProfilesQuery = String((event.currentTarget as HTMLInputElement | null)?.value ?? "");
            }}
            onClear={() => {
              mobileProfilesQuery = "";
            }}
          />
        </Subnavbar>
      {/if}
      {#if roomActionsVisible}
        <NavRight>
          <Link
            iconOnly
            aria-label="Room actions"
            tooltip="Room actions"
            onClick={(event: MouseEvent) => {
              openRoomActions(event.currentTarget);
            }}
          >
            {@render reviewIcon("more", 18)}
          </Link>
        </NavRight>
      {/if}
    </Navbar>

    {#if shellState.roomOpen}
      {@render roomChatSurface()}
    {:else if shellState.selectedContact}
      {@render contactDetailSurface()}
    {:else if shellState.sourcesOpen}
      {#if shellState.selectedSource}
        {@render sourceDetailSurface()}
      {:else}
        {@render sourcesListSurface()}
      {/if}
    {:else if shellState.profilesOpen}
      {@render profilesListSurface()}
    {/if}
  </Page>
{/snippet}

{#snippet embeddedRoomShellPage()}
  <Page
    name="web-chat-app-view-room"
    pageContent={true}
    messagesContent={true}
    class="review-shell-room-page review-shell-embedded-room-page"
  >
    {@render roomChatSurface()}
  </Page>
{/snippet}

{#snippet desktopShellPage()}
  <Page name="review-shell-home" pageContent={false}>
    {@render desktopSidebarPanel()}
    <div class="review-shell-desktop-layout" data-review-shell-layout="desktop">
      {@render desktopWorkspaceView()}
    </div>
  </Page>
{/snippet}

<App {...appParameters}>
  <div
    hidden
    aria-hidden="true"
    data-review-shell-state={`${shellState.activeDestination}|${shellState.roomOpen ? "room" : "idle"}|${shellState.selectedContactKey ?? "no-contact"}|${
      shellState.sourcesOpen ? "sources-open" : "sources-closed"
    }|${shellState.selectedSourceId ?? "no-source"}|${shellState.profilesOpen ? "profiles-open" : "profiles-closed"}`}
    data-review-shell-action={shellState.debugLastAction}
  ></div>
  <View
    main
    url="/"
    class="safe-areas"
    masterDetailBreakpoint={1024}
    routes={appParameters.routes}
    onViewInit={(view: Framework7ViewHandle) => {
      mainView = view;
      void syncMobileChildRoute();
    }}
  >
    {#if shellState.appViewMode === "room"}
      {@render embeddedRoomShellPage()}
    {:else if isWideLayout}
      {@render desktopShellPage()}
    {:else}
      {@render mobileRootShellPage()}
    {/if}
  </View>

  <Sheet opened={resourcesSheetOpen} backdrop swipeToClose push={false} onSheetClosed={() => (resourcesSheetOpen = false)}>
    <Toolbar class="review-shell-sheet-toolbar">
      <Link sheetClose>Done</Link>
    </Toolbar>
    <PageContent class="review-shell-sheet-content">
      <BlockTitle>Room resources</BlockTitle>
      {#if shellState.resourceReferences.length > 0}
        <List mediaList strongIos insetIos dividersIos>
          {#each shellState.resourceReferences as resource (resource.id)}
            <ListItem title={resource.label} subtitle={resourceSubtitle(resource)} after={resourceAfterLabel(resource)}>
              {#snippet media()}
                <span class="review-shell-resource-media" data-kind={resource.kind}>{resourceMediaLabel(resource)}</span>
              {/snippet}
            </ListItem>
          {/each}
        </List>
      {:else}
        <Block strong inset>No resources in this room yet.</Block>
      {/if}
    </PageContent>
  </Sheet>

  <Sheet opened={detailsSheetOpen} backdrop swipeToClose push={false} onSheetClosed={() => (detailsSheetOpen = false)}>
    <Toolbar class="review-shell-sheet-toolbar">
      <Link sheetClose>Done</Link>
    </Toolbar>
    <PageContent class="review-shell-sheet-content">
      <BlockTitle>Room details</BlockTitle>
      <BlockTitle>{shellState.onlineSeatCount} online</BlockTitle>
      <List mediaList strongIos insetIos dividersIos>
        {#each shellState.participantPresentations as participant (participant.actorId)}
          <ListItem title={participant.label} subtitle={participant.actorId}>
            {#snippet media()}
              <span class="review-shell-member-media">
                {#if participant.iconUrl}
                  <img src={participant.iconUrl} alt={participant.label} />
                {:else}
                  <span>{avatarText(participant.label)}</span>
                {/if}
              </span>
            {/snippet}
          </ListItem>
        {/each}
      </List>
    </PageContent>
  </Sheet>

  <Sheet opened={sourceEditorOpen} backdrop swipeToClose push={false} onSheetClosed={() => (sourceEditorOpen = false)}>
    <Toolbar class="review-shell-sheet-toolbar">
      <Link sheetClose>Cancel</Link>
      <Link onClick={saveSourceDraft}>Save</Link>
    </Toolbar>
    <PageContent class="review-shell-sheet-content">
      <BlockTitle>{sourceDraft.sourceId ? "Edit Source" : "Add Source"}</BlockTitle>
      <List strongIos insetIos dividersIos>
        <ListGroup>
          <ListInput label="Source ID" type="text" bind:value={sourceDraft.sourceId} placeholder="local-review" />
          <ListInput label="Label" type="text" bind:value={sourceDraft.label} placeholder="Local review" />
          <ListInput label="Endpoint" type="textarea" resizable bind:value={sourceDraft.endpoint} placeholder="https://..." />
          <ListInput label="Auth token" type="textarea" resizable bind:value={sourceDraft.authToken} placeholder="Bearer ..." />
        </ListGroup>
      </List>
    </PageContent>
  </Sheet>

  <Sheet opened={shellState.shellPanelOpen} backdrop swipeToClose push={false} onSheetClosed={() => (shellState.shellPanelOpen = false)}>
    <Toolbar class="review-shell-sheet-toolbar">
      <Link sheetClose>Done</Link>
    </Toolbar>
    <PageContent class="review-shell-sheet-content">
      <BlockTitle>Review setup</BlockTitle>
      <ReviewShellProfileSurface state={shellState} compact showIntro={false} />
    </PageContent>
  </Sheet>
</App>
