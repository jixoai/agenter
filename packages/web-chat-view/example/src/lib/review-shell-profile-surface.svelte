<script lang="ts">
  import {
    Block,
    BlockTitle,
    Button,
    List,
    ListGroup,
    ListInput,
    ListItem,
  } from "framework7-svelte";
  import Archive from "@lucide/svelte/icons/archive";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Save from "@lucide/svelte/icons/save";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import type { ReviewShellState } from "./review-shell-state.svelte";

  let {
    state,
    compact = false,
    showIntro = true,
    showProfiles = true,
  }: {
    state: ReviewShellState;
    compact?: boolean;
    showIntro?: boolean;
    showProfiles?: boolean;
  } = $props();

  const summarizeTransport = (transportUrl: string): string => {
    try {
      const url = new URL(transportUrl);
      return `${url.host}${url.pathname}`;
    } catch {
      return transportUrl;
    }
  };

  const summarizeContactId = (contactId: string): string =>
    contactId.length > 22 ? `${contactId.slice(0, 10)}…${contactId.slice(-6)}` : contactId;
</script>

<div class={`review-shell-profile-surface ${compact ? "is-compact" : ""}`}>
  {#if showIntro}
    <div class="review-shell-profile-intro">
      <Block strong inset>
        <div class="review-shell-profile-intro__eyebrow">Remote review shell</div>
        <div class="review-shell-profile-intro__title">Review control center</div>
        <p>
          Review setup stays secondary. Transport identity, room refresh, and link sharing live here so the chat surface stays primary.
        </p>
      </Block>
    </div>
  {/if}

  {#if showProfiles}
    <List mediaList strong inset dividersIos>
      <BlockTitle>Profiles</BlockTitle>
      <ListGroup>
        {#each state.profiles as profile (profile.id)}
        <ListItem
          link
          selected={state.selectedProfileId === profile.id}
          title={profile.name}
          subtitle={`${summarizeTransport(profile.transportUrl)} · ${summarizeContactId(profile.viewerContactId)}`}
          after={state.selectedProfileId === profile.id ? "Active" : undefined}
          onclick={() => {
            void state.selectProfile(profile);
          }}
        />
      {/each}
      </ListGroup>
    </List>
  {/if}

  {#if compact}
    <List mediaList strong inset dividersIos>
      <BlockTitle>Profile</BlockTitle>
      <ListGroup>
        <ListInput label="Name" type="text" bind:value={state.draft.name} />
        <ListInput
          label="Transport URL"
          type="textarea"
          resizable
          bind:value={state.draft.transportUrl}
          placeholder="ws://127.0.0.1:4601/room/<chatId>?token=..."
        />
        <ListInput label="Access token" type="textarea" resizable bind:value={state.draft.accessToken} />
        <ListInput label="Viewer contact id" type="text" bind:value={state.draft.viewerContactId} placeholder="0x..." />
        <ListItem
          title="Connected"
          text={state.activeChannel ? "Room is available" : "Save a profile to connect"}
          after={state.activeChannel ? "Yes" : "No"}
        />
      </ListGroup>
    </List>
  {:else if state.activeProfile}
    <List mediaList strong inset dividersIos>
      <BlockTitle>Active room</BlockTitle>
      <ListGroup>
        <ListItem title="Transport" subtitle={summarizeTransport(state.activeProfile.transportUrl)} />
        <ListItem title="Viewer" subtitle={state.activeProfile.viewerContactId} />
        <ListItem
          title="Connected"
          subtitle={state.activeChannel ? state.activeChannel.title : "Waiting for bootstrap"}
          after={state.activeChannel ? "Yes" : "No"}
        />
      </ListGroup>
    </List>
  {/if}

  <div class="review-shell-action-block">
    <Block strong inset>
      {#if compact}
        <div class="review-shell-action-grid">
          <Button fill disabled={state.saving} onclick={() => void state.saveProfile()}>
            <Save size={18} />
            <span>Save</span>
          </Button>
          <Button tonal onclick={() => void state.refreshChannel()}>
            <span class:spin={state.loading} class="review-shell-action-icon">
              <RefreshCw size={18} />
            </span>
            <span>Refresh</span>
          </Button>
          <Button tonal onclick={() => void state.shareActiveProfile()}>
            <Share2 size={18} />
            <span>Share</span>
          </Button>
          <Button color="red" tonal onclick={() => void state.removeActiveProfile()}>
            <Trash2 size={18} />
            <span>Remove</span>
          </Button>
        </div>

        <div class="review-shell-meta-block">
          <Button tonal onclick={() => void state.resetProfiles()}>
            Clear local profiles
          </Button>
        </div>
      {:else}
        <div class="review-shell-action-list">
          <List mediaList strong inset dividersIos>
            <ListItem link title="Edit review setup" subtitle="Transport URL, access token, and viewer contact" onclick={() => (state.shellPanelOpen = true)}>
              {#snippet media()}
                <span class="review-shell-action-media">
                  <Save size={17} />
                </span>
              {/snippet}
            </ListItem>
            <ListItem link title="Refresh room state" subtitle={state.loading ? "Refreshing bootstrap and people projection" : "Reload room transcript and people data"} onclick={() => void state.refreshChannel()}>
              {#snippet media()}
                <span class="review-shell-action-media">
                  <span class:spin={state.loading} class="review-shell-action-icon">
                    <RefreshCw size={17} />
                  </span>
                </span>
              {/snippet}
            </ListItem>
            <ListItem link title="Share review link" subtitle="Copy URL with transport, token, and viewer contact" onclick={() => void state.shareActiveProfile()}>
              {#snippet media()}
                <span class="review-shell-action-media">
                  <Share2 size={17} />
                </span>
              {/snippet}
            </ListItem>
            <ListItem link title="Remove active profile" subtitle="Delete the current local profile from this browser" onclick={() => void state.removeActiveProfile()}>
              {#snippet media()}
                <span class="review-shell-action-media review-shell-action-media--danger">
                  <Trash2 size={17} />
                </span>
              {/snippet}
            </ListItem>
            <ListItem link title="Clear local profiles" subtitle="Reset all locally stored review profiles" onclick={() => void state.resetProfiles()}>
              {#snippet media()}
                <span class="review-shell-action-media review-shell-action-media--neutral">
                  <Archive size={16} aria-hidden="true" />
                </span>
              {/snippet}
            </ListItem>
          </List>
        </div>
      {/if}
      {#if state.copied}
        <div class="review-shell-status review-shell-status--success">{state.copied}</div>
      {/if}
      {#if state.errorMessage}
        <div class="review-shell-status review-shell-status--error">{state.errorMessage}</div>
      {/if}
    </Block>
  </div>
</div>
