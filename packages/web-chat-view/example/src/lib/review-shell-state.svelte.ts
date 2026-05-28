import type { MessageControlPlaneEntry, MessageRecord } from "@agenter/message-system";
import {
  resolveMessageResourceReferences,
  type WebChatComposerMentionSuggestion,
  type WebChatResourceReference,
} from "@agenter/web-chat-view";

import {
  buildReviewPeopleProjection,
  createContactMentionSuggestions,
  type ReviewContactProjection,
  type ReviewShellDestination,
  type ReviewSourceProjection,
} from "./review-people.projection";
import { fetchReviewChannel, fetchReviewPeople, submitReviewMessage } from "./review-example.api";
import { resolveActorPresentation } from "./review-example.channel";
import { buildShareQuery, parseImportedProfile } from "./review-example.query";
import { clearStoredProfiles, loadStoredProfiles, saveStoredProfiles } from "./review-example.storage";
import type {
  ReviewBootstrapPayload,
  ReviewChannelEnvelope,
  ReviewPeopleEnvelope,
  ReviewProfile,
  ReviewProfileDraft,
} from "./review-example.types";
import type { WebChatComposerSubmitPayload } from "@agenter/web-chat-view";

const defaultDraft = (): ReviewProfileDraft => ({
  name: "Local review room",
  transportUrl: "",
  accessToken: "",
  viewerActorId: "",
});

const readErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const slugifyTitle = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "") || "review-room";

const formatDayChip = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(timestamp));

const fetchBootstrapProfiles = async (): Promise<ReviewBootstrapPayload> => {
  const bootstrapResponse = await fetch("/api/review/bootstrap");
  if (!bootstrapResponse.ok) {
    throw new Error(`${bootstrapResponse.status} ${bootstrapResponse.statusText}`);
  }
  return (await bootstrapResponse.json()) as ReviewBootstrapPayload;
};

export class ReviewShellState {
  draft = $state<ReviewProfileDraft>(defaultDraft());
  profiles = $state<ReviewProfile[]>([]);
  selectedProfileId = $state<string | null>(null);
  channelEnvelope = $state<ReviewChannelEnvelope | null>(null);
  peopleEnvelope = $state<ReviewPeopleEnvelope | null>(null);
  initialMessages = $state<MessageRecord[]>([]);
  initialSnapshotResolved = $state(false);
  loading = $state(false);
  saving = $state(false);
  errorMessage = $state<string | null>(null);
  copied = $state<string | null>(null);
  debugLastAction = $state("boot");
  shellPanelOpen = $state(false);
  activeDestination = $state<ReviewShellDestination>("messages");
  roomOpen = $state(false);
  selectedContactKey = $state<string | null>(null);
  sourcesOpen = $state(false);
  selectedSourceId = $state<string | null>(null);
  profilesOpen = $state(false);

  activeProfile = $derived(this.profiles.find((profile) => profile.id === this.selectedProfileId) ?? null);
  activeChannel = $derived<MessageControlPlaneEntry | null>(this.channelEnvelope?.channel ?? null);
  actorResolver = $derived(
    this.channelEnvelope ? resolveActorPresentation(this.channelEnvelope.actorDirectory) : undefined,
  );
  participantPresentations = $derived.by(() => {
    const channel = this.activeChannel;
    const directory = this.channelEnvelope?.actorDirectory ?? {};
    if (!channel) {
      return [];
    }
    return channel.participants.map((participant) => {
      const match = directory[participant.id];
      return {
        actorId: participant.id,
        label: match?.label ?? participant.label ?? participant.id,
        iconUrl: match?.iconUrl ?? null,
      };
    });
  });
  onlineSeatCount = $derived.by(() => this.activeChannel?.seatStates?.filter((seat) => seat.online).length ?? 0);
  roomSlug = $derived.by(() => slugifyTitle(this.activeChannel?.title ?? this.activeProfile?.name ?? "review room"));
  transcriptDayLabel = $derived.by(() => {
    const latestMessage = this.initialMessages[this.initialMessages.length - 1];
    return formatDayChip(latestMessage?.createdAt ?? Date.now());
  });
  resourceReferences = $derived.by(() => {
    const resources = new Map<string, WebChatResourceReference>();
    for (const [index, message] of this.initialMessages.entries()) {
      for (const resource of resolveMessageResourceReferences({
        attachments: message.attachments ?? [],
        metadata: message.metadata,
        content: message.content,
        messageId: message.messageId,
        viewKey:
          typeof message.messageId === "number"
            ? `message-${message.messageId}`
            : `seed-message-${message.rowId ?? index + 1}`,
        senderActorId: message.senderActorId ?? null,
        from: message.from,
      })) {
        resources.set(resource.id, resource);
      }
    }
    for (const reference of this.channelEnvelope?.resourceReferences ?? []) {
      resources.set(reference.id, reference);
    }
    return [...resources.values()];
  });
  peopleProjection = $derived.by(() =>
    buildReviewPeopleProjection({
      people: this.peopleEnvelope,
      activeProfile: this.activeProfile,
      activeChannel: this.activeChannel,
      initialMessages: this.initialMessages,
    }),
  );
  selectedContact = $derived.by((): ReviewContactProjection | null => {
    return this.peopleProjection.contacts.find((contact) => contact.key === this.selectedContactKey) ?? null;
  });
  selectedSource = $derived.by((): ReviewSourceProjection | null => {
    return this.peopleProjection.sources.find((source) => source.sourceId === this.selectedSourceId) ?? null;
  });
  navbarTitle = $derived.by(() => {
    if (this.roomOpen) {
      return this.activeChannel?.title ?? "Room";
    }
    if (this.selectedContact) {
      return "Contact Details";
    }
    if (this.sourcesOpen) {
      return this.selectedSource ? "Source Details" : "Sources";
    }
    if (this.profilesOpen) {
      return "Profiles";
    }
    if (this.activeDestination === "contacts") {
      return "Contacts";
    }
    if (this.activeDestination === "me") {
      return "Me";
    }
    return "Messages";
  });
  activeActorProfile = $derived.by(() => {
    const actor = this.peopleEnvelope?.currentActor;
    if (actor) {
      return actor;
    }
    return this.activeProfile
      ? {
          actorId: this.activeProfile.viewerActorId,
          label: this.activeProfile.name,
          iconUrl: undefined,
        }
      : null;
  });
  contactMentionSuggestions = $derived.by((): WebChatComposerMentionSuggestion[] =>
    createContactMentionSuggestions(this.peopleProjection.contacts),
  );
  activeProfileSummary = $derived(this.activeProfile?.name ?? "Connect a review room");
  activeProfileMeta = $derived(this.activeProfile?.viewerActorId ?? "Transport URL + token + viewer actor id");

  private copiedResetHandle = 0;

  applyProfileToDraft(profile: ReviewProfile): void {
    this.selectedProfileId = profile.id;
    this.draft = {
      name: profile.name,
      transportUrl: profile.transportUrl,
      accessToken: profile.accessToken,
      viewerActorId: profile.viewerActorId,
    };
  }

  async refreshChannelFor(profile: ReviewProfile | null): Promise<void> {
    if (!profile) {
      this.channelEnvelope = null;
      this.peopleEnvelope = null;
      this.initialMessages = [];
      this.initialSnapshotResolved = false;
      return;
    }
    this.loading = true;
    this.errorMessage = null;
    try {
      const [channelEnvelope, peopleEnvelope] = await Promise.all([
        fetchReviewChannel(profile),
        fetchReviewPeople(profile),
      ]);
      this.channelEnvelope = channelEnvelope;
      this.peopleEnvelope = peopleEnvelope;
      this.initialMessages = this.channelEnvelope.initialMessages;
      this.initialSnapshotResolved = true;
    } catch (error) {
      this.channelEnvelope = null;
      this.peopleEnvelope = null;
      this.initialMessages = [];
      this.initialSnapshotResolved = false;
      this.errorMessage = readErrorMessage(error);
    } finally {
      this.loading = false;
    }
  }

  async refreshChannel(): Promise<void> {
    await this.refreshChannelFor(this.activeProfile);
  }

  async persistProfiles(nextProfiles: ReviewProfile[], nextSelectedId: string | null): Promise<void> {
    this.profiles = nextProfiles;
    this.selectedProfileId = nextSelectedId;
    await saveStoredProfiles(nextProfiles);
  }

  async saveProfile(): Promise<void> {
    this.saving = true;
    this.errorMessage = null;
    try {
      const normalized: ReviewProfile = {
        id: this.selectedProfileId ?? crypto.randomUUID(),
        name: this.draft.name.trim() || "Review room",
        transportUrl: this.draft.transportUrl.trim(),
        accessToken: this.draft.accessToken.trim(),
        viewerActorId: this.draft.viewerActorId.trim(),
      };
      const others = this.profiles.filter((profile) => profile.id !== normalized.id);
      await this.persistProfiles([normalized, ...others], normalized.id);
      this.applyProfileToDraft(normalized);
      this.shellPanelOpen = false;
      await this.refreshChannelFor(normalized);
    } catch (error) {
      this.errorMessage = readErrorMessage(error);
    } finally {
      this.saving = false;
    }
  }

  async selectProfile(profile: ReviewProfile): Promise<void> {
    this.applyProfileToDraft(profile);
    this.shellPanelOpen = false;
    await this.refreshChannelFor(profile);
  }

  async removeActiveProfile(): Promise<void> {
    if (!this.activeProfile) {
      return;
    }
    const nextProfiles = this.profiles.filter((profile) => profile.id !== this.activeProfile?.id);
    const nextSelected = nextProfiles[0]?.id ?? null;
    await this.persistProfiles(nextProfiles, nextSelected);
    if (nextProfiles[0]) {
      this.applyProfileToDraft(nextProfiles[0]);
      await this.refreshChannelFor(nextProfiles[0]);
      return;
    }
    this.draft = defaultDraft();
    this.channelEnvelope = null;
    this.initialMessages = [];
    this.shellPanelOpen = true;
  }

  async resetProfiles(): Promise<void> {
    await clearStoredProfiles();
    this.profiles = [];
    this.selectedProfileId = null;
    this.draft = defaultDraft();
    this.channelEnvelope = null;
    this.peopleEnvelope = null;
    this.initialMessages = [];
    this.errorMessage = null;
    this.shellPanelOpen = true;
  }

  async shareActiveProfile(): Promise<void> {
    const source = this.activeProfile ?? {
      id: "draft",
      ...this.draft,
    };
    const shareUrl = `${window.location.origin}${window.location.pathname}?${buildShareQuery(source)}`;
    await navigator.clipboard.writeText(shareUrl);
    this.copied = "Share link copied";
    if (this.copiedResetHandle !== 0) {
      window.clearTimeout(this.copiedResetHandle);
    }
    this.copiedResetHandle = window.setTimeout(() => {
      this.copied = null;
      this.copiedResetHandle = 0;
    }, 1800);
  }

  async sendMessage(payload: WebChatComposerSubmitPayload): Promise<void> {
    if (!this.activeProfile) {
      throw new Error("No active review profile");
    }
    await submitReviewMessage(this.activeProfile, payload);
  }

  openDestination(destination: ReviewShellDestination): void {
    this.debugLastAction = `openDestination:${destination}`;
    this.activeDestination = destination;
    this.roomOpen = false;
    this.selectedContactKey = null;
    this.sourcesOpen = false;
    this.selectedSourceId = null;
    this.profilesOpen = false;
  }

  openRoom(): void {
    this.debugLastAction = "openRoom";
    this.activeDestination = "messages";
    this.roomOpen = true;
    this.selectedContactKey = null;
    this.sourcesOpen = false;
    this.selectedSourceId = null;
    this.profilesOpen = false;
  }

  openConversation(input: { chatId: string | null; contactKey: string | null; openableRoom: boolean }): void {
    if (input.openableRoom) {
      this.openRoom();
      return;
    }
    if (input.contactKey) {
      this.openContact(input.contactKey);
    }
  }

  openContact(contactKey: string): void {
    this.debugLastAction = `openContact:${contactKey}`;
    this.activeDestination = "contacts";
    this.roomOpen = false;
    this.selectedContactKey = contactKey;
    this.sourcesOpen = false;
    this.selectedSourceId = null;
    this.profilesOpen = false;
  }

  openSources(sourceId: string | null = null): void {
    this.debugLastAction = `openSources:${sourceId ?? "directory"}`;
    this.activeDestination = "me";
    this.roomOpen = false;
    this.selectedContactKey = null;
    this.sourcesOpen = true;
    this.selectedSourceId = sourceId;
    this.profilesOpen = false;
  }

  openProfiles(): void {
    this.debugLastAction = "openProfiles";
    this.activeDestination = "me";
    this.roomOpen = false;
    this.selectedContactKey = null;
    this.sourcesOpen = false;
    this.selectedSourceId = null;
    this.profilesOpen = true;
  }

  backFromChildSurface(): void {
    this.debugLastAction = "backFromChildSurface";
    if (this.roomOpen) {
      this.roomOpen = false;
      return;
    }
    if (this.selectedContactKey) {
      this.selectedContactKey = null;
      return;
    }
    if (this.selectedSourceId) {
      this.selectedSourceId = null;
      return;
    }
    if (this.sourcesOpen) {
      this.sourcesOpen = false;
      return;
    }
    if (this.profilesOpen) {
      this.profilesOpen = false;
    }
  }

  async initializeShell(currentUrl: URL = new URL(window.location.href)): Promise<void> {
    this.errorMessage = null;
    try {
      const imported = parseImportedProfile(currentUrl);
      let stored: ReviewProfile[] = [];
      try {
        stored = await loadStoredProfiles();
      } catch {
        stored = [];
      }

      let nextProfiles = stored;
      let nextSelectedId: string | null = this.selectedProfileId;
      if (imported) {
        nextProfiles = [imported, ...stored.filter((profile) => profile.transportUrl !== imported.transportUrl)];
        nextSelectedId = imported.id;
      } else if (stored.length === 0) {
        const bootstrap = await fetchBootstrapProfiles();
        nextProfiles = bootstrap.profiles;
        nextSelectedId = bootstrap.recommendedProfileId ?? bootstrap.profiles[0]?.id ?? null;
      }

      this.profiles = nextProfiles;
      this.selectedProfileId = nextSelectedId;

      const selected = nextProfiles.find((profile) => profile.id === nextSelectedId) ?? nextProfiles[0] ?? imported;
      if (!selected) {
        this.channelEnvelope = null;
        this.peopleEnvelope = null;
        this.initialMessages = [];
        this.initialSnapshotResolved = false;
        this.shellPanelOpen = true;
        return;
      }
      this.applyProfileToDraft(selected);
      await this.refreshChannelFor(selected);
    } catch (error) {
      this.channelEnvelope = null;
      this.peopleEnvelope = null;
      this.initialMessages = [];
      this.initialSnapshotResolved = false;
      this.errorMessage = readErrorMessage(error);
      this.shellPanelOpen = true;
    }
  }
}
