import { getContext, setContext } from 'svelte';

type StickToBottomOptions = {
	initial?: ScrollBehavior;
	resize?: ScrollBehavior;
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
	#initial: ScrollBehavior;
	#resize: ScrollBehavior;

	constructor(options: StickToBottomOptions = {}) {
		this.#initial = options.initial ?? 'auto';
		this.#resize = options.resize ?? 'smooth';
	}

	get isAtBottom() {
		return this.#isAtBottom;
	}

	configure(options: StickToBottomOptions) {
		this.#initial = options.initial ?? this.#initial;
		this.#resize = options.resize ?? this.#resize;
	}

	setElement(element: HTMLElement) {
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
		this.#element.scrollTo({
			top: this.#element.scrollHeight,
			behavior,
		});
	}

	#handleScroll = () => {
		if (!this.#element) {
			return;
		}
		const { scrollTop, scrollHeight, clientHeight } = this.#element;
		const threshold = 160;
		const isAtBottom = scrollTop + clientHeight >= scrollHeight - threshold;
		this.#isAtBottom = isAtBottom;
		this.#userHasScrolled = !isAtBottom;
	};

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

		this.#resizeObserver = new ResizeObserver(() => {
			this.#checkScrollPosition();
			if (this.#isAtBottom && !this.#userHasScrolled) {
				this.scrollToBottom(this.#resize);
			}
		});
		this.#resizeObserver.observe(this.#element);

		this.#mutationObserver = new MutationObserver(() => {
			requestAnimationFrame(() => {
				const shouldStick = this.#isAtBottom && !this.#userHasScrolled;
				this.#checkScrollPosition();
				if (shouldStick) {
					this.scrollToBottom('smooth');
				}
			});
		});
		this.#mutationObserver.observe(this.#element, {
			childList: true,
			subtree: true,
			characterData: true,
		});

		this.#checkScrollPosition();
		this.scrollToBottom(this.#initial);
	}

	#cleanup() {
		this.#resizeObserver?.disconnect();
		this.#mutationObserver?.disconnect();
		this.#intersectionObserver?.disconnect();
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
