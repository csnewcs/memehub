import { describe, expect, it } from 'vite-plus/test';
import type { Meme } from './types';
import { metadata, siteTitle } from './metadata';
const meme = {
  id: '123',
  title: '고양이 & 친구',
  description: '  첫 줄\n둘째 줄  ',
  content_type: 'image',
  width: 200,
  height: 300,
  tags: [],
} as unknown as Meme;
describe('SEO metadata', () => {
  it('uses canonical absolute URLs for the homepage and default image', () => {
    const value = metadata('https://memes.example/?q=cat#top', '/api');
    expect(value.title).toBe(siteTitle);
    expect(value.canonical).toBe('https://memes.example/');
    expect(value.image).toBe('https://memes.example/og.png');
    expect(value.twitterCard).toBe('summary_large_image');
  });
  it('uses the selected meme metadata and stable original image URL', () => {
    const value = metadata('https://memes.example', 'https://api.example/api', meme);
    expect(value.title).toBe('고양이 & 친구 | Memehub');
    expect(value.description).toBe('첫 줄 둘째 줄');
    expect(value.canonical).toBe('https://memes.example/?meme=123');
    expect(value.image).toBe('https://api.example/api/memes/123/file');
    expect(value.imageWidth).toBe(200);
    expect(value.twitterCard).toBe('summary');
  });
  it('uses the default image for text memes and truncates long descriptions', () => {
    const value = metadata('https://memes.example', '/api', {
      ...meme,
      title: '',
      content_type: 'text',
      body_text: 'Text meme',
      description: '가'.repeat(200),
    });
    expect(value.title).toBe('Text meme | Memehub');
    expect(value.image).toBe('https://memes.example/og.png');
    expect(value.twitterCard).toBe('summary_large_image');
    expect(Array.from(value.description)).toHaveLength(160);
  });
});
