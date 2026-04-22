import './styles.css';
import cities from './data/cities-top1000.json';

const apex = typeof __SITE_APEX__ !== 'undefined' ? __SITE_APEX__ : 'example-med.ru';

const y = String(new Date().getFullYear());
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = y;

function cityPublicUrl(slug) {
  if (import.meta.env.DEV) {
    const { protocol, host } = window.location;
    return `${protocol}//${host}/cities/${slug}/`;
  }
  return `https://${slug}.${apex}/`;
}

document.querySelectorAll('.nav__toggle').forEach(toggle => {
  const menuId = toggle.getAttribute('aria-controls');
  const list = menuId ? document.getElementById(menuId) : null;
  if (!list) return;

  const setOpen = open => {
    list.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  toggle.addEventListener('click', () => {
    setOpen(!list.classList.contains('is-open'));
  });

  list.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setOpen(false));
  });
});

const searchInput = document.getElementById('city-search');
const datalist = document.getElementById('city-list');
const openBtn = document.getElementById('city-open');
const statusEl = document.getElementById('city-status');

if (datalist && cities?.length) {
  const frag = document.createDocumentFragment();
  for (const c of cities) {
    const opt = document.createElement('option');
    opt.value = `${c.name} · ${c.region}`;
    opt.setAttribute('data-slug', c.slug);
    frag.appendChild(opt);
  }
  datalist.appendChild(frag);
}

const slugByLabel = new Map(
  cities.map(c => [`${c.name} · ${c.region}`.toLowerCase(), c.slug])
);

function resolveSlugFromInput() {
  const raw = String(searchInput?.value || '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (slugByLabel.has(key)) return slugByLabel.get(key);
  const found = cities.find(
    c => c.name.toLowerCase() === key || `${c.name} · ${c.region}`.toLowerCase() === key
  );
  return found ? found.slug : null;
}

function goToCity() {
  const slug = resolveSlugFromInput();
  if (!slug) {
    if (statusEl) statusEl.textContent = 'Выберите город из подсказки или введите точное название.';
    return;
  }
  if (statusEl) statusEl.textContent = '';
  window.location.href = cityPublicUrl(slug);
}

if (openBtn) openBtn.addEventListener('click', goToCity);

if (searchInput) {
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      goToCity();
    }
  });

  const topbarCity = document.getElementById('topbar-city-label');
  if (topbarCity) {
    const syncTopbar = () => {
      const slug = resolveSlugFromInput();
      if (!slug) {
        topbarCity.textContent = 'Россия';
        return;
      }
      const c = cities.find(x => x.slug === slug);
      topbarCity.textContent = c ? c.name : 'Россия';
    };
    searchInput.addEventListener('change', syncTopbar);
    searchInput.addEventListener('blur', syncTopbar);
  }
}

if (window.location.hash) {
  const id = window.location.hash.slice(1);
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
