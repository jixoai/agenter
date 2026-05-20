<script lang="ts">
	import { asset } from '$app/paths';
	import './layout.css';

	let { children } = $props();
	const faviconHref = asset('/favicon.ico');
	const favicon16Href = asset('/icons/favicon-16.png');
	const favicon32Href = asset('/icons/favicon-32.png');
	const faviconLight16Href = asset('/icons/favicon-light-16.png');
	const faviconLight32Href = asset('/icons/favicon-light-32.png');
	const faviconDark16Href = asset('/icons/favicon-dark-16.png');
	const faviconDark32Href = asset('/icons/favicon-dark-32.png');
	const appleTouchIconHref = asset('/icons/apple-touch-icon.png');
	const manifestHref = asset('/site.webmanifest');
</script>

<svelte:head>
	<link rel="icon" href={faviconHref} sizes="any" />
	<link rel="icon" type="image/png" sizes="16x16" href={favicon16Href} />
	<link rel="icon" type="image/png" sizes="32x32" href={favicon32Href} />
	<link rel="icon" type="image/png" sizes="16x16" href={faviconLight16Href} media="(prefers-color-scheme: light)" />
	<link rel="icon" type="image/png" sizes="32x32" href={faviconLight32Href} media="(prefers-color-scheme: light)" />
	<link rel="icon" type="image/png" sizes="16x16" href={faviconDark16Href} media="(prefers-color-scheme: dark)" />
	<link rel="icon" type="image/png" sizes="32x32" href={faviconDark32Href} media="(prefers-color-scheme: dark)" />
	<link rel="apple-touch-icon" sizes="180x180" href={appleTouchIconHref} />
	<link rel="manifest" href={manifestHref} />
	<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f3f0ea" />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#2d3239" />
</svelte:head>

{@render children()}
