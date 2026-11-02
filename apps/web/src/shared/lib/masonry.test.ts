import { describe, expect, it } from 'vite-plus/test';
import { masonryLayout } from './masonry';

describe('masonry layout', () => {
  it('uses the full width and fills short columns beside a tall image', () => {
    const layout = masonryLayout(376, [1000, 50, 80, 40, 30]);
    expect(layout.width).toBe(120);
    expect(layout.positions).toEqual([
      { left: 0, top: 0 },
      { left: 128, top: 0 },
      { left: 256, top: 0 },
      { left: 128, top: 58 },
      { left: 256, top: 88 },
    ]);
    expect(layout.positions[2].left + layout.width).toBe(376);
    expect(layout.height).toBe(1000);
    expect(layout.shortestHeight).toBe(98);
  });
  it('reflows on narrow screens and keeps an eight-pixel gap', () => {
    const layout = masonryLayout(100, [20, 40]);
    expect(layout.width).toBe(100);
    expect(layout.positions).toEqual([
      { left: 0, top: 0 },
      { left: 0, top: 28 },
    ]);
    expect(layout.height).toBe(68);
    expect(layout.shortestHeight).toBe(68);
  });
  it('loads more when a column is still empty, even beside a very tall item', () => {
    const layout = masonryLayout(376, [5000]);
    expect(layout.height).toBe(5000);
    expect(layout.shortestHeight).toBe(0);
  });
  it('does not add height for an empty collection', () => {
    expect(masonryLayout(1200, []).height).toBe(0);
    expect(masonryLayout(1200, []).shortestHeight).toBe(0);
  });
});
