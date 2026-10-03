export function reveal(node: HTMLElement, delay = 0) {
	node.style.setProperty('--reveal-delay', `${delay}ms`);

	if (typeof IntersectionObserver === 'undefined') return;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const viewport = window.innerHeight || document.documentElement.clientHeight;
	if (node.getBoundingClientRect().top < viewport * 0.92) return;

	node.classList.add('reveal-hidden');

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				node.classList.add('is-show');
				observer.unobserve(node);
			}
		},
		{ rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
	);

	observer.observe(node);

	return {
		destroy() {
			observer.disconnect();
		}
	};
}
