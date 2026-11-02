import { endpoint } from '../../../shared/api/client';
export function memeShareURLs(id: string, appBase: string, apiBase: string) {
  const detail = new URL(appBase);
  detail.search = '';
  detail.hash = '';
  detail.searchParams.set('meme', id);
  const media = new URL(endpoint(apiBase, `memes/${encodeURIComponent(id)}/file`), appBase);
  return { detail: detail.href, media: media.href };
}
