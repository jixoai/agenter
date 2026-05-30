export interface WorkspaceManageAvatarRow {
	nickname: string;
	runtimeId: string;
	iconUrl?: string | null;
	mountKind: 'workspace' | 'avatar-root' | null;
	grantCount: number;
	accessSummary: string;
}
