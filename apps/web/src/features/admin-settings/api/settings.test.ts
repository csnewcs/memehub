import { describe, expect, it } from 'vite-plus/test';
import { createApi } from '../../../shared/api/client';
import { getSettings, saveSettings } from './settings';

describe('admin settings', () => {
  it('loads and saves the revision with the editable values', async () => {
    const api = createApi('/api');
    const settings = {
      openai_model: 'gpt-test',
      deleted_image_retention_days: 7,
      incomplete_upload_retention_hours: 24,
      revision: 2,
    };
    const requests: string[] = [];
    api.defaults.adapter = async (config) => {
      requests.push(config.method!);
      expect(config.url).toBe('admin/settings');
      if (config.method === 'put') expect(JSON.parse(config.data)).toEqual(settings);
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { ...settings, revision: config.method === 'put' ? 3 : 2 },
      };
    };
    expect(await getSettings(api)).toEqual(settings);
    expect(await saveSettings(api, settings)).toEqual({ ...settings, revision: 3 });
    expect(requests).toEqual(['get', 'put']);
  });
});
