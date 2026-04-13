<script lang="ts">
	import type { ModelCallDeltaItem, ModelCallItem, RequestAuxItem, RuntimeChatMessage } from '@agenter/client-sdk';

	import RuntimeStageHeartbeat from './runtime-stage-heartbeat.svelte';

	let {
		initialMessages,
		initialRequestAux = [],
		initialModelCalls = [],
		modelCallDeltas = [],
		olderMessages = [],
		olderRequestAux = [],
		olderModelCalls = [],
	}: {
		initialMessages: RuntimeChatMessage[];
		initialRequestAux?: RequestAuxItem[];
		initialModelCalls?: ModelCallItem[];
		modelCallDeltas?: ModelCallDeltaItem[];
		olderMessages?: RuntimeChatMessage[];
		olderRequestAux?: RequestAuxItem[];
		olderModelCalls?: ModelCallItem[];
	} = $props();

	let messages = $state<RuntimeChatMessage[]>([]);
	let requestAux = $state<RequestAuxItem[]>([]);
	let modelCalls = $state<ModelCallItem[]>([]);
	let olderLoaded = $state(false);

	$effect(() => {
		messages = [...initialMessages];
		requestAux = [...initialRequestAux];
		modelCalls = [...initialModelCalls];
		olderLoaded = false;
	});

	const handleLoadOlder = async (): Promise<{ items: number; hasMore: boolean }> => {
		if (olderLoaded) {
			return { items: 0, hasMore: false };
		}
		const addedItems = olderMessages.length + olderRequestAux.length + olderModelCalls.length;
		if (addedItems === 0) {
			return { items: 0, hasMore: false };
		}
		messages = [...olderMessages, ...messages];
		requestAux = [...olderRequestAux, ...requestAux];
		modelCalls = [...olderModelCalls, ...modelCalls];
		olderLoaded = true;
		return { items: addedItems, hasMore: false };
	};
</script>

<div
	class="grid h-[44rem] gap-4 rounded-[1.35rem] border border-border/70 bg-background p-4"
	data-testid="runtime-heartbeat-story"
>
	<RuntimeStageHeartbeat {messages} {requestAux} {modelCalls} {modelCallDeltas} onLoadOlder={handleLoadOlder} />
</div>
