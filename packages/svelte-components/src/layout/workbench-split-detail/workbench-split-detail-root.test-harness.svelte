<script lang="ts">
	import Root from "./workbench-split-detail-root.svelte";
	import Main from "./workbench-split-detail-main.svelte";
	import Handle from "./workbench-split-detail-handle.svelte";
	import Detail from "./workbench-split-detail-detail.svelte";
</script>

<Root
	leftMin={160}
	rightMin={160}
	handleSize={12}
	defaultRatio={0.5}
	data-client-width="800"
	data-client-height="480"
	class="workbench-split-detail-test-root"
>
	<Main>
		<div data-testid="main-pane">Main</div>
	</Main>
	<Handle />
	<Detail>
		<iframe title="Detail preview" srcdoc="<p>Preview</p>"></iframe>
	</Detail>
</Root>

<style>
	:global(.workbench-split-detail-test-root) {
		inline-size: 800px;
		block-size: 480px;
	}
</style>
