import { beforeEach, describe, expect, test, vi } from "vitest";

const getMock = vi.fn<(key: string) => Promise<number | null>>();
const setMock = vi.fn<(key: string, value: number) => Promise<void>>();

vi.mock("idb-keyval", () => ({
	get: getMock,
	set: setMock,
}));

class BroadcastChannelStub {
	static channels = new Map<string, Set<BroadcastChannelStub>>();

	readonly name: string;
	onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

	constructor(name: string) {
		this.name = name;
		const members = BroadcastChannelStub.channels.get(name) ?? new Set<BroadcastChannelStub>();
		members.add(this);
		BroadcastChannelStub.channels.set(name, members);
	}

	postMessage(data: unknown): void {
		for (const member of BroadcastChannelStub.channels.get(this.name) ?? []) {
			if (member === this || !member.onmessage) {
				continue;
			}
			member.onmessage({ data } as MessageEvent<unknown>);
		}
	}
}

describe("Feature: Workbench split-detail ratio source", () => {
	beforeEach(() => {
		getMock.mockReset();
		setMock.mockReset();
		getMock.mockResolvedValue(null);
		setMock.mockResolvedValue(undefined);
		BroadcastChannelStub.channels.clear();
		vi.unstubAllGlobals();
	});

	test("Scenario: Given a string key When the default provider reads and writes ratios Then it persists through idb-keyval", async () => {
		getMock.mockResolvedValueOnce(0.625);
		vi.stubGlobal("BroadcastChannel", BroadcastChannelStub);

		const { getDefaultWorkbenchSplitDetailRatioSource } = await import("./workbench-split-detail-ratio-source.js");
		const source = getDefaultWorkbenchSplitDetailRatioSource("workspace-shell");

		await expect(source.read()).resolves.toBe(0.625);
		await source.write(0.5);

		expect(getMock).toHaveBeenCalled();
		expect(setMock).toHaveBeenCalledWith(
			"agenter:svelte-components:workbench-split-detail:ratio:v1:workspace-shell",
			0.5,
		);
	});

	test("Scenario: Given two subscribers on the same shared key When one provider writes Then the peer subscriber receives the broadcast update", async () => {
		vi.stubGlobal("BroadcastChannel", BroadcastChannelStub);

		const { getDefaultWorkbenchSplitDetailRatioSource } = await import("./workbench-split-detail-ratio-source.js");
		const sourceA = getDefaultWorkbenchSplitDetailRatioSource("workspace-detail");
		const sourceB = getDefaultWorkbenchSplitDetailRatioSource("workspace-detail");
		const listener = vi.fn();
		sourceB.subscribe?.(listener);

		await sourceA.write(0.72);

		expect(listener).toHaveBeenCalledWith(0.72);
	});
});
