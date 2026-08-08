/**
 * search.js — Search & Filtering
 * EDGAR TEE
 *
 * Owns: the search experience wired to the search bars on the homepage
 * and Sayings page, powering sayings.html — which doubles as the site's
 * search results page (there's no separate /search route in the fixed
 * nav: Home / Sayings / About / Log In).
 *
 * Two entry points, one page:
 *   - Nav "Sayings" link  → sayings.html            (no ?q, browses Sayings only)
 *   - Any search bar      → sayings.html?q=term      (searches Articles + Sayings)
 * The Type filter lets a visitor widen or narrow that at any time.
 *
 * Matches on title, excerpt, content, AND tag names — the brief calls
 * for search by "Title, Category, Tags, Keywords," and fetchPostsPage()
 * in posts.js already folds tag matches into the query.
 */

import { fetchPostsPage, fetchCategoriesWithCounts, renderPostCard, renderSayingCard, renderSkeletons } from './posts.js';

function renderPagination(container, currentPage, totalPages, onChange) {
  if (!container) return;
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'btn btn--ghost btn--sm';
  prev.textContent = '\u2190 Prev';
  prev.disabled = currentPage <= 1;
  prev.addEventListener('click', () => onChange(currentPage - 1));

  const label = document.createElement('span');
  label.className = 'pagination__label';
  label.textContent = `Page ${currentPage} of ${totalPages}`;

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'btn btn--ghost btn--sm';
  next.textContent = 'Next \u2192';
  next.disabled = currentPage >= totalPages;
  next.addEventListener('click', () => onChange(currentPage + 1));

  container.append(prev, label, next);
}

/** Renders each result with the card template matching its own post_type. */
function renderResultCard(post) {
  return post.post_type === 'article' ? renderPostCard(post) : renderSayingCard(post, { detailed: true });
}

/**
 * Lightweight reveal-in for search results. Kept local (rather than
 * importing app.js's IntersectionObserver-based initScrollReveal) to
 * avoid a circular import between app.js and search.js — results are
 * typically already in view when they render, so a straight fade is a
 * fine substitute for scroll-triggered reveal here.
 */
function revealResults(container) {
  requestAnimationFrame(() => {
    container.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
  });
}

export async function initSearchPage() {
  const grid = document.querySelector('[data-sayings-grid]');
  if (!grid) return; // not on the search / sayings page

  const searchInput = document.querySelector('[data-sayings-search]');
  const categorySelect = document.querySelector('[data-sayings-category]');
  const typeSelect = document.querySelector('[data-sayings-type]');
  const sortSelect = document.querySelector('[data-sayings-sort]');
  const paginationEl = document.querySelector('[data-sayings-pagination]');
  const countEl = document.querySelector('[data-sayings-count]');
  const headingEl = document.querySelector('[data-sayings-heading]');

  const urlParams = new URLSearchParams(window.location.search);
  const hasQuery = urlParams.has('q');

  const state = {
    q: urlParams.get('q') || '',
    category: urlParams.get('category') || '',
    // Arriving via a search (any q) widens to the whole site by default;
    // arriving via the plain "Sayings" nav link keeps its original scope.
    type: urlParams.get('type') ?? (hasQuery ? '' : 'saying'),
    sort: urlParams.get('sort') || 'newest',
    page: parseInt(urlParams.get('page') || '1', 10) || 1,
  };

  if (categorySelect) {
    const categories = await fetchCategoriesWithCounts();
    categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.slug;
      opt.textContent = `${cat.name} (${cat.count})`;
      if (cat.slug === state.category) opt.selected = true;
      categorySelect.appendChild(opt);
    });
  }

  if (searchInput) searchInput.value = state.q;
  if (sortSelect) sortSelect.value = state.sort;
  if (typeSelect) typeSelect.value = state.type;

  function updateHeading() {
    if (!headingEl) return;
    headingEl.textContent = state.q ? `Search Results` : 'Sayings';
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category) p.set('category', state.category);
    if (state.type !== (state.q ? '' : 'saying')) p.set('type', state.type);
    if (state.sort !== 'newest') p.set('sort', state.sort);
    if (state.page > 1) p.set('page', String(state.page));
    const qs = p.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }

  async function load() {
    updateHeading();
    renderSkeletons(grid, state.pageSize || 9);
    const result = await fetchPostsPage(state);
    state.pageSize = result.pageSize;

    grid.innerHTML = '';
    if (result.data.length === 0) {
      grid.innerHTML = `<p class="lede">No results yet — try a different term, category, or type.</p>`;
    } else {
      result.data.forEach((post) => grid.appendChild(renderResultCard(post)));
    }

    if (countEl) {
      const noun = state.type === 'article' ? 'article' : state.type === 'saying' ? 'saying' : 'result';
      countEl.textContent = `${result.count} ${noun}${result.count === 1 ? '' : 's'} found`;
    }

    const totalPages = Math.max(1, Math.ceil(result.count / result.pageSize));
    renderPagination(paginationEl, state.page, totalPages, (newPage) => {
      state.page = newPage;
      syncUrl();
      load();
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    revealResults(grid);
  }

  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const wasEmpty = !state.q;
        state.q = searchInput.value.trim();
        // Widen to "All" the moment someone starts actually searching from
        // a page that was scoped to Sayings only, so a homepage-style
        // search always covers the whole site.
        if (wasEmpty && state.q && !typeSelect?.dataset.userSet) {
          state.type = '';
          if (typeSelect) typeSelect.value = '';
        }
        state.page = 1;
        syncUrl();
        load();
      }, 350);
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      state.category = categorySelect.value;
      state.page = 1;
      syncUrl();
      load();
    });
  }

  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      typeSelect.dataset.userSet = 'true';
      state.type = typeSelect.value;
      state.page = 1;
      syncUrl();
      load();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      state.page = 1;
      syncUrl();
      load();
    });
  }

  load();
}
