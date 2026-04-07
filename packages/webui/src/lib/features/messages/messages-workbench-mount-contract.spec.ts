import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const messageSystemSurfaceSource = readFileSync(
	resolve(import.meta.dirname, 'message-system-surface.svelte'),
	'utf8',
);
const messagesWorkbenchLayoutSource = readFileSync(
	resolve(import.meta.dirname, 'messages-workbench-layout.svelte'),
	'utf8',
);
const webChatViewRootSource = readFileSync(
	resolve(import.meta.dirname, '../../../../../web-chat-view/src/web-chat-view-root.svelte'),
	'utf8',
);

describe('Feature: Messages workbench mount contract', () => {
	test('Scenario: Given a room toolbar is injected into shared chrome When reading the room surface source Then it portals slot content instead of reviving the unstable component prop path', () => {
		expect(messageSystemSurfaceSource).toContain('<WorkbenchPageToolbar>');
		expect(messageSystemSurfaceSource).toContain('<RoomPageToolbarContent {...roomToolbarProps} />');
		expect(messageSystemSurfaceSource).not.toContain('component={RoomPageToolbarContent}');
	});

	test('Scenario: Given the messages workbench owns a fixed page toolbar region When reading the layout source Then the host remains mounted with the shared 48px container contract', () => {
		expect(messagesWorkbenchLayoutSource).toContain('bind:this={pageToolbarRegistry.host}');
		expect(messagesWorkbenchLayoutSource).toContain('class="messages-workbench-window__toolbar-host"');
		expect(messagesWorkbenchLayoutSource).toContain('block-size: 48px;');
		expect(messagesWorkbenchLayoutSource).toContain('container-type: inline-size;');
	});

	test('Scenario: Given the room transcript is stable again When reading the chat root source Then the footer renders the composer instead of the debug placeholder', () => {
		expect(webChatViewRootSource).toContain('<DefaultComposer {...composerProps} />');
		expect(webChatViewRootSource).not.toContain('chat-footer-debug-placeholder');
	});
});
