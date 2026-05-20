import type { ScopedSettingsLayerEntry, ScopedSettingsOutput } from '@agenter/client-sdk';

export interface SettingsProvenanceOrigin {
	layerId: string;
	sourceId: string;
	kind: 'default' | 'file' | 'avatar' | 'derived';
	path: string;
	pointer: string;
	value: unknown;
	note?: string;
}

export interface SettingsPointerJumpTarget {
	layerId: string;
	pointer: string;
}

export interface SettingsProvenanceEntry {
	pointer: string;
	origins: SettingsProvenanceOrigin[];
	jumpTarget?: SettingsPointerJumpTarget;
}

export type SettingsEffectiveGraph = Omit<ScopedSettingsOutput['effective'], 'provenance'> & {
	provenance: Record<string, SettingsProvenanceEntry>;
};

export type SettingsLayerItem = ScopedSettingsLayerEntry;

export interface SettingsLayerFile {
	layer: SettingsLayerItem;
	path: string;
	content: string;
	mtimeMs: number;
}
