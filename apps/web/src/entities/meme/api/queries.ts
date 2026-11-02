import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import { useApi } from '../../../shared/api/client';
import { parseMemeSearch } from '../model/search';
import type { ContentFilter, MemePage } from '../model/types';

export async function listMemes(
  api: AxiosInstance,
  query: string,
  filter: ContentFilter,
  cursor: string | null,
  signal?: AbortSignal,
  tag = '',
  mine = false,
): Promise<MemePage> {
  const search = parseMemeSearch(query);
  const { data } = await api.get<MemePage>('memes', {
    signal,
    paramsSerializer: { indexes: null },
    params: {
      limit: 24,
      tag: [...new Set([tag, ...search.tags].filter(Boolean))],
      q: search.text || undefined,
      uploader: search.uploader || undefined,
      mine: mine || undefined,
      content_type: filter || undefined,
      cursor: cursor || undefined,
    },
  });
  if (
    !Array.isArray(data?.items) ||
    !(data.next_cursor === null || typeof data.next_cursor === 'string')
  )
    throw new Error('The library returned an unexpected response.');
  return data;
}
export function useMemeList(
  query: string,
  filter: ContentFilter,
  tag = '',
  mine = false,
  userId = '',
) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ['memes', query, filter, tag, mine, mine ? userId : ''],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listMemes(api, query, filter, pageParam, signal, tag, mine),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
}
export type Media = {
  original: { url: string; expires_at: string };
  thumbnail: { url: string; expires_at: string };
};
export async function getMedia(
  api: AxiosInstance,
  id: string,
  signal?: AbortSignal,
): Promise<Media> {
  const { data } = await api.get<Media>(`memes/${encodeURIComponent(id)}/media`, { signal });
  for (const item of [data?.original, data?.thumbnail]) {
    if (
      !item ||
      !['http:', 'https:'].includes(new URL(item.url).protocol) ||
      !Number.isFinite(Date.parse(item.expires_at))
    )
      throw new Error('Invalid image URL');
  }
  return data;
}
export function useMemeMedia(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['meme-media', id],
    queryFn: ({ signal }) => getMedia(api, id, signal),
    staleTime: 0,
    refetchInterval: (query) => {
      const expires = query.state.data?.thumbnail.expires_at;
      return expires ? Math.max(1_000, Date.parse(expires) - Date.now() - 30_000) : false;
    },
  });
}
