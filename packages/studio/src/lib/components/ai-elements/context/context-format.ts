export const contextIntegerFormatter = new Intl.NumberFormat('en-US');

export const formatContextInteger = (value: number | null | undefined): string =>
	typeof value === 'number' && Number.isFinite(value) ? contextIntegerFormatter.format(value) : 'n/a';

export const formatContextPercent = (value: number | null | undefined): string =>
	typeof value === 'number' && Number.isFinite(value)
		? new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(value)
		: 'n/a';
