import { describe, expect, it } from 'vite-plus/test';
import { createApi } from '../../../shared/api/client';
import { listTags } from './tags';
describe('tag browsing', () => {
  it('sends search and pagination without changing spaces in tag names', async () => {
    const api = createApi('/api');
    const page = {
      items: [{ id: 'tag-id', name: '감정 표현', meme_count: 12 }],
      next_cursor: 'next-page',
    };
    api.defaults.adapter = async (config) => {
      expect(config.url).toBe('tags');
      expect(config.params).toEqual({ q: '감정 표현', limit: 50, cursor: 'previous-page' });
      return { config, status: 200, statusText: 'OK', headers: {}, data: page };
    };
    expect(await listTags(api, '감정 표현', 'previous-page')).toEqual(page);
  });
});
