/**
 * Поддомены городов (SEO): DNS wildcard *.ВАШ-ДОМЕН → тот же сервер, что и apex.
 * Nginx (пример):
 *
 *   map $host $city_slug {
 *     default "";
 *     ~^(?<s>[a-z0-9-]+)\.narkology\.ru$ $s;
 *   }
 *   server {
 *     server_name example.ru *.example.ru;
 *     root /var/www/medhelp/dist;
 *     location / {
 *       if ($city_slug != "") { rewrite ^ /cities/$city_slug/index.html last; }
 *       try_files $uri $uri/ /index.html;
 *     }
 *   }
 *
 * Для сборки с другим доменом: SITE_APEX_DOMAIN=example.ru npm run build
 */
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const apex = process.env.SITE_APEX_DOMAIN || 'narkology.ru';
const mainCanonical = `https://${apex}/`;

function loadCities() {
  const p = resolve(root, 'src/data/cities-top1000.json');
  return JSON.parse(readFileSync(p, 'utf8'));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function extractFromBuiltIndex(html) {
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const headInner = headMatch ? headMatch[1] : '';
  const bodyInner = bodyMatch ? bodyMatch[1] : '';
  const headAssets = [];
  for (const m of headInner.matchAll(/<link[^>]*>/gi)) {
    const tag = m[0];
    if (/rel\s*=\s*["']canonical["']/i.test(tag)) continue;
    headAssets.push(tag);
  }
  const moduleScripts = [];
  for (const chunk of [headInner, bodyInner]) {
    for (const m of chunk.matchAll(/<script[^>]*type="module"[^>]*><\/script>/gi)) {
      moduleScripts.push(m[0]);
    }
    for (const m of chunk.matchAll(/<script[^>]*type="module"[^>]*\/>/gi)) {
      moduleScripts.push(m[0]);
    }
  }
  return {
    headAssets: [...new Set(headAssets)].join('\n    '),
    bodyScripts: [...new Set(moduleScripts)].join('\n')
  };
}

function cityPlugin(cities) {
  const templatePath = resolve(root, 'city-template.html');
  const rootUrl = mainCanonical;

  return {
    name: 'generate-city-pages',
    closeBundle() {
      const outDir = resolve(root, 'dist');
      const indexPath = resolve(outDir, 'index.html');
      if (!existsSync(indexPath)) return;

      const builtIndex = readFileSync(indexPath, 'utf8');
      const { headAssets, bodyScripts } = extractFromBuiltIndex(builtIndex);
      const template = readFileSync(templatePath, 'utf8');

      const sitemapUrls = [`${mainCanonical}`];
      const lastmod = new Date().toISOString().slice(0, 10);

      for (const city of cities) {
        const cityPrep = `в ${city.prepositional}`;
        const cityName = escapeHtml(city.name);
        const region = escapeHtml(city.region);
        const title = `Наркология для всех ${cityPrep} — выездной нарколог, цены как по рынку`;
        const description = `Выезд нарколога ${cityPrep}: вывод из запоя, капельницы, снятие ломки, срочный вызов. Средние цены по рынку РФ — уточняйте +7 999 831-22-32.`;
        const canonical = `https://${city.slug}.${apex}/`;

        const jsonLd = JSON.stringify(
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: title,
            description,
            url: canonical,
            inLanguage: 'ru-RU',
            isPartOf: { '@type': 'WebSite', name: 'Наркология для всех', url: mainCanonical }
          },
          null,
          0
        );

        const html = template
          .replaceAll('__TITLE__', escapeHtml(title))
          .replaceAll('__DESCRIPTION__', escapeHtml(description))
          .replaceAll('__CANONICAL__', escapeHtml(canonical))
          .replaceAll('__HEAD_ASSETS__', headAssets)
          .replaceAll('__BODY_SCRIPTS__', bodyScripts)
          .replaceAll('__ROOT_URL__', rootUrl)
          .replaceAll('__CITY_NAME__', cityName)
          .replaceAll('__CITY_SLUG__', city.slug)
          .replaceAll('__CITY_PREP__', escapeHtml(cityPrep))
          .replaceAll('__REGION__', region)
          .replaceAll('__JSONLD__', jsonLd);

        const dir = resolve(outDir, 'cities', city.slug);
        mkdirSync(dir, { recursive: true });
        writeFileSync(resolve(dir, 'index.html'), html, 'utf8');
        sitemapUrls.push(canonical);
      }

      const sitemapBody = sitemapUrls
        .map(
          u => `  <url>
    <loc>${u}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u === mainCanonical ? '1.0' : '0.7'}</priority>
  </url>`
        )
        .join('\n');

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapBody}
</urlset>
`;
      writeFileSync(resolve(outDir, 'sitemap.xml'), sitemap, 'utf8');

      const robots = `User-agent: *
Allow: /

Sitemap: ${mainCanonical}sitemap.xml
`;
      writeFileSync(resolve(outDir, 'robots.txt'), robots, 'utf8');
    }
  };
}

/**
 * В dev HTML городов ссылается на /assets/* из последнего build — на vite dev этих файлов нет, страница без стилей.
 * Заменяем на вход Vite (как в корневом index.html).
 */
function patchCityHtmlForViteDev(html) {
  let h = html.replace(/<link rel="stylesheet"[^>]*href="\/assets\/[^"]+"[^>]*\s*\/?>/gi, '');
  h = h.replace(/<script type="module"[^>]*src="\/assets\/[^"]+"[^>]*><\/script>/gi, '');
  if (h.includes('src="/src/main.js"')) return h;
  return h.replace(
    '</body>',
    '    <script type="module" src="/@vite/client"></script>\n    <script type="module" src="/src/main.js"></script>\n  </body>'
  );
}

/** Локально: http://moscow.localhost:5173/ → отдаёт dist/cities/moscow/index.html (нужен предварительный build). */
function subdomainLocalhostPlugin() {
  const distCities = resolve(root, 'dist/cities');

  return {
    name: 'subdomain-localhost',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const host = req.headers.host?.split(':')[0] ?? '';
        const m = /^([a-z0-9-]+)\.localhost$/i.exec(host);
        if (!m) return next();
        const pathOnly = (req.url ?? '/').split('?')[0];
        if (pathOnly !== '/' && pathOnly !== '') return next();
        const file = resolve(distCities, m[1], 'index.html');
        if (!existsSync(file)) return next();
        let html = readFileSync(file, 'utf8');
        if (server.config.mode === 'development') {
          html = patchCityHtmlForViteDev(html);
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const host = req.headers.host?.split(':')[0] ?? '';
        const m = /^([a-z0-9-]+)\.localhost$/i.exec(host);
        if (!m) return next();
        const pathOnly = (req.url ?? '/').split('?')[0];
        if (pathOnly !== '/' && pathOnly !== '') return next();
        req.url = `/cities/${m[1]}/index.html`;
        next();
      });
    }
  };
}

export default defineConfig({
  root,
  publicDir: 'public',
  define: {
    __SITE_APEX__: JSON.stringify(apex)
  },
  build: {
    rollupOptions: {
      input: resolve(root, 'index.html')
    }
  },
  plugins: [
    subdomainLocalhostPlugin(),
    {
      name: 'main-canonical',
      transformIndexHtml(html) {
        return html.replace(/href="__MAIN_CANONICAL__"/g, `href="${mainCanonical}"`);
      }
    },
    cityPlugin(loadCities())
  ]
});
