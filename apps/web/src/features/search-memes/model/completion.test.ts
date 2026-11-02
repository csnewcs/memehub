import { describe, expect, it } from 'vite-plus/test';
import { searchCompletion, applyCompletion } from './completion';

describe('search completion', () => {
  it('detects only an active token at the caret', () => {
    expect(searchCompletion('@no', 3)).toEqual({ kind: 'user', query: 'no', start: 0, end: 3 });
    expect(searchCompletion('cat #wo', 7)).toEqual({ kind: 'tag', query: 'wo', start: 4, end: 7 });
    expect(searchCompletion('cat @no', 7)).toBeNull();
    expect(searchCompletion('cat ', 4)).toBeNull();
    expect(searchCompletion('#"Exact tag" ', 13)).toBeNull();
  });
  it('replaces the active token and preserves surrounding text', () => {
    const input = '@no cat';
    const result = applyCompletion(input, searchCompletion(input, 3)!, 'noeulnight');
    expect(result).toEqual({ value: '@noeulnight cat', caret: 12 });
    const tag = 'cat #work dog';
    expect(applyCompletion(tag, searchCompletion(tag, 7)!, 'Exact tag')).toEqual({
      value: 'cat #Exacttag dog',
      caret: 14,
    });
  });
});
