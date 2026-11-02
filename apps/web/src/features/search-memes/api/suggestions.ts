import type { AxiosInstance } from 'axios';
export type Suggestion = { value: string; label: string };
export async function getSuggestions(
  api: AxiosInstance,
  kind: 'user' | 'tag',
  query: string,
  signal?: AbortSignal,
): Promise<Suggestion[]> {
  const { data } = await api.get<{ items: Suggestion[] }>('search/suggestions', {
    params: { kind, q: query },
    signal,
  });
  if (
    !Array.isArray(data?.items) ||
    data.items.some((item) => typeof item.value !== 'string' || typeof item.label !== 'string')
  )
    throw new Error('Invalid search suggestions.');
  return data.items;
}
