import axios from 'axios';
import { createContext, useContext } from 'react';

export function endpoint(base: string, path: string) {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
export function createApi(base: string) {
  return axios.create({
    baseURL: `${base.replace(/\/+$/, '')}/`,
    withCredentials: true,
    xsrfCookieName: 'memehub_csrf',
    xsrfHeaderName: 'X-CSRF-Token',
    headers: { Accept: 'application/json' },
  });
}
export const ApiContext = createContext<ReturnType<typeof createApi> | null>(null);
export function useApi() {
  const client = useContext(ApiContext);
  if (!client) throw new Error('API provider is missing');
  return client;
}
export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return 'Sign in to continue.';
    if (error.response?.status === 403) return 'Your session could not be verified. Sign in again.';
    const code = error.response?.data?.error;
    if (typeof code === 'string' && /^[a-z_]+$/.test(code)) return code.replaceAll('_', ' ');
    return 'The request failed. Please try again.';
  }
  return error instanceof Error ? error.message : 'The request failed. Please try again.';
}
