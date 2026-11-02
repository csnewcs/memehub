import type { APIRoute } from 'astro';
import { internalAPI } from '../shared/seo/server';
export const GET: APIRoute = async () => {
  try {
    const response = await fetch(internalAPI('sitemap.xml'), { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('sitemap unavailable');
    return new Response(await response.text(), {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response('Sitemap temporarily unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
};
