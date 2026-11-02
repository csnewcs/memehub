const gap = 8;
const minimumWidth = 120;

export function masonryLayout(containerWidth: number, heights: number[]) {
  const columns = Math.max(1, Math.floor((containerWidth + gap) / (minimumWidth + gap)));
  const width = Math.max(0, (containerWidth - gap * (columns - 1)) / columns);
  const bottoms = Array<number>(columns).fill(0);
  const positions = heights.map((height) => {
    const column = bottoms.indexOf(Math.min(...bottoms));
    const top = bottoms[column];
    bottoms[column] += height + gap;
    return { left: column * (width + gap), top };
  });
  return {
    width,
    positions,
    height: Math.max(0, Math.max(...bottoms) - gap),
    shortestHeight: Math.max(0, Math.min(...bottoms) - gap),
  };
}
