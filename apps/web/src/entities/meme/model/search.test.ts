import { describe, expect, it } from 'vite-plus/test';
import { parseMemeSearch, formatTagToken } from './search';

describe('uploader search', () => {
  it('separates an uploader from optional free text', () => {
    expect(parseMemeSearch(' @noeulnight  cat mood ')).toEqual({
      uploader: 'noeulnight',
      tags: [],
      text: 'cat mood',
    });
    expect(parseMemeSearch('@NoeulNight')).toEqual({ uploader: 'NoeulNight', tags: [], text: '' });
    expect(parseMemeSearch('@user@example.com cats')).toEqual({
      uploader: 'user@example.com',
      tags: [],
      text: 'cats',
    });
  });
  it('keeps an incomplete handle and inline mentions as text', () => {
    expect(parseMemeSearch('@')).toEqual({ uploader: '', tags: [], text: '@' });
    expect(parseMemeSearch('hello @user')).toEqual({ uploader: '', tags: [], text: 'hello @user' });
  });
  it('combines an uploader, exact tags, and free text', () => {
    expect(parseMemeSearch('@noeulnight #work #"Exact tag" cat')).toEqual({
      uploader: 'noeulnight',
      tags: ['work', 'Exact tag'],
      text: 'cat',
    });
    expect(parseMemeSearch('#work #work')).toEqual({ uploader: '', tags: ['work'], text: '' });
  });
  it('round-trips tags containing spaces and quotes and keeps incomplete tokens', () => {
    for (const tag of ['Exact tag', 'a "quote"', 'path\\tag'])
      expect(parseMemeSearch(formatTagToken(tag)).tags).toEqual([tag]);
    expect(parseMemeSearch('#"incomplete tag').tags).toEqual([]);
    expect(parseMemeSearch('#').text).toBe('#');
  });
});
