<script lang="ts">
	import { page } from '$app/state';

	import NotesAvatarRoute from '$lib/features/notes/notes-avatar-route.svelte';
</script>

<NotesAvatarRoute avatarNickname={page.params.avatarNickname ?? ''} mode="query" />
