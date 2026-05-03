import { describe, test } from 'vitest';

import * as stories from '../../src/lib/features/terminals/terminal-system-surface.stories';
import { getPortableStory } from './portable-stories';

const WriteSuccessClearsDraft = getPortableStory(stories, 'WriteSuccessClearsDraft');
const ApprovalRequestedKeepsDraft = getPortableStory(stories, 'ApprovalRequestedKeepsDraft');
const FailedWriteKeepsDraft = getPortableStory(stories, 'FailedWriteKeepsDraft');
const UsersPaneWideActionsStayBehaviorallyAligned = getPortableStory(
	stories,
	'UsersPaneWideActionsStayBehaviorallyAligned',
);
const UsersPaneCompactActionsStayBehaviorallyAligned = getPortableStory(
	stories,
	'UsersPaneCompactActionsStayBehaviorallyAligned',
);
const ApprovalLifecycleStaysInUsersPane = getPortableStory(stories, 'ApprovalLifecycleStaysInUsersPane');
const DeniedApprovalLeavesSeatWithoutLease = getPortableStory(stories, 'DeniedApprovalLeavesSeatWithoutLease');
const AuthoritativeProjectionOmitsBootstrapSeat = getPortableStory(
	stories,
	'AuthoritativeProjectionOmitsBootstrapSeat',
);
const SnapshotHydratesViewportBeforeTransportReconnect = getPortableStory(
	stories,
	'SnapshotHydratesViewportBeforeTransportReconnect',
);
const ToolbarStatusReflectsBusyRuntimeFacts = getPortableStory(stories, 'ToolbarStatusReflectsBusyRuntimeFacts');
const WideSurfaceUsesResizableDetailSplit = getPortableStory(stories, 'WideSurfaceUsesResizableDetailSplit');
const CompactSurfaceKeepsDetailReachable = getPortableStory(stories, 'CompactSurfaceKeepsDetailReachable');
const ReadActionStructuredPreviewStaysCompact = getPortableStory(
	stories,
	'ReadActionStructuredPreviewStaysCompact',
);
const WindowChromeTogglesProjectionMode = getPortableStory(stories, 'WindowChromeTogglesProjectionMode');
const WindowChromeLiveResizeUpdatesFrameHint = getPortableStory(stories, 'WindowChromeLiveResizeUpdatesFrameHint');
const WindowCloseRequiresConfirmation = getPortableStory(stories, 'WindowCloseRequiresConfirmation');
const KillPtyRequiresConfirmation = getPortableStory(stories, 'KillPtyRequiresConfirmation');

describe('Feature: Storybook DOM contract for terminal system surface', () => {
	test('Scenario: Given a successful terminal write When the tool call resolves Then the editor draft clears and the terminal facts stay visible', async () => {
		await WriteSuccessClearsDraft.run();
	});

	test('Scenario: Given a terminal write requires approval When the tool call resolves Then the draft stays in the editor and the approval notice is visible', async () => {
		await ApprovalRequestedKeepsDraft.run();
	});

	test('Scenario: Given a terminal write fails When the tool call resolves Then the draft stays in the editor and the error notice remains visible', async () => {
		await FailedWriteKeepsDraft.run();
	});

	test('Scenario: Given a wide users pane with an existing grant When focus and revoke actions run Then the shared seat behavior model stays consistent', async () => {
		await UsersPaneWideActionsStayBehaviorallyAligned.run();
	});

	test('Scenario: Given a compact users pane When focus actions run Then the shared seat behavior model stays consistent', async () => {
		await UsersPaneCompactActionsStayBehaviorallyAligned.run();
	});

	test('Scenario: Given a pending write approval When the users pane approves it Then the requester lease surfaces without rebuilding local seat truth', async () => {
		await ApprovalLifecycleStaysInUsersPane.run();
	});

	test('Scenario: Given a pending write approval When the users pane denies it Then the requester seat stays lease-free and the denial remains visible', async () => {
		await DeniedApprovalLeavesSeatWithoutLease.run();
	});

	test('Scenario: Given a terminal surface projection without a system actor seat When the users pane renders Then the route does not fabricate a bootstrap seat row', async () => {
		await AuthoritativeProjectionOmitsBootstrapSeat.run();
	});

	test('Scenario: Given durable snapshot truth When the terminal route hydrates before transport reconnect Then the viewport renders without product chrome and stays readable', async () => {
		await SnapshotHydratesViewportBeforeTransportReconnect.run();
	});

	test('Scenario: Given a running busy terminal When the selected route renders Then the page-toolbar status reflects authoritative runtime facts', async () => {
		await ToolbarStatusReflectsBusyRuntimeFacts.run();
	});

	test('Scenario: Given a wide terminal surface When the shared split-detail shell renders Then the activity rail stays in a persistent resizable right pane', async () => {
		await WideSurfaceUsesResizableDetailSplit.run();
	});

	test('Scenario: Given a narrow terminal surface When the shared split-detail shell collapses Then the actions rail opens through the shared right sheet instead of stacking below the stage', async () => {
		await CompactSurfaceKeepsDetailReachable.run();
	});

	test('Scenario: Given a terminal read action When the shared tool invocation card renders YAML previews Then the read parameter panel stays above a compact actor row and each mapping line stays compact', async () => {
		await ReadActionStructuredPreviewStaysCompact.run();
	});

	test('Scenario: Given a terminal window chrome When the maximize control toggles Then fit-cover changes the window geometry instead of scaling the titlebar', async () => {
		await WindowChromeTogglesProjectionMode.run();
	});

	test('Scenario: Given a terminal window live resize handle When the operator drags it Then the frame hint updates before any durable resize form is used', async () => {
		await WindowChromeLiveResizeUpdatesFrameHint.run();
	});

	test('Scenario: Given a terminal toolbar delete action When deletion is confirmed Then the surface removes the terminal only after the confirmation dialog accepts it', async () => {
		await WindowCloseRequiresConfirmation.run();
	});

	test('Scenario: Given terminal lifecycle kill is requested When the operator confirms the warning Then the PTY stops only after the confirmation dialog accepts it', async () => {
		await KillPtyRequiresConfirmation.run();
	});
});
