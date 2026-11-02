import type { Meme } from './types';
import { memeShareURLs } from './share';
export const siteTitle = 'Memehub — The internet, collected.';
export const siteDescription =
  'A home for image and text memes. Search the collection and find your next perfect reaction.';
function concise(value: string, length: number) {
  const text = value.replace(/\s+/gu, ' ').trim();
  return Array.from(text).length > length
    ? Array.from(text)
        .slice(0, length - 1)
        .join('') + '…'
    : text;
}
export function metadata(appBase: string, apiBase: string, meme?: Meme) {
  const home = new URL(appBase);
  home.search = '';
  home.hash = '';
  const urls = meme ? memeShareURLs(meme.id, home.href, apiBase) : null;
  return {
    title: meme
      ? `${concise(meme.title || meme.body_text || (meme.content_type === 'image' ? 'Image meme' : 'Text meme'), 80)} | Memehub`
      : siteTitle,
    description: meme
      ? concise(
          meme.description ||
            meme.body_text ||
            meme.extracted_text ||
            meme.tags.join(', ') ||
            siteDescription,
          160,
        )
      : siteDescription,
    canonical: urls?.detail || home.href,
    image: meme?.content_type === 'image' ? urls!.media : new URL('/og.png', home).href,
    twitterCard:
      meme?.content_type === 'image' &&
      (!meme.width || !meme.height || meme.width < 300 || meme.height < 157)
        ? 'summary'
        : 'summary_large_image',
    imageAlt: meme ? meme.title || meme.description || 'Saved meme' : 'Memehub',
    imageWidth: meme?.content_type === 'image' ? meme.width : 1200,
    imageHeight: meme?.content_type === 'image' ? meme.height : 630,
  };
}
