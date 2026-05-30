<script lang="ts">
	import MessageRoomRoute from '$lib/features/messages/message-room-route.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<MessageRoomRoute roomId={params.chatId} />
