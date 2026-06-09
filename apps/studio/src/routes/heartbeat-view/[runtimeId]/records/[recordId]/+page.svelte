<script lang="ts">
	import RuntimeHeartbeatAppView from '$lib/features/runtime/runtime-heartbeat-app-view.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	const recordId = $derived(Number(params.recordId));
</script>

<RuntimeHeartbeatAppView
	runtimeId={params.runtimeId}
	recordId={Number.isInteger(recordId) && recordId > 0 ? recordId : null}
	surface="detail"
/>
