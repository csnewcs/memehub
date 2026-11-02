import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { animatePress } from './animate-press';

afterEach(() => vi.unstubAllGlobals());

describe('animatePress', () => {
  it('eases a quick press back to its original size and restarts on repeated clicks', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('getComputedStyle', () => ({ scale: 'none', filter: 'none' }));
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ cancel }));
    const element = { animate } as unknown as HTMLElement;
    animatePress(element);
    expect(animate).toHaveBeenCalledWith(
      [
        { scale: '1', filter: 'none', offset: 0 },
        { scale: '0.95', filter: 'brightness(0.9)', offset: 0.35 },
        { scale: '1', filter: 'brightness(1)', offset: 1 },
      ],
      { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
    animatePress(element);
    expect(cancel).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it('respects reduced-motion preferences', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const animate = vi.fn();
    animatePress({ animate } as unknown as HTMLElement);
    expect(animate).not.toHaveBeenCalled();
  });
});
