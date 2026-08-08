/**
 * app.js — Site-wide Bootstrap
 * EDGAR TEE
 *
 * Owns: behavior shared across all public pages (sticky nav shrink/scroll,
 * mobile nav toggle, back-to-top button, footer year, scroll-reveal
 * animation, newsletter subscribe) plus homepage-specific data loading.
 * Import this once, at the bottom of each public page's <body>.
 */

import { supabase } from './supabase.js';
import {
  fetchFeaturedSaying,
  fetchLatestPosts,
  fetchRecentArticles,
  fetchPopularSayings,
  fetchCategoriesWithCounts,
  fetchPostBySlug,
  fetchRelatedPosts,
  fetchAdjacentPosts,
  trackView,
  renderPostCard,
  renderSayingCard,
  renderContentHtml,
  renderSkeletons,
} from './posts.js';
import { initSearchPage } from './search.js';
import { onAuthStateChange, getCurrentSession } from './auth.js';
import { formatLongDate } from './utils.js';

/* ----------------------------------------------------------------------------
   Sticky nav: shrink + shadow on scroll
   ---------------------------------------------------------------------------- */
function initStickyNav() {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  const onScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 12);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ----------------------------------------------------------------------------
   Mobile nav toggle
   ---------------------------------------------------------------------------- */
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.site-nav__links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  links.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => links.classList.remove('is-open'))
  );
}

/* ----------------------------------------------------------------------------
   Back-to-top button
   ---------------------------------------------------------------------------- */
function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('is-visible', window.scrollY > 480);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ----------------------------------------------------------------------------
   Scroll-reveal for elements with class="reveal"
   ---------------------------------------------------------------------------- */
function initScrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  items.forEach((el) => observer.observe(el));
}

/* ----------------------------------------------------------------------------
   Nav auth state: swap "Log In" for "Dashboard" when an admin is signed in
   ---------------------------------------------------------------------------- */
async function initNavAuthState() {
  const link = document.querySelector('[data-nav-auth-link]');
  if (!link) return;

  const applyState = (session) => {
    if (session) {
      link.textContent = 'Dashboard';
      link.href = 'dashboard.html';
    } else {
      link.textContent = 'Log In';
      link.href = 'login.html';
    }
  };

  applyState(await getCurrentSession());
  onAuthStateChange(applyState);
}

/* ----------------------------------------------------------------------------
   Footer year
   ---------------------------------------------------------------------------- */
function initFooterYear() {
  const el = document.querySelector('[data-current-year]');
  if (el) el.textContent = new Date().getFullYear();
}

/* ----------------------------------------------------------------------------
   Newsletter subscribe form
   ---------------------------------------------------------------------------- */
function initNewsletterForm() {
  const form = document.querySelector('.newsletter__form');
  if (!form) return;

  const input = form.querySelector('input[type="email"]');
  const note = form.parentElement.querySelector('.newsletter__note');
  const defaultNote = note ? note.textContent : '';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = input.value.trim();
    if (!email) return;

    const submitBtn = form.querySelector('button');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Subscribing…';

    const { error } = await supabase.from('newsletter').insert({ email });

    if (error) {
      // Unique violation just means they're already subscribed — treat as success.
      if (error.code === '23505') {
        if (note) note.textContent = "You're already on the list — thank you!";
      } else {
        if (note) note.textContent = 'Something went wrong. Please try again.';
        console.error('[newsletter] subscribe error:', error.message);
      }
    } else {
      if (note) note.textContent = 'Thank you for subscribing!';
      form.reset();
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Subscribe';
    if (note) setTimeout(() => { note.textContent = defaultNote; }, 5000);
  });
}

/* ----------------------------------------------------------------------------
   Like button (delegated) — used by saying-card templates from posts.js
   ---------------------------------------------------------------------------- */
function getVisitorId() {
  let id = localStorage.getItem('edgar-tee-visitor-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('edgar-tee-visitor-id', id);
  }
  return id;
}

function initLikeButtons() {
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('.like-btn');
    if (!btn) return;

    const postId = btn.dataset.postId;
    const countEl = btn.querySelector('span');
    const visitorId = getVisitorId();

    btn.disabled = true;
    const { error } = await supabase.from('likes').insert({ post_id: postId, visitor_id: visitorId });

    if (!error) {
      btn.classList.add('is-active');
      if (countEl) countEl.textContent = String(Number(countEl.textContent) + 1);
    } else if (error.code === '23505') {
      // Already liked by this visitor — just reflect that in the UI.
      btn.classList.add('is-active');
    } else {
      console.error('[likes] error:', error.message);
    }
    btn.disabled = false;
  });
}

/* ----------------------------------------------------------------------------
   Share button (delegated) — uses the Web Share API with a clipboard fallback
   ---------------------------------------------------------------------------- */
function initShareButtons() {
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('.share-btn');
    if (!btn) return;

    const url = `${window.location.origin}${window.location.pathname.replace(/[^/]+$/, '')}post.html?slug=${btn.dataset.slug}`;
    const title = btn.dataset.title || 'EDGAR TEE';

    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      const original = btn.innerHTML;
      btn.innerHTML = 'Copied!';
      setTimeout(() => { btn.innerHTML = original; }, 1500);
    }
  });
}

/* ----------------------------------------------------------------------------
   Homepage data loading
   ---------------------------------------------------------------------------- */
async function initHomepage() {
  const featuredEl = document.querySelector('[data-featured-saying]');
  const latestEl = document.querySelector('[data-latest-posts]');
  const popularEl = document.querySelector('[data-popular-sayings]');
  const articlesEl = document.querySelector('[data-recent-articles]');
  const categoriesEl = document.querySelector('[data-categories]');

  // Only run on the homepage
  if (!featuredEl && !latestEl && !popularEl && !articlesEl && !categoriesEl) return;

  if (latestEl) renderSkeletons(latestEl, 3);
  if (popularEl) renderSkeletons(popularEl, 6);
  if (articlesEl) renderSkeletons(articlesEl, 4);

  const [featured, latest, popular, articles, categories] = await Promise.all([
    featuredEl ? fetchFeaturedSaying() : null,
    latestEl ? fetchLatestPosts(3) : [],
    popularEl ? fetchPopularSayings(6) : [],
    articlesEl ? fetchRecentArticles(4) : [],
    categoriesEl ? fetchCategoriesWithCounts() : [],
  ]);

  if (featuredEl) {
    if (featured) {
      featuredEl.querySelector('.saying-feature__quote').textContent = featured.title;
      const link = featuredEl.querySelector('[data-featured-saying-link]');
      if (link) link.href = `post.html?slug=${encodeURIComponent(featured.slug)}`;
    } else {
      featuredEl.style.display = 'none';
    }
  }

  if (latestEl) {
    latestEl.innerHTML = '';
    if (latest.length === 0) {
      latestEl.innerHTML = '<p class="lede">No posts published yet — check back soon.</p>';
    } else {
      latest.forEach((post) => latestEl.appendChild(renderPostCard(post)));
    }
  }

  if (popularEl) {
    popularEl.innerHTML = '';
    if (popular.length === 0) {
      popularEl.innerHTML = '<p class="lede">Sayings will appear here once published.</p>';
    } else {
      popular.forEach((post) => popularEl.appendChild(renderSayingCard(post)));
    }
  }

  if (articlesEl) {
    articlesEl.innerHTML = '';
    articles.forEach((post) => articlesEl.appendChild(renderPostCard(post)));
  }

  if (categoriesEl) {
    categoriesEl.innerHTML = '';
    categories.forEach((cat) => {
      const a = document.createElement('a');
      a.className = 'category-pill';
      a.href = `sayings.html?category=${encodeURIComponent(cat.slug)}`;
      a.innerHTML = `${cat.name}<span class="category-pill__count">${cat.count}</span>`;
      categoriesEl.appendChild(a);
    });
  }

  // Newly-injected cards need to be picked up by the reveal observer.
  initScrollReveal();
}

/* ----------------------------------------------------------------------------
   Search / Sayings page — delegated to search.js (Module 9)
   ---------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
   Single Post page
   (formatLongDate now lives in utils.js)
   ---------------------------------------------------------------------------- */

async function initPostPage() {
  const container = document.querySelector('[data-post-container]');
  if (!container) return; // not on post.html

  const notFoundEl = document.querySelector('[data-post-not-found]');
  const slug = new URLSearchParams(window.location.search).get('slug');

  if (!slug) {
    container.style.display = 'none';
    if (notFoundEl) notFoundEl.style.display = 'block';
    return;
  }

  const post = await fetchPostBySlug(slug);

  if (!post) {
    container.style.display = 'none';
    if (notFoundEl) notFoundEl.style.display = 'block';
    return;
  }

  document.title = `${post.title} \u2014 EDGAR TEE`;

  // Header
  const categoryEl = document.querySelector('[data-post-category]');
  const titleEl = document.querySelector('[data-post-title]');
  const subtitleEl = document.querySelector('[data-post-subtitle]');
  const dateEl = document.querySelector('[data-post-date]');
  const authorEl = document.querySelector('[data-post-author]');
  const readingEl = document.querySelector('[data-post-reading-time]');
  const imageEl = document.querySelector('[data-post-image]');
  const contentEl = document.querySelector('[data-post-content]');
  const likeBtn = document.querySelector('[data-post-like-btn]');
  const shareBtn = document.querySelector('[data-post-share-btn]');

  if (categoryEl) categoryEl.textContent = post.categories?.name || 'Uncategorized';
  if (titleEl) titleEl.textContent = post.title;
  if (subtitleEl) {
    if (post.subtitle) { subtitleEl.textContent = post.subtitle; subtitleEl.style.display = ''; }
    else subtitleEl.style.display = 'none';
  }
  if (dateEl) dateEl.textContent = formatLongDate(post.published_at);
  if (authorEl) authorEl.textContent = post.profiles?.display_name || 'Edgar Tee';
  if (readingEl) readingEl.textContent = post.reading_time_minutes ? `${post.reading_time_minutes} min read` : '';

  if (imageEl) {
    if (post.featured_image_url) {
      imageEl.style.backgroundImage = `url('${post.featured_image_url}')`;
      imageEl.style.display = '';
    } else {
      imageEl.style.display = 'none';
    }
  }

  if (contentEl) contentEl.innerHTML = renderContentHtml(post.content);

  if (likeBtn) {
    likeBtn.dataset.postId = post.id;
    likeBtn.classList.add('like-btn'); // pick up the delegated handler from initLikeButtons()
    const countEl = likeBtn.querySelector('span');
    if (countEl) countEl.textContent = String(post.like_count ?? 0);
  }
  if (shareBtn) {
    shareBtn.dataset.slug = post.slug;
    shareBtn.dataset.title = post.title;
    shareBtn.classList.add('share-btn'); // pick up the delegated handler from initShareButtons()
  }

  // Fire-and-forget view tracking — doesn't block rendering
  trackView(post.id, getVisitorId());

  // Related posts + prev/next load in parallel, independent of the above
  const relatedEl = document.querySelector('[data-related-posts]');
  const prevEl = document.querySelector('[data-prev-post]');
  const nextEl = document.querySelector('[data-next-post]');

  const [related, adjacent] = await Promise.all([
    relatedEl ? fetchRelatedPosts(post, 3) : [],
    (prevEl || nextEl) ? fetchAdjacentPosts(post) : { previous: null, next: null },
  ]);

  if (relatedEl) {
    relatedEl.innerHTML = '';
    if (related.length === 0) {
      relatedEl.closest('[data-related-section]')?.style.setProperty('display', 'none');
    } else {
      related.forEach((p) => relatedEl.appendChild(
        p.post_type === 'saying' ? renderSayingCard(p) : renderPostCard(p)
      ));
    }
  }

  if (prevEl) {
    if (adjacent.previous) {
      prevEl.href = `post.html?slug=${encodeURIComponent(adjacent.previous.slug)}`;
      prevEl.querySelector('[data-post-nav-title]').textContent = adjacent.previous.title;
    } else {
      prevEl.closest('.post-nav__item')?.classList.add('is-disabled');
    }
  }
  if (nextEl) {
    if (adjacent.next) {
      nextEl.href = `post.html?slug=${encodeURIComponent(adjacent.next.slug)}`;
      nextEl.querySelector('[data-post-nav-title]').textContent = adjacent.next.title;
    } else {
      nextEl.closest('.post-nav__item')?.classList.add('is-disabled');
    }
  }

  initScrollReveal();
}

/* ----------------------------------------------------------------------------
   Boot
   ---------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  initStickyNav();
  initMobileNav();
  initBackToTop();
  initFooterYear();
  initNewsletterForm();
  initLikeButtons();
  initShareButtons();
  initNavAuthState();
  initScrollReveal();
  initHomepage();
  initSearchPage();
  initPostPage();
});
