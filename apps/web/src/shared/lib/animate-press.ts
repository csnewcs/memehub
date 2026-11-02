const animations = new WeakMap<HTMLElement, Animation>();

export function animatePress(element: HTMLElement, { dim = true }: { dim?: boolean } = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const current = getComputedStyle(element);
  const scale = current.scale === 'none' ? '1' : current.scale;
  const filter = current.filter;
  animations.get(element)?.cancel();
  const animation = element.animate(
    [
      { scale, filter, offset: 0 },
      { scale: '0.95', filter: dim ? 'brightness(0.9)' : filter, offset: 0.35 },
      { scale: '1', filter: dim ? 'brightness(1)' : filter, offset: 1 },
    ],
    { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  );
  animations.set(element, animation);
}
