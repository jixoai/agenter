<script lang="ts">
	import SkillsWorkbenchLayout from '$lib/features/skills/skills-workbench-layout.svelte';

	let { children } = $props();
</script>

<SkillsWorkbenchLayout>
	{@render children()}
</SkillsWorkbenchLayout>
