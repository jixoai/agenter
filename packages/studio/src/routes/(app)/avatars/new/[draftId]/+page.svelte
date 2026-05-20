<script lang="ts">
	import AvatarCreateRoute from '$lib/features/avatars/avatar-create-route.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<AvatarCreateRoute draftId={params.draftId} />
