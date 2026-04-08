<script lang="ts">
	import { IconStudio } from '@agenter/ui-studio';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<IconStudio {...data} />
