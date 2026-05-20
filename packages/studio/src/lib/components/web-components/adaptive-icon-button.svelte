<script lang="ts">
	import {
		ADAPTIVE_ICON_BUTTON_TAG,
		defineAdaptiveIconButton,
		type AdaptiveIconButtonElementType,
		type AdaptiveIconButtonLabelPriority,
		type AdaptiveIconButtonSize,
		type AdaptiveIconButtonVariant,
	} from '@agenter/web-components';

	defineAdaptiveIconButton();

	let {
		label,
		tooltip = '',
		title = '',
		variant = 'outline',
		size = 'sm',
		labelPriority = 'auto',
		disabled = false,
		type = 'button',
		class: className = '',
		onclick,
		children,
	}: {
		label: string;
		tooltip?: string;
		title?: string;
		variant?: AdaptiveIconButtonVariant;
		size?: AdaptiveIconButtonSize;
		labelPriority?: AdaptiveIconButtonLabelPriority;
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		onclick?: ((event: MouseEvent) => void) | null;
		children?: import('svelte').Snippet;
	} = $props();

	let element: AdaptiveIconButtonElementType | null = null;
	let removeClickListener: (() => void) | null = null;

	const syncProps = (): void => {
		if (!element) {
			return;
		}
		element.label = label;
		element.tooltip = tooltip;
		element.titleText = title;
		element.variant = variant;
		element.size = size;
		element.labelPriority = labelPriority;
		element.disabled = disabled;
		element.buttonType = type;
	};

	const syncClickListener = (): void => {
		removeClickListener?.();
		removeClickListener = null;
		if (!element || !onclick) {
			return;
		}
		const handleClick = (event: Event): void => {
			onclick(event as MouseEvent);
		};
		element.addEventListener('click', handleClick);
		removeClickListener = () => {
			element?.removeEventListener('click', handleClick);
		};
	};

	$effect(() => {
		syncProps();
	});

	$effect(() => {
		syncClickListener();
		return () => {
			removeClickListener?.();
			removeClickListener = null;
		};
	});
</script>

<svelte:element this={ADAPTIVE_ICON_BUTTON_TAG} bind:this={element} class={className}>
	<span slot="icon">
		{@render children?.()}
	</span>
</svelte:element>
