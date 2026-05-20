<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';

	import WorkspaceManageDialog from './workspace-manage-dialog.svelte';
	import type { WorkspaceManageAvatarRow } from './workspace-manage-dialog.types';

	let open = $state(false);
	let selectedAvatar = $state('architect');
	let rows = $state<WorkspaceManageAvatarRow[]>([
		{
			nickname: 'architect',
			runtimeId: 'runtime-architect',
			mountKind: 'workspace',
			grantCount: 2,
			accessSummary: '2 rules · one writable path',
		},
		{
			nickname: 'reviewer',
			runtimeId: 'runtime-reviewer',
			mountKind: null,
			grantCount: 0,
			accessSummary: 'Not mounted yet',
		},
		{
			nickname: 'observer',
			runtimeId: 'runtime-observer',
			mountKind: 'workspace',
			grantCount: 0,
			accessSummary: 'Mounted without rules yet',
		},
	]);

	const updateRow = (nickname: string, nextRow: Partial<WorkspaceManageAvatarRow>): void => {
		rows = rows.map((row) => (row.nickname === nickname ? { ...row, ...nextRow } : row));
	};
</script>

<div class="grid gap-4 rounded-[1.35rem] border p-4" data-testid="workspace-manage-dialog-story">
	<div class="flex flex-wrap items-center gap-3">
		<Button
			data-testid="workspace-manage-launch"
			onclick={() => {
				open = true;
			}}
		>
			Open manager
		</Button>
		<div class="text-sm text-muted-foreground">
			Current lens:
			<span class="font-semibold text-foreground" data-testid="workspace-manage-current-lens">{selectedAvatar}</span>
		</div>
	</div>

	<WorkspaceManageDialog
		bind:open
		workspacePath="/repo/agenter"
		{selectedAvatar}
		{rows}
		disableManageDialogPortal
		onMountAvatar={async (row) => {
			updateRow(row.nickname, {
				mountKind: 'workspace',
				grantCount: 0,
				accessSummary: 'Mounted without rules yet',
			});
		}}
		onUnmountAvatar={async (row) => {
			updateRow(row.nickname, {
				mountKind: null,
				grantCount: 0,
				accessSummary: 'Not mounted yet',
			});
		}}
		onOpenAvatar={(nickname) => {
			selectedAvatar = nickname;
		}}
	/>
</div>
