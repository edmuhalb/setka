import { rewrite } from '@vercel/functions';

/**
 * Прод: Host вида {slug}.SITE_APEX → отдаём /cities/{slug}/index.html из статики.
 * Без этого Vercel отдаёт только корневой index.html — поддомены «пустые».
 * В панели Vercel задайте SITE_APEX_DOMAIN=narkology.ru (или оставьте дефолт ниже).
 */
const DEFAULT_APEX = 'narkology.ru';

export const config = {
  matcher: ['/', '/index.html']
};

export default function middleware(request) {
  const apex = process.env.SITE_APEX_DOMAIN || DEFAULT_APEX;
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  const escaped = apex.replace(/\./g, '\\.');
  const subMatch = new RegExp(`^([a-z0-9-]+)\\.${escaped}$`, 'i').exec(host);
  if (!subMatch) return;

  const slug = subMatch[1];
  if (slug === 'www') return;

  const url = new URL(request.url);
  const path = url.pathname;
  if (path !== '/' && path !== '/index.html') return;

  return rewrite(new URL(`/cities/${slug}/index.html`, request.url));
}
