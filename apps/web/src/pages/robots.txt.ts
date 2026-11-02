import type { APIRoute } from 'astro';
import { publicBase } from '../shared/seo/server';
export const GET: APIRoute = ({ url }) =>
  new Response(
    `User-agent: *\nAllow: /\nDisallow: /api/admin/\nDisallow: /api/auth/\nSitemap: ${new URL('/sitemap.xml', publicBase(url)).href}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
