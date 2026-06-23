// @vitest-environment jsdom

import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import RootHarness from "./workbench-split-detail-root.test-harness.svelte";

const settle = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
	flushSync();
};

const createPointerEvent = (type: string, init: PointerEventInit): PointerEvent => {
	if (typeof PointerEvent === "function") {
		return new PointerEvent(type, init);
	}
	const event = new MouseEvent(type, init);
	Object.defineProperties(event, {
		pointerId: {
			value: init.pointerId ?? 0,
		},
		pointerType: {
			value: init.pointerType ?? "mouse",
		},
	});
	return event as PointerEvent;
};

const readSeparatorValue = (handle: HTMLElement): number => {
	const value = Number(handle.getAttribute("aria-valuenow"));
	if (!Number.isFinite(value)) {
		throw new Error("Split-detail separator did not expose a numeric aria-valuenow.");
	}
	return value;
};

const installLayoutMetrics = (): void => {
	Object.defineProperty(HTMLElement.prototype, "clientWidth", {
		configurable: true,
		get() {
			return Number(this.dataset.clientWidth ?? "0");
		},
	});
	Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
		configurable: true,
		value() {
			const width = Number(this.dataset.clientWidth ?? "0");
			const height = Number(this.dataset.clientHeight ?? "0");
			const left = Number(this.dataset.left ?? "0");
			const top = Number(this.dataset.top ?? "0");
			return {
				x: left,
				y: top,
				left,
				top,
				right: left + width,
				bottom: top + height,
				width,
				height,
				toJSON() {
					return {};
				},
			};
		},
	});
};

const mountRootHarness = async () => {
	const target = document.createElement("div");
	document.body.append(target);

	const component = mount(RootHarness, {
		target,
	});
	flushSync();

	const root = target.querySelector<HTMLElement>('[data-layout-role="workbench-split-detail-root"]');
	const handle = target.querySelector<HTMLElement>('[data-layout-role="workbench-split-detail-handle"]');
	const iframe = target.querySelector<HTMLIFrameElement>("iframe");
	if (!root || !handle || !iframe) {
		throw new Error("Failed to mount workbench split-detail root harness.");
	}
	handle.dataset.clientWidth = "12";
	handle.dataset.clientHeight = "480";
	await settle();

	return { component, target, root, handle, iframe };
};

describe("Feature: Workbench split-detail resize drag ownership", () => {
	beforeEach(() => {
		installLayoutMetrics();
		vi.stubGlobal(
			"ResizeObserver",
			class ResizeObserverMock {
				constructor(private readonly callback: ResizeObserverCallback) {}

				observe(target: Element): void {
					this.callback(
						[
							{
								target,
								contentRect: {
									width: (target as HTMLElement).clientWidth,
								},
							} as ResizeObserverEntry,
						],
						this as unknown as ResizeObserver,
					);
				}

				disconnect(): void {}
				unobserve(): void {}
			},
		);
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		});
		vi.stubGlobal("cancelAnimationFrame", () => {});
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
	});

	test("Scenario: Given an iframe inside detail When resizing crosses it Then drag ownership stays in the parent shell", async () => {
		const { component, root, handle, iframe } = await mountRootHarness();
		const initialValue = readSeparatorValue(handle);

		handle.dispatchEvent(
			createPointerEvent("pointerdown", {
				bubbles: true,
				cancelable: true,
				button: 0,
				clientX: 400,
				clientY: 10,
				pointerId: 17,
				pointerType: "mouse",
			}),
		);
		await settle();

		const dragShield = document.querySelector<HTMLElement>(
			'[data-layout-role="workbench-split-detail-drag-shield"]',
		);
		expect(root.dataset.dragging).toBe("true");
		expect(dragShield).toBeInstanceOf(HTMLElement);
		expect(dragShield?.dataset.slot).toBe("workbench-split-detail-drag-shield");
		expect(iframe).toBeInstanceOf(HTMLIFrameElement);
		if (!dragShield) {
			throw new Error("Split-detail drag shield did not mount.");
		}

		dragShield.dispatchEvent(
			createPointerEvent("pointermove", {
				bubbles: true,
				cancelable: true,
				clientX: 472,
				clientY: 10,
				pointerId: 99,
				pointerType: "mouse",
			}),
		);
		await settle();
		expect(readSeparatorValue(handle)).toBe(initialValue);

		dragShield.dispatchEvent(
			createPointerEvent("pointermove", {
				bubbles: true,
				cancelable: true,
				clientX: 472,
				clientY: 10,
				pointerId: 17,
				pointerType: "mouse",
			}),
		);
		await settle();
		expect(readSeparatorValue(handle)).toBeGreaterThan(initialValue);

		dragShield.dispatchEvent(
			createPointerEvent("pointerup", {
				bubbles: true,
				cancelable: true,
				clientX: 472,
				clientY: 10,
				pointerId: 17,
				pointerType: "mouse",
			}),
		);
		await settle();

		expect(root.dataset.dragging).toBe("false");
		expect(document.querySelector('[data-layout-role="workbench-split-detail-drag-shield"]')).toBeNull();

		unmount(component);
	});
});
