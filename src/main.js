import './styles.css';
import cities from './data/cities-top1000.json';

const apex = typeof __SITE_APEX__ !== 'undefined' ? __SITE_APEX__ : 'narkology.ru';

const y = String(new Date().getFullYear());
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = y;

function cityPublicUrl(slug) {
  if (import.meta.env.DEV) {
    const { protocol, port, hostname } = window.location;
    const isLocal =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
    if (isLocal) {
      const p = port ? `:${port}` : '';
      return `${protocol}//${slug}.localhost${p}/`;
    }
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

const listEl = document.getElementById('city-dd-list');
const trigger = document.getElementById('city-dd-trigger');
const panel = document.getElementById('city-dd-panel');
const backdrop = document.getElementById('city-dd-backdrop');
const closeBtn = document.getElementById('city-dd-close');
const searchInput = document.getElementById('city-dd-search');
const currentEl = document.getElementById('city-dd-current');
const statusEl = document.getElementById('city-status');
const headerCityLive = document.getElementById('header-city-label');
const root = document.getElementById('city-dd-root');

function slugToCity(slug) {
  return cities.find(c => c.slug === slug);
}

function announceCity(name) {
  if (headerCityLive) headerCityLive.textContent = name ? `Выбран город: ${name}` : '';
}

function setPanelOpen(open) {
  if (!panel || !trigger) return;
  panel.hidden = !open;
  if (backdrop) {
    backdrop.hidden = !open;
  }
  trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    searchInput?.focus();
  } else if (searchInput) {
    searchInput.value = '';
    applyCityFilter('');
  }
}

function navigateToSlug(slug) {
  const c = slugToCity(slug);
  if (!c) {
    if (statusEl) statusEl.textContent = 'Город не найден.';
    return;
  }
  if (statusEl) statusEl.textContent = '';
  announceCity(c.name);
  window.location.href = cityPublicUrl(slug);
}

function applyCityFilter(q) {
  if (!listEl) return;
  const ql = q.trim().toLowerCase();
  listEl.querySelectorAll('.city-dd__region').forEach(regionEl => {
    let visibleItems = 0;
    regionEl.querySelectorAll('.city-dd__item').forEach(btn => {
      const name = (btn.dataset.name || '').toLowerCase();
      const reg = (btn.dataset.region || '').toLowerCase();
      const show = !ql || name.includes(ql) || reg.includes(ql);
      btn.hidden = !show;
      if (show) visibleItems += 1;
    });
    regionEl.hidden = visibleItems === 0;
  });
}

function buildCityList() {
  if (!listEl || !cities?.length) return;

  const byRegion = new Map();
  for (const c of cities) {
    const r = (c.region && String(c.region).trim()) || 'Другое';
    if (!byRegion.has(r)) byRegion.set(r, []);
    byRegion.get(r).push(c);
  }

  const regions = [...byRegion.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
  const frag = document.createDocumentFragment();

  for (const r of regions) {
    const wrap = document.createElement('div');
    wrap.className = 'city-dd__region';
    const title = document.createElement('div');
    title.className = 'city-dd__region-title';
    title.textContent = r;
    wrap.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'city-dd__region-grid';

    const list = byRegion.get(r).slice();
    list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    for (const c of list) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'city-dd__item';
      btn.textContent = c.name;
      btn.dataset.slug = c.slug;
      btn.dataset.name = c.name;
      btn.dataset.region = c.region || '';
      btn.addEventListener('click', () => navigateToSlug(c.slug));
      grid.appendChild(btn);
    }
    wrap.appendChild(grid);
    frag.appendChild(wrap);
  }

  listEl.appendChild(frag);
}

if (listEl && cities?.length) {
  buildCityList();

  const slugPage = document.body.dataset.citySlug;
  const namePage = document.body.dataset.cityName;
  if (slugPage && currentEl && namePage) {
    currentEl.textContent = namePage;
  }

  trigger?.addEventListener('click', e => {
    e.stopPropagation();
    setPanelOpen(!!panel?.hidden);
  });

  closeBtn?.addEventListener('click', () => setPanelOpen(false));

  backdrop?.addEventListener('click', () => setPanelOpen(false));

  searchInput?.addEventListener('input', () => {
    applyCityFilter(searchInput.value);
  });

  searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      setPanelOpen(false);
      trigger?.focus();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel && !panel.hidden) {
      setPanelOpen(false);
      trigger?.focus();
    }
  });

  document.addEventListener('click', e => {
    if (panel?.hidden) return;
    if (root && !root.contains(e.target)) {
      setPanelOpen(false);
    }
  });
}

if (window.location.hash) {
  const id = window.location.hash.slice(1);
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
