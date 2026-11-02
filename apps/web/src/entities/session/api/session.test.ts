import { describe, expect, it } from 'vite-plus/test';
import { AxiosError } from 'axios';
import { createApi } from '../../../shared/api/client';
import { getSession, logoutSession } from './session';

describe('upload session check', () => {
  it('returns the authenticated session', async () => {
    const api = createApi('/api');
    api.defaults.adapter = async (config) => {
      expect(config.url).toBe('auth/me');
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { id: 'member', display_name: 'Member' },
      };
    };
    expect(await getSession(api)).toEqual({ id: 'member', display_name: 'Member' });
  });
  it('treats only 401 as signed out and preserves service failures', async () => {
    const api = createApi('/api');
    for (const status of [401, 403, 500]) {
      api.defaults.adapter = async (config) => {
        throw new AxiosError('Request failed', undefined, config, undefined, {
          config,
          status,
          statusText: 'Error',
          headers: {},
          data: {},
        });
      };
      if (status === 401) expect(await getSession(api)).toBeNull();
      else await expect(getSession(api)).rejects.toThrow('Request failed');
    }
  });
  it('logs out with the session and CSRF-enabled client', async () => {
    const api = createApi('/api');
    api.defaults.adapter = async (config) => {
      expect(config.url).toBe('auth/logout');
      expect(config.method).toBe('post');
      expect(config.withCredentials).toBe(true);
      expect(config.xsrfCookieName).toBe('memehub_csrf');
      expect(config.xsrfHeaderName).toBe('X-CSRF-Token');
      return { config, status: 204, statusText: 'No Content', headers: {}, data: '' };
    };
    await expect(logoutSession(api)).resolves.toBeUndefined();
  });
  it('accepts an expired session on logout but preserves server failures', async () => {
    const api = createApi('/api');
    for (const status of [401, 403, 500]) {
      api.defaults.adapter = async (config) => {
        throw new AxiosError('Request failed', undefined, config, undefined, {
          config,
          status,
          statusText: 'Error',
          headers: {},
          data: {},
        });
      };
      if (status === 401) await expect(logoutSession(api)).resolves.toBeUndefined();
      else await expect(logoutSession(api)).rejects.toThrow('Request failed');
    }
  });
});
