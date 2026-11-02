import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactElement,
  type Ref,
} from 'react';
import { animatePress } from '../lib/animate-press';
import { desktopHover } from '../lib/desktop-hover';

export function HoverPreview({
  children,
  disabled = false,
  actionsRef,
  onHoverChange,
}: {
  children: ReactElement;
  disabled?: boolean;
  actionsRef?: Ref<HTMLDivElement>;
  onHoverChange?: (hovered: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [closing, setClosing] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const active = hovered && !disabled;

  useLayoutEffect(() => {
    onHoverChange?.(active);
  }, [active, onHoverChange]);

  const close = useCallback(() => {
    setHovered(false);
    setPressed(false);
    setClosing(true);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => setClosing(false), 180);
    return () => clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    if (disabled) close();
  }, [disabled, close]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [active, close]);

  useLayoutEffect(() => {
    const target = anchor.current;
    if (!active || !target) return;
    const position = () => {
      const rect = target.getBoundingClientRect();
      const scale = Math.max(
        1,
        Math.min(1.5, (innerWidth - 32) / rect.width, (innerHeight - 32) / rect.height),
      );
      const width = rect.width * scale;
      const height = rect.height * scale;
      const left = rect.left + (rect.width - width) / 2;
      const top = rect.top + (rect.height - height) / 2;
      const x = Math.max(16, Math.min(left, innerWidth - width - 16)) - left;
      const y = Math.max(16, Math.min(top, innerHeight - height - 16)) - top;
      target.style.setProperty('--meme-hover-scale', String(scale));
      target.style.setProperty('--meme-hover-x', `${x}px`);
      target.style.setProperty('--meme-hover-y', `${y}px`);
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(target);
    return () => observer.disconnect();
  }, [active]);

  const press = () => {
    if (!window.matchMedia(desktopHover).matches) return;
    const visual = anchor.current?.querySelector<HTMLElement>('.meme-visual');
    if (visual) animatePress(visual, { dim: active });
  };

  function syncHover(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || disabled || !window.matchMedia(desktopHover).matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (inside) {
      if (!active) {
        setClosing(false);
        setHovered(true);
      }
    } else if (active) {
      close();
    }
  }

  return (
    <div
      ref={anchor}
      data-hovered={active}
      data-pressed={pressed}
      className={`meme-hover relative min-w-0 ${active ? 'z-40' : closing ? 'z-30' : ''}`}
      onPointerEnter={syncHover}
      onPointerMoveCapture={syncHover}
      onPointerLeave={close}
      onPointerDownCapture={(event) => {
        if (event.button === 0 && window.matchMedia(desktopHover).matches) setPressed(true);
      }}
      onPointerUpCapture={() => setPressed(false)}
      onPointerCancelCapture={close}
      onClickCapture={press}
      onKeyDownCapture={(event) => {
        if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) press();
      }}
    >
      {children}
      <div
        ref={actionsRef}
        className="meme-hover-actions pointer-events-none absolute inset-0 z-10"
      />
    </div>
  );
}
