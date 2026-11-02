import { describe, expect, it } from 'vite-plus/test';
import { AxiosError } from 'axios';
import { createApi } from '../../../shared/api/client';
import { listMemes, getMedia } from './queries';

describe('meme queries', () => {
  it('sends filters, cursor and cancellation through Axios', async () => {
    const api = createApi('/api/');
    const signal = new AbortController().signal;
    api.defaults.adapter = async (config) => {
      expect(api.getUri(config)).toContain('q=100%25+%26+monday');
      expect(config.params.content_type).toBe('text');
      expect(config.params.cursor).toBe('cursor+/=');
      expect(config.signal).toBe(signal);
      expect(config.xsrfCookieName).toBe('memehub_csrf');
      expect(config.withCredentials).toBe(true);
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { items: [], next_cursor: null },
      };
    };
    expect(await listMemes(api, '  100% & monday  ', 'text', 'cursor+/=', signal)).toEqual({
      items: [],
      next_cursor: null,
    });
  });
  it('passes an exact tag filter separately from free text', async () => {
    const api = createApi('/api');
    api.defaults.adapter = async (config) => {
      expect(config.params.tag).toEqual(['Work & life']);
      expect(config.params.q).toBeUndefined();
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { items: [], next_cursor: null },
      };
    };
    await listMemes(api, '', '', null, undefined, 'Work & life');
  });
  it('sends uploader and own-library filters independently from text', async () => {
    const api = createApi('/api');
    api.defaults.adapter = async (config) => {
      expect(config.params.uploader).toBe('NoeulNight');
      expect(config.params.q).toBe('cat');
      expect(config.params.mine).toBe(true);
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { items: [], next_cursor: null },
      };
    };
    await listMemes(api, '@NoeulNight cat', '', null, undefined, '', true);
  });
  it('serializes typed and selected tags as repeated exact filters', async () => {
    const api = createApi('/api');
    api.defaults.adapter = async (config) => {
      expect(config.params.tag).toEqual(['selected', 'work', 'Exact tag']);
      expect(api.getUri(config)).toContain('tag=selected&tag=work&tag=Exact+tag');
      expect(config.params.q).toBe('cat');
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { items: [], next_cursor: null },
      };
    };
    await listMemes(api, '#work #"Exact tag" cat', '', null, undefined, 'selected');
  });
  it('propagates failures and rejects malformed pages', async () => {
    const api = createApi('/api');
    api.defaults.adapter = async () => {
      throw new AxiosError('unavailable');
    };
    await expect(listMemes(api, '', '', null)).rejects.toThrow('unavailable');
    api.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { items: [] },
    });
    await expect(listMemes(api, '', '', null)).rejects.toThrow('unexpected response');
  });
  it('rejects unsafe or missing media URLs', async () => {
    const api = createApi('/api');
    api.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { original: { url: 'javascript:alert(1)', expires_at: new Date().toISOString() } },
    });
    await expect(getMedia(api, 'image')).rejects.toThrow('Invalid image URL');
  });
});
