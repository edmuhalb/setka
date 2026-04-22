import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '../src/data/cities-top1000.json');
const url = 'https://raw.githubusercontent.com/arbaev/russia-cities/master/russia-cities.json';

function fetchJson(u) {
  return new Promise((resolve, reject) => {
    https
      .get(u, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          fetchJson(res.headers.location).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function main() {
  const all = await fetchJson(url);
  const withPop = all.filter(
    c => c.contentType === 'city' && typeof c.population === 'number'
  );
  withPop.sort((a, b) => b.population - a.population);
  const seen = new Set();
  const top = [];
  for (const c of withPop) {
    const slug = String(c.label || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    top.push({
      name: c.name,
      slug,
      population: c.population,
      region: c.region?.name || '',
      prepositional: c.namecase?.prepositional || c.name
    });
    if (top.length >= 1000) break;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(top));
  console.log(`Записано городов: ${top.length} → ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
