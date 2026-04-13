export interface WorkspaceManageAvatarRow {
	nickname: string;
	runtimeId: string;
	mountKind: 'workspace' | 'avatar-root' | null;
	grantCount: number;
	accessSummary: string;
}
