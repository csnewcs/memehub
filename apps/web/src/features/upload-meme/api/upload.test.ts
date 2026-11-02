import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import axios from 'axios';
import { createApi } from '../../../shared/api/client';
import { createTextMeme, uploadImage } from './upload';

afterEach(() => vi.restoreAllMocks());
describe('image uploads', () => {
  it('hashes, reserves, uploads without API credentials, and completes in order', async () => {
    const api = createApi('/api');
    const steps: string[] = [];
    const input = {
      file: new File(['image bytes'], 'meme.png', { type: 'image/png' }),
      title: 'Meme',
      source_url: '',
      source_name: 'Source',
      source_author: 'Author',
    };
    api.defaults.adapter = async (config) => {
      steps.push(config.url!);
      if (config.url === 'memes') {
        const body = JSON.parse(config.data);
        expect(body.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(body.size_bytes).toBe(11);
        expect(body.source_author).toBe('Author');
        return {
          config,
          status: 201,
          statusText: 'Created',
          headers: {},
          data: {
            id: 'saved',
            upload: {
              url: 'https://storage.example/staging',
              method: 'PUT',
              headers: { 'Content-Type': 'image/png' },
            },
          },
        };
      }
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { id: 'saved', status: 'ready' },
      };
    };
    const put = vi.spyOn(axios, 'put').mockImplementation(async (_url, _file, options) => {
      steps.push('storage');
      expect(options?.withCredentials).toBe(false);
      expect(options?.headers).not.toHaveProperty('X-CSRF-Token');
      return { data: null };
    });
    expect(await uploadImage(api, input, () => {})).toEqual({ id: 'saved', status: 'ready' });
    expect(put).toHaveBeenCalledOnce();
    expect(steps).toEqual(['memes', 'storage', 'memes/saved/upload-completion']);
  });
  it('does not complete a failed storage upload', async () => {
    const api = createApi('/api');
    let calls = 0;
    api.defaults.adapter = async (config) => {
      calls++;
      return {
        config,
        status: 201,
        statusText: 'Created',
        headers: {},
        data: {
          id: 'saved',
          upload: { url: 'https://storage.example/staging', method: 'PUT', headers: {} },
        },
      };
    };
    vi.spyOn(axios, 'put').mockRejectedValue(new Error('storage failed'));
    await expect(
      uploadImage(
        api,
        {
          file: new File(['bytes'], 'm.png', { type: 'image/png' }),
          title: '',
          source_url: '',
          source_name: '',
          source_author: '',
        },
        () => {},
      ),
    ).rejects.toThrow('storage failed');
    expect(calls).toBe(1);
  });
});

describe('text memes', () => {
  it('saves text and source information without image storage requests', async () => {
    const api = createApi('/api');
    const put = vi.spyOn(axios, 'put');
    let requests = 0;
    api.defaults.adapter = async (config) => {
      requests++;
      expect(config.url).toBe('memes');
      expect(config.method).toBe('post');
      expect(JSON.parse(config.data)).toEqual({
        content_type: 'text',
        body_text: 'First line\nSecond line',
        title: 'A text meme',
        source_url: 'https://example.com/post',
        source_name: 'Example',
        source_author: 'Creator',
      });
      return {
        config,
        status: 201,
        statusText: 'Created',
        headers: {},
        data: { id: 'text-meme', content_type: 'text', body_text: 'First line\nSecond line' },
      };
    };
    const result = await createTextMeme(api, {
      body_text: 'First line\nSecond line',
      title: 'A text meme',
      source_url: 'https://example.com/post',
      source_name: 'Example',
      source_author: 'Creator',
    });
    expect(result.id).toBe('text-meme');
    expect(requests).toBe(1);
    expect(put).not.toHaveBeenCalled();
  });
  it('rejects blank and oversized text before sending a request', async () => {
    const api = createApi('/api');
    const adapter = vi.fn();
    api.defaults.adapter = adapter;
    for (const body_text of ['   \n', 'a'.repeat(10_001)]) {
      await expect(
        createTextMeme(api, {
          body_text,
          title: '',
          source_url: '',
          source_name: '',
          source_author: '',
        }),
      ).rejects.toThrow('Enter text');
    }
    expect(adapter).not.toHaveBeenCalled();
  });
});
