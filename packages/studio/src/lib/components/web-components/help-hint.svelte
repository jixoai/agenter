<script lang="ts">
	import {
		HELP_HINT_TAG,
		defineHelpHint,
		type HelpHintAlign,
		type HelpHintElementType,
		type HelpHintSide,
	} from '@agenter/web-components';

	defineHelpHint();

	let {
		textContext,
		helpId = '',
		ariaLabel = 'Help',
		side = 'top',
		align = 'center',
		sideOffset = 8,
		passiveOnFirstVisit = false,
		disabled = false,
		class: className = '',
		children,
	}: {
		textContext: string;
		helpId?: string;
		ariaLabel?: string;
		side?: HelpHintSide;
		align?: HelpHintAlign;
		sideOffset?: number;
		passiveOnFirstVisit?: boolean;
		disabled?: boolean;
		class?: string;
		children?: import('svelte').Snippet;
	} = $props();

	let element: HelpHintElementType | null = null;

	const syncProps = (): void => {
		if (!element) {
			return;
		}
		element.textContext = textContext;
		element.helpId = helpId;
		element.ariaLabel = ariaLabel;
		element.side = side;
		element.align = align;
		element.sideOffset = sideOffset;
		element.passiveOnFirstVisit = passiveOnFirstVisit;
		element.disabled = disabled;
	};

	$effect(() => {
		syncProps();
	});
</script>

<svelte:element this={HELP_HINT_TAG} bind:this={element} class={className}>
	{@render children?.()}
</svelte:element>
