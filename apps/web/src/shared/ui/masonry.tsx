import { Children, useLayoutEffect, useRef, type ReactNode } from 'react';
import { masonryLayout } from '../lib/masonry';

export function Masonry({ children, onNearEnd }: { children: ReactNode; onNearEnd?: () => void }) {
  const onNearEndRef = useRef(onNearEnd);
  useLayoutEffect(() => {
    onNearEndRef.current = onNearEnd;
  }, [onNearEnd]);
  const container = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const items = Array.from(root.children) as HTMLElement[];
    let frame = 0;
    let shortestHeight = 0;
    const checkEnd = () => {
      if (root.getBoundingClientRect().top + shortestHeight <= window.innerHeight + 400) {
        onNearEndRef.current?.();
      }
    };
    const arrange = () => {
      const containerWidth = root.clientWidth;
      const { width } = masonryLayout(containerWidth, []);
      for (const item of items) item.style.width = `${width}px`;
      const layout = masonryLayout(
        containerWidth,
        items.map((item) => item.getBoundingClientRect().height),
      );
      items.forEach((item, index) => {
        item.style.position = 'absolute';
        item.style.left = `${layout.positions[index].left}px`;
        item.style.top = `${layout.positions[index].top}px`;
      });
      root.style.height = `${layout.height}px`;
      shortestHeight = layout.shortestHeight;
      checkEnd();
    };
    arrange();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(arrange);
    });
    window.addEventListener('scroll', checkEnd, { passive: true });
    window.addEventListener('resize', checkEnd);
    observer.observe(root);
    items.forEach((item) => observer.observe(item));
    return () => {
      window.removeEventListener('scroll', checkEnd);
      window.removeEventListener('resize', checkEnd);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [children]);

  return (
    <div ref={container} className="relative w-full">
      {Children.map(children, (child) => (
        <div className="min-w-0">{child}</div>
      ))}
    </div>
  );
}
