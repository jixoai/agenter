import { getContext, setContext } from 'svelte';

type StickToBottomOptions = {
	initial?: ScrollBehavior;
	resize?: ScrollBehavior;
	observeResize?: boolean;
	observeMutations?: boolean;
};

const STICK_TO_BOTTOM_CONTEXT_KEY = Symbol('stick-to-bottom-context');

class StickToBottomContext {
	#element = $state<HTMLElement | null>(null);
	#isAtBottom = $state(true);
	#resizeObserver: ResizeObserver | null = null;
	#mutationObserver: MutationObserver | null = null;
	#intersectionObserver: IntersectionObserver | null = null;
	#sentinel: HTMLElement | null = null;
	#userHasScrolled = $state(false);
	#programmaticScrollGuardFrames = 0;
	#programmaticScrollGuardHandle = 0;
	#initial: ScrollBehavior;
	#resize: ScrollBehavior;
	#observeResize: boolean;
	#observeMutations: boolean;

	constructor(options: StickToBottomOptions = {}) {
		this.#initial = options.initial ?? 'auto';
		this.#resize = options.resize ?? 'smooth';
		this.#observeResize = options.observeResize ?? true;
		this.#observeMutations = options.observeMutations ?? true;
	}

	get isAtBottom() {
		return this.#isAtBottom;
	}

	get shouldStick() {
		return !this.#userHasScrolled;
	}

	configure(options: StickToBottomOptions) {
		this.#initial = options.initial ?? this.#initial;
		this.#resize = options.resize ?? this.#resize;
		this.#observeResize = options.observeResize ?? this.#observeResize;
		this.#observeMutations = options.observeMutations ?? this.#observeMutations;
	}

	setElement(element: HTMLElement | null) {
		if (this.#element === element) {
			return;
		}
		this.#cleanup();
		this.#element = element;
		this.#setup();
	}

	scrollToBottom(behavior: ScrollBehavior = 'smooth') {
		if (!this.#element) {
			return;
		}
		this.#userHasScrolled = false;
		this.#armProgrammaticScrollGuard();
		this.#element.scrollTo({
			top: this.#element.scrollHeight,
			behavior,
		});
		this.#element.dispatchEvent(new Event('scroll'));
	}

	#handleScroll = () => {
		if (!this.#element) {
			return;
		}
		const { scrollTop, scrollHeight, clientHeight } = this.#element;
		const threshold = 160;
		const isAtBottom = scrollTop + clientHeight >= scrollHeight - threshold;
		this.#isAtBottom = isAtBottom;
		if (isAtBottom) {
			this.#userHasScrolled = false;
			return;
		}
		if (this.#programmaticScrollGuardFrames > 0) {
			return;
		}
		this.#userHasScrolled = true;
	};

	#armProgrammaticScrollGuard(frames = 24) {
		if (this.#programmaticScrollGuardHandle !== 0) {
			cancelAnimationFrame(this.#programmaticScrollGuardHandle);
			this.#programmaticScrollGuardHandle = 0;
		}
		this.#programmaticScrollGuardFrames = frames;
		const tickGuard = () => {
			if (this.#programmaticScrollGuardFrames <= 0) {
				this.#programmaticScrollGuardHandle = 0;
				return;
			}
			this.#programmaticScrollGuardFrames -= 1;
			this.#programmaticScrollGuardHandle = requestAnimationFrame(tickGuard);
		};
		this.#programmaticScrollGuardHandle = requestAnimationFrame(tickGuard);
	}

	#checkScrollPosition() {
		if (!this.#element) {
			return;
		}
		const { scrollTop, scrollHeight, clientHeight } = this.#element;
		this.#isAtBottom = scrollTop + clientHeight >= scrollHeight - 160;
	}

	#setup() {
		if (!this.#element) {
			return;
		}
		this.#sentinel = document.createElement('div');
		this.#sentinel.style.height = '1px';
		this.#sentinel.style.width = '100%';
		this.#sentinel.style.opacity = '0';
		this.#sentinel.style.pointerEvents = 'none';
		this.#element.appendChild(this.#sentinel);

		this.#intersectionObserver = new IntersectionObserver(
			(entries) => {
				const first = entries[0];
				if (first?.isIntersecting) {
					this.#isAtBottom = true;
					this.#userHasScrolled = false;
				}
			},
			{
				root: this.#element,
				threshold: 0,
			},
		);
		this.#intersectionObserver.observe(this.#sentinel);

		this.#element.addEventListener('scroll', this.#handleScroll, { passive: true });

		if (this.#observeResize) {
			this.#resizeObserver = new ResizeObserver(() => {
				this.#checkScrollPosition();
				if (this.#isAtBottom && !this.#userHasScrolled) {
					this.scrollToBottom(this.#resize);
				}
			});
			this.#resizeObserver.observe(this.#element);
		}

		if (this.#observeMutations) {
			this.#mutationObserver = new MutationObserver(() => {
				requestAnimationFrame(() => {
					const shouldStick = this.#isAtBottom && !this.#userHasScrolled;
					this.#checkScrollPosition();
					if (shouldStick) {
						this.scrollToBottom(this.#resize);
					}
				});
			});
			this.#mutationObserver.observe(this.#element, {
				childList: true,
				subtree: true,
				characterData: true,
			});
		}

		this.#checkScrollPosition();
		this.scrollToBottom(this.#initial);
	}

	#cleanup() {
		this.#resizeObserver?.disconnect();
		this.#mutationObserver?.disconnect();
		this.#intersectionObserver?.disconnect();
		if (this.#programmaticScrollGuardHandle !== 0) {
			cancelAnimationFrame(this.#programmaticScrollGuardHandle);
		}
		if (this.#element) {
			this.#element.removeEventListener('scroll', this.#handleScroll);
		}
		if (this.#element && this.#sentinel && this.#element.contains(this.#sentinel)) {
			this.#element.removeChild(this.#sentinel);
		}
		this.#resizeObserver = null;
		this.#mutationObserver = null;
		this.#intersectionObserver = null;
		this.#sentinel = null;
		this.#programmaticScrollGuardFrames = 0;
		this.#programmaticScrollGuardHandle = 0;
	}
}

export const setStickToBottomContext = (options: StickToBottomOptions = {}): StickToBottomContext => {
	const context = new StickToBottomContext(options);
	setContext(STICK_TO_BOTTOM_CONTEXT_KEY, context);
	return context;
};

export const getStickToBottomContext = (): StickToBottomContext => {
	const context = getContext<StickToBottomContext | undefined>(STICK_TO_BOTTOM_CONTEXT_KEY);
	if (!context) {
		throw new Error('StickToBottomContext must be used within a Conversation component');
	}
	return context;
};
