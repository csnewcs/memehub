import type { AxiosInstance } from 'axios';
export type Tag = { id: string; name: string; meme_count: number };
export type TagPage = { items: Tag[]; next_cursor: string | null };
export async function listTags(
  api: AxiosInstance,
  query: string,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<TagPage> {
  return (
    await api.get<TagPage>('tags', {
      signal,
      params: { q: query || undefined, limit: 50, cursor: cursor || undefined },
    })
  ).data;
}
