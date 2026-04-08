<script lang="ts">
	import { IconStudio } from '@agenter/ui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<IconStudio {...data} />
