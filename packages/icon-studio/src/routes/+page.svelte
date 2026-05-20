<script lang="ts">
	import { getIconStudioData } from '$lib/icon-studio/icon-studio-data';
	import IconStudio from '$lib/icon-studio/icon-studio.svelte';

	const data = getIconStudioData();
</script>

<div class="min-h-screen bg-background">
	<IconStudio {...data} />
</div>
