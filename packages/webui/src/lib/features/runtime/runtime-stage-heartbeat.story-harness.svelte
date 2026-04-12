<script lang="ts">
	import type { RuntimeChatMessage } from '@agenter/client-sdk';

	import RuntimeStageHeartbeat from './runtime-stage-heartbeat.svelte';

	let {
		initialMessages,
		olderMessages = [],
	}: {
		initialMessages: RuntimeChatMessage[];
		olderMessages?: RuntimeChatMessage[];
	} = $props();

	let messages = $state<RuntimeChatMessage[]>([]);
	let olderLoaded = $state(false);

	$effect(() => {
		messages = [...initialMessages];
		olderLoaded = false;
	});

	const handleLoadOlder = async (): Promise<{ items: number; hasMore: boolean }> => {
		if (olderLoaded || olderMessages.length === 0) {
			return { items: 0, hasMore: false };
		}
		messages = [...olderMessages, ...messages];
		olderLoaded = true;
		return { items: olderMessages.length, hasMore: false };
	};
</script>

<div
	class="grid h-[44rem] gap-4 rounded-[1.35rem] border border-border/70 bg-background p-4"
	data-testid="runtime-heartbeat-story"
>
	<RuntimeStageHeartbeat messages={messages} onLoadOlder={handleLoadOlder} />
</div>
