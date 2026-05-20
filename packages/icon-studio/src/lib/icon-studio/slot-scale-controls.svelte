<script lang="ts">
	import {
		MAX_SLOT_SCALE,
		MIN_SLOT_SCALE,
		SLOT_SCALE_STEP,
		clampSlotScale,
	} from './icon-system-contract';

	interface Props {
		fieldClass: string;
		helpText?: string;
		label?: string;
		onChange: (value: number) => void;
		value: number;
	}

	let {
		fieldClass,
		helpText = 'Controls how aggressively the SVG fills the slot container.',
		label = 'Scale',
		onChange,
		value,
	}: Props = $props();

	const applyScale = (nextValue: number | string): void => {
		const parsedValue = typeof nextValue === 'number' ? nextValue : Number.parseFloat(nextValue);
		onChange(clampSlotScale(parsedValue));
	};
</script>

<div class="grid gap-3 rounded-xl border border-border/60 bg-background/75 p-3 text-sm">
	<div class="flex items-center justify-between gap-3">
		<span class="font-medium">{label}</span>
		<span class="rounded-full border border-border/60 bg-background/90 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
			{value.toFixed(2)}x
		</span>
	</div>

	<input
		class="accent-foreground"
		type="range"
		min={MIN_SLOT_SCALE}
		max={MAX_SLOT_SCALE}
		step={SLOT_SCALE_STEP}
		value={value}
		oninput={(event) => applyScale((event.currentTarget as HTMLInputElement).value)}
	/>

	<label class="grid gap-2">
		<span class="text-xs uppercase tracking-[0.16em] text-muted-foreground">Numeric value</span>
		<input
			class={fieldClass}
			type="number"
			min={MIN_SLOT_SCALE}
			max={MAX_SLOT_SCALE}
			step={SLOT_SCALE_STEP}
			value={value.toFixed(2)}
			onchange={(event) => applyScale((event.currentTarget as HTMLInputElement).value)}
		/>
	</label>

	<div class="text-xs leading-5 text-muted-foreground">{helpText}</div>
</div>
