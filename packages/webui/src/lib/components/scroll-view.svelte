<script lang="ts" generics="Item">
	import { ScrollView as SharedScrollView } from '@agenter/svelte-primitives';
	import type { ScrollViewProps } from '@agenter/svelte-primitives';

	let props: ScrollViewProps<Item> = $props();
</script>

<SharedScrollView {...props} />
