<script lang="ts">
  import SlidersIcon from "@lucide/svelte/icons/sliders-horizontal";

  import { Block, List, ListItem, Link, Navbar, NavRight, NavTitle, Page } from "../../../src/framework7-components";

  import HeartbeatAvatarMedia from "./heartbeat-avatar-media.svelte";
  import { useHeartbeatExampleState } from "./heartbeat-example-context";

  const state = useHeartbeatExampleState();
</script>

<Page name="avatars">
  <Navbar>
    <NavTitle>Avatars</NavTitle>
    <NavRight>
      <Link iconOnly aria-label="Connection settings" tooltip="Connection" onClick={() => state.openConnectionSheet()}>
        <SlidersIcon size={20} aria-hidden="true" />
      </Link>
    </NavRight>
  </Navbar>

  <List strongIos insetIos dividersIos mediaList>
    {#each state.connectionState.avatars.data as avatar (avatar.runtimeId)}
      <ListItem
        link={state.buildHeartbeatHref(avatar.runtimeId)}
        title={avatar.displayName ?? avatar.nickname}
        subtitle={avatar.nickname}
        text={`${avatar.avatarPrincipalId ?? avatar.runtimeId}${avatar.defaultAvatar ? " · default" : ""}`}
        after={state.openingRuntimeId === avatar.runtimeId ? "Opening" : state.avatarStatusLabel(avatar)}
      >
        {#snippet media()}
          <HeartbeatAvatarMedia label={avatar.displayName ?? avatar.nickname} src={avatar.iconUrl ?? null} />
        {/snippet}
      </ListItem>
    {/each}
  </List>

  {#if state.connectionState.avatars.loading && !state.connectionState.avatars.loaded}
    <Block strong>Loading Avatars...</Block>
  {/if}

  {#if state.connectionState.avatars.loaded && state.connectionState.avatars.data.length === 0}
    <Block strong>No Avatars returned by this Agenter target.</Block>
  {/if}
</Page>
