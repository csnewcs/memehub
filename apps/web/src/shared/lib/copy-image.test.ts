import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { copyImage } from './copy-image';

afterEach(() => vi.unstubAllGlobals());
function clipboard() {
  const write = vi.fn(async (items: { data: Record<string, Promise<Blob>> }[]) => {
    await items[0].data['image/png'];
  });
  vi.stubGlobal('navigator', { clipboard: { write } });
  vi.stubGlobal(
    'ClipboardItem',
    class {
      constructor(public data: Record<string, Promise<Blob>>) {}
    },
  );
  return write;
}
describe('image clipboard', () => {
  it('writes PNG bytes without sending credentials to storage', async () => {
    const write = clipboard();
    const blob = new Blob(['png'], { type: 'image/png' });
    const fetcher = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
    vi.stubGlobal('fetch', fetcher);
    await copyImage(async () => 'https://storage.example/image');
    expect(fetcher).toHaveBeenCalledWith('https://storage.example/image', { credentials: 'omit' });
    expect(await write.mock.calls[0][0][0].data['image/png']).toBe(blob);
  });
  it('starts clipboard write before the async image source resolves', async () => {
    const write = clipboard();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          blob: async () => new Blob(['png'], { type: 'image/png' }),
        }),
    );
    let resolve!: (url: string) => void;
    const source = new Promise<string>((done) => {
      resolve = done;
    });
    const pending = copyImage(() => source);
    expect(write).toHaveBeenCalledOnce();
    resolve('https://storage.example/image');
    await pending;
  });
  it('converts other image formats to PNG and closes the bitmap', async () => {
    const write = clipboard();
    const png = new Blob(['converted'], { type: 'image/png' });
    const bitmap = { width: 40, height: 20, close: vi.fn() };
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (callback: BlobCallback) => callback(png),
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          blob: async () => new Blob(['gif'], { type: 'image/gif' }),
        }),
    );
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal('document', { createElement: () => canvas });
    await copyImage(async () => 'https://storage.example/image');
    expect(canvas.width).toBe(40);
    expect(canvas.height).toBe(20);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(await write.mock.calls[0][0][0].data['image/png']).toBe(png);
  });
  it('reports failed image requests', async () => {
    clipboard();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(copyImage(async () => 'https://storage.example/image')).rejects.toThrow(
      'Could not load',
    );
  });
  it('does not fetch an image if clipboard writing is unsupported', async () => {
    vi.stubGlobal('navigator', {});
    const source = vi.fn();
    await expect(copyImage(source)).rejects.toThrow('not supported');
    expect(source).not.toHaveBeenCalled();
  });
});
