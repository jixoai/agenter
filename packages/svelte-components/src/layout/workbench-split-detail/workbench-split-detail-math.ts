export interface WorkbenchSplitDetailMathOptions {
	containerWidth: number;
	ratio: number;
	leftMin: number;
	rightMin: number;
	handleSize: number;
	compactThreshold?: number;
}

export interface WorkbenchSplitDetailLayoutResolution {
	compact: boolean;
	minRequiredWidth: number;
	leftWidth: number;
	rightWidth: number;
	availableWidth: number;
	ratio: number;
}

const DEFAULT_RATIO = 0.625;

const clamp = (value: number, min: number, max: number): number => {
	return Math.min(max, Math.max(min, value));
};

export const clampWorkbenchSplitDetailRatio = (ratio: number): number => {
	if (!Number.isFinite(ratio)) {
		return DEFAULT_RATIO;
	}
	return clamp(ratio, 0, 1);
};

export const resolveWorkbenchSplitDetailThreshold = ({
	leftMin,
	rightMin,
	handleSize,
	compactThreshold,
}: Pick<
	WorkbenchSplitDetailMathOptions,
	"leftMin" | "rightMin" | "handleSize" | "compactThreshold"
>): number => {
	const structuralMinimum = Math.max(0, leftMin) + Math.max(0, rightMin) + Math.max(0, handleSize);
	return Math.max(structuralMinimum, compactThreshold ?? structuralMinimum);
};

export const resolveWorkbenchSplitDetailLayout = ({
	containerWidth,
	ratio,
	leftMin,
	rightMin,
	handleSize,
	compactThreshold,
}: WorkbenchSplitDetailMathOptions): WorkbenchSplitDetailLayoutResolution => {
	const nextRatio = clampWorkbenchSplitDetailRatio(ratio);
	const safeHandleSize = Math.max(0, handleSize);
	const safeLeftMin = Math.max(0, leftMin);
	const safeRightMin = Math.max(0, rightMin);
	const minRequiredWidth = resolveWorkbenchSplitDetailThreshold({
		leftMin: safeLeftMin,
		rightMin: safeRightMin,
		handleSize: safeHandleSize,
		compactThreshold,
	});
	const safeContainerWidth = Math.max(0, containerWidth);

	if (safeContainerWidth < minRequiredWidth) {
		return {
			compact: true,
			minRequiredWidth,
			leftWidth: safeContainerWidth,
			rightWidth: 0,
			availableWidth: Math.max(0, safeContainerWidth - safeHandleSize),
			ratio: nextRatio,
		};
	}

	const availableWidth = Math.max(0, safeContainerWidth - safeHandleSize);
	const leftWidth = clamp(
		availableWidth * nextRatio,
		safeLeftMin,
		Math.max(safeLeftMin, availableWidth - safeRightMin),
	);
	const rightWidth = Math.max(0, availableWidth - leftWidth);

	return {
		compact: false,
		minRequiredWidth,
		leftWidth,
		rightWidth,
		availableWidth,
		ratio: nextRatio,
	};
};

export interface WorkbenchSplitDetailPointerRatioOptions
	extends Pick<
		WorkbenchSplitDetailMathOptions,
		"containerWidth" | "ratio" | "leftMin" | "rightMin" | "handleSize" | "compactThreshold"
	> {
	pointerOffset: number;
}

export const resolveWorkbenchSplitDetailRatioFromPointer = ({
	pointerOffset,
	...options
}: WorkbenchSplitDetailPointerRatioOptions): number => {
	const layout = resolveWorkbenchSplitDetailLayout(options);
	if (layout.compact || layout.availableWidth <= 0) {
		return layout.ratio;
	}
	const nextLeftWidth = clamp(
		pointerOffset - Math.max(0, options.handleSize) / 2,
		Math.max(0, options.leftMin),
		Math.max(Math.max(0, options.leftMin), layout.availableWidth - Math.max(0, options.rightMin)),
	);
	return clampWorkbenchSplitDetailRatio(nextLeftWidth / layout.availableWidth);
};

export interface WorkbenchSplitDetailRatioShiftOptions extends WorkbenchSplitDetailMathOptions {
	deltaPx: number;
}

export const shiftWorkbenchSplitDetailRatio = ({
	deltaPx,
	...options
}: WorkbenchSplitDetailRatioShiftOptions): number => {
	const layout = resolveWorkbenchSplitDetailLayout(options);
	if (layout.compact || layout.availableWidth <= 0) {
		return layout.ratio;
	}
	const nextLeftWidth = clamp(
		layout.leftWidth + deltaPx,
		Math.max(0, options.leftMin),
		Math.max(Math.max(0, options.leftMin), layout.availableWidth - Math.max(0, options.rightMin)),
	);
	return clampWorkbenchSplitDetailRatio(nextLeftWidth / layout.availableWidth);
};

export const resolveWorkbenchSplitDetailMinRatio = ({
	containerWidth,
	leftMin,
	rightMin,
	handleSize,
	compactThreshold,
}: Pick<
	WorkbenchSplitDetailMathOptions,
	"containerWidth" | "leftMin" | "rightMin" | "handleSize" | "compactThreshold"
>): number => {
	const layout = resolveWorkbenchSplitDetailLayout({
		containerWidth,
		ratio: 0.5,
		leftMin,
		rightMin,
		handleSize,
		compactThreshold,
	});
	if (layout.compact || layout.availableWidth <= 0) {
		return 0.5;
	}
	return clampWorkbenchSplitDetailRatio(Math.max(0, leftMin) / layout.availableWidth);
};

export const resolveWorkbenchSplitDetailMaxRatio = ({
	containerWidth,
	leftMin,
	rightMin,
	handleSize,
	compactThreshold,
}: Pick<
	WorkbenchSplitDetailMathOptions,
	"containerWidth" | "leftMin" | "rightMin" | "handleSize" | "compactThreshold"
>): number => {
	const layout = resolveWorkbenchSplitDetailLayout({
		containerWidth,
		ratio: 0.5,
		leftMin,
		rightMin,
		handleSize,
		compactThreshold,
	});
	if (layout.compact || layout.availableWidth <= 0) {
		return 0.5;
	}
	return clampWorkbenchSplitDetailRatio(
		(layout.availableWidth - Math.max(0, rightMin)) / layout.availableWidth,
	);
};
