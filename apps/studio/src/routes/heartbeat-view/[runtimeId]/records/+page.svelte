<script lang="ts">
	import RuntimeHeartbeatAppView from '$lib/features/runtime/runtime-heartbeat-app-view.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<RuntimeHeartbeatAppView runtimeId={params.runtimeId} surface="detail" />
