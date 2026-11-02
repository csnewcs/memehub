import { formatTagToken } from '../../../entities/meme';

export function searchCompletion(value: string, caret: number) {
  const before = value.slice(0, caret);
  const match = /(?:^|\s)([@#])([^\s]*)$/u.exec(before);
  if (!match) return null;
  const start = match.index + (match[0].length - match[2].length - 1);
  if (match[1] === '@' && value.slice(0, start).trim()) return null;
  if (match[2].startsWith('"')) return null;
  const tail = value.slice(caret).search(/\s/u);
  return {
    kind: match[1] === '@' ? ('user' as const) : ('tag' as const),
    query: match[2],
    start,
    end: tail < 0 ? value.length : caret + tail,
  };
}

export function applyCompletion(
  value: string,
  token: NonNullable<ReturnType<typeof searchCompletion>>,
  candidate: string,
) {
  const prefix =
    value.slice(0, token.start) +
    (token.kind === 'user' ? `@${candidate}` : formatTagToken(candidate)) +
    ' ';
  return { value: prefix + value.slice(token.end).trimStart(), caret: prefix.length };
}
