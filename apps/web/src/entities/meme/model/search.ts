export function formatTagToken(tag: string) {
  return `#${/[\s"\\]/u.test(tag) ? JSON.stringify(tag) : tag}`;
}

export function parseMemeSearch(value: string) {
  const trimmed = value.trim();
  const match = /^@(\S+)(?:\s+|$)/u.exec(trimmed);
  const uploader = match?.[1] || '';
  const body = match ? trimmed.slice(match[0].length) : trimmed;
  const tags: string[] = [];
  const text = body
    .replace(/(^|\s)#("(?:\\.|[^"\\])*"|\S+)/gu, (whole, space: string, token: string) => {
      let tag = token;
      if (token.startsWith('"')) {
        try {
          tag = JSON.parse(token);
        } catch {
          return whole;
        }
      }
      if (!tag) return whole;
      tags.push(tag);
      return space;
    })
    .trim();
  return { uploader, tags: [...new Set(tags)], text };
}
