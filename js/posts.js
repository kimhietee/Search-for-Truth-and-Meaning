/**
 * posts.js — Posts & Sayings Data Layer
 * EDGAR TEE
 *
 * Owns: fetch helpers against `posts` (+ `categories`, `tags`) and the
 * rendering of post/saying cards as DOM nodes, so any page (home, sayings,
 * single post) can request data and get back ready-to-insert markup built
 * from the same template — no duplicated card HTML across pages.
 *
 * `post_type` distinguishes long-form Articles from short-form Sayings;
 * both live in one `posts` table (see database/DATABASE.md for why).
 *
 * Started in Module 4 (Homepage); extended in Module 5 (Sayings Page) and
 * Module 6 (Single Post Page) with pagination, related posts, etc.
 */

import { supabase } from './supabase.js';
import { escapeHtml, formatDate, renderContentHtml } from './utils.js';

const POST_SELECT = `
  id, slug, post_type, title, subtitle, excerpt, content,
  featured_image_url, status, is_featured, reading_time_minutes,
  view_count, like_count, published_at, category_id,
  categories ( id, name, slug ),
  profiles ( display_name, avatar_url )
`;

/** The single most recent featured saying — powers the homepage hero. */
export async function fetchFeaturedSaying() {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('post_type', 'saying')
    .eq('status', 'published')
    .eq('is_featured', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[posts] fetchFeaturedSaying error:', error.message);
    return null;
  }
  return data;
}

/** Most recent published posts of any type — homepage "Latest Posts". */
export async function fetchLatestPosts(limit = 3) {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[posts] fetchLatestPosts error:', error.message);
    return [];
  }
  return data ?? [];
}

/** Most recent published long-form articles — homepage "Recent Articles". */
export async function fetchRecentArticles(limit = 4) {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('status', 'published')
    .eq('post_type', 'article')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[posts] fetchRecentArticles error:', error.message);
    return [];
  }
  return data ?? [];
}

/** Highest-liked published sayings — homepage/sayings "Popular Sayings". */
export async function fetchPopularSayings(limit = 6) {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('status', 'published')
    .eq('post_type', 'saying')
    .order('like_count', { ascending: false })
    .order('view_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[posts] fetchPopularSayings error:', error.message);
    return [];
  }
  return data ?? [];
}

/** Categories with a live count of published posts in each. */
export async function fetchCategoriesWithCounts() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, posts!posts_category_id_fkey(count)')
    .order('name', { ascending: true });

  if (error) {
    console.error('[posts] fetchCategoriesWithCounts error:', error.message);
    return [];
  }

  // Supabase returns the aggregate as posts: [{ count: N }]
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    count: c.posts?.[0]?.count ?? 0,
  }));
}

const POSTS_SORT_MAP = {
  newest:  { column: 'published_at',  ascending: false },
  popular: { column: 'like_count',    ascending: false },
  viewed:  { column: 'view_count',    ascending: false },
  az:      { column: 'title',         ascending: true },
};

/**
 * Finds published post ids whose *tags* match `q` — used to fold tag
 * matches into the main search alongside title/excerpt/content, since
 * the brief calls for searching by "Title, Category, Tags, Keywords."
 */
async function findPostIdsByTagMatch(q) {
  const term = `%${q.replace(/[%_]/g, '')}%`;
  const { data: matchedTags } = await supabase.from('tags').select('id').ilike('name', term);
  if (!matchedTags?.length) return [];

  const { data: links } = await supabase
    .from('post_tags')
    .select('post_id')
    .in('tag_id', matchedTags.map((t) => t.id));

  return [...new Set((links ?? []).map((l) => l.post_id))];
}

/**
 * Paginated, filterable, sortable, searchable Posts query — the engine
 * behind sayings.html, which doubles as the site's search results page
 * (there's no separate /search route per the brief's fixed nav). Matches
 * on title, excerpt, content, AND tag names (Module 9); category is
 * passed as a slug (resolved to an id first, since Supabase can't filter
 * on a joined column without an inner-join select); `type` filters by
 * post_type ('' = both Articles and Sayings — used for a real site-wide
 * search; 'saying' is the default when just browsing the Sayings page
 * with no active search).
 *
 * Returns { data, count, page, pageSize } — `count` is the total matching
 * rows (ignoring pagination), used to compute total pages.
 */
export async function fetchPostsPage({ q = '', category = '', type = 'saying', sort = 'newest', page = 1, pageSize = 9 } = {}) {
  let categoryId = null;
  if (category) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', category)
      .maybeSingle();
    categoryId = cat?.id ?? null;
    // Category slug didn't match anything real — short-circuit to an empty result
    // rather than silently ignoring the filter and returning unrelated posts.
    if (!categoryId) return { data: [], count: 0, page, pageSize };
  }

  let query = supabase
    .from('posts')
    .select(POST_SELECT, { count: 'exact' })
    .eq('status', 'published');

  if (type) query = query.eq('post_type', type);
  if (categoryId) query = query.eq('category_id', categoryId);

  if (q) {
    const term = `%${q.replace(/[%_]/g, '')}%`;
    const tagMatchIds = await findPostIdsByTagMatch(q);
    const clauses = [`title.ilike.${term}`, `excerpt.ilike.${term}`, `content.ilike.${term}`];
    if (tagMatchIds.length) clauses.push(`id.in.(${tagMatchIds.join(',')})`);
    query = query.or(clauses.join(','));
  }

  const { column, ascending } = POSTS_SORT_MAP[sort] || POSTS_SORT_MAP.newest;
  query = query.order(column, { ascending });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('[posts] fetchPostsPage error:', error.message);
    return { data: [], count: 0, page, pageSize };
  }

  return { data: data ?? [], count: count ?? 0, page, pageSize };
}

/** Plain category list (id, name, slug) — used to populate filter dropdowns. */
export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('name', { ascending: true });

  if (error) {
    console.error('[posts] fetchCategories error:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Fetches one published post by slug — powers post.html.
 * Returns null if no matching published post exists (caller shows a
 * "not found" state rather than treating this as an error).
 */
export async function fetchPostBySlug(slug) {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) {
    console.error('[posts] fetchPostBySlug error:', error.message);
    return null;
  }
  return data;
}

/**
 * Other published posts sharing the same category as `post`, most recent
 * first, excluding `post` itself. Falls back to "recent posts of the same
 * type" if the post has no category.
 */
export async function fetchRelatedPosts(post, limit = 3) {
  if (!post) return [];

  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('status', 'published')
    .eq('post_type', post.post_type)
    .neq('id', post.id)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (post.category_id) query = query.eq('category_id', post.category_id);

  const { data, error } = await query;
  if (error) {
    console.error('[posts] fetchRelatedPosts error:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * The immediately-previous and immediately-next published posts of the
 * same type, ordered by publish date — powers the Previous/Next Post nav.
 * Either value may be null if `post` is the oldest/newest.
 */
export async function fetchAdjacentPosts(post) {
  if (!post?.published_at) return { previous: null, next: null };

  const [{ data: prevData }, { data: nextData }] = await Promise.all([
    supabase
      .from('posts')
      .select('slug, title')
      .eq('status', 'published')
      .eq('post_type', post.post_type)
      .lt('published_at', post.published_at)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('posts')
      .select('slug, title')
      .eq('status', 'published')
      .eq('post_type', post.post_type)
      .gt('published_at', post.published_at)
      .order('published_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return { previous: prevData ?? null, next: nextData ?? null };
}

/** Logs one view for `postId`. Fire-and-forget; failures are non-fatal. */
export async function trackView(postId, visitorId) {
  const { error } = await supabase.from('views').insert({ post_id: postId, visitor_id: visitorId });
  if (error) console.error('[posts] trackView error:', error.message);
}

/* ----------------------------------------------------------------------------
   Rendering helpers — shared card markup
   ---------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
   Rendering helpers — shared card markup
   (escapeHtml, formatDate, renderContentHtml now live in utils.js)
   ---------------------------------------------------------------------------- */
export function renderPostCard(post) {
  const el = document.createElement('article');
  el.className = 'post-card reveal';

  const imageStyle = post.featured_image_url
    ? `style="background-image:url('${escapeHtml(post.featured_image_url)}')"`
    : '';

  el.innerHTML = `
    <a href="post.html?slug=${encodeURIComponent(post.slug)}" class="post-card__image" ${imageStyle} aria-hidden="true"></a>
    <div class="post-card__body">
      <div class="post-card__meta">
        <span class="post-card__category">${escapeHtml(post.categories?.name || 'Uncategorized')}</span>
        <span>&middot;</span>
        <span>${formatDate(post.published_at)}</span>
      </div>
      <h3 class="post-card__title">
        <a href="post.html?slug=${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a>
      </h3>
      <p class="post-card__excerpt">${escapeHtml(post.excerpt || '')}</p>
      <div class="post-card__footer">
        <span>${escapeHtml(post.profiles?.display_name || 'Edgar Tee')}</span>
        <span>${post.reading_time_minutes ? post.reading_time_minutes + ' min read' : ''}</span>
      </div>
    </div>
  `;
  return el;
}

/**
 * Builds a <article class="saying-card"> element (the folded-corner card).
 *
 * Pass { detailed: true } (used on the Sayings page) to include the fuller
 * metadata the brief calls for there — date published, reading time,
 * author, and an explicit "Read More" link — on top of the compact
 * version used in the homepage's Popular Sayings masonry.
 */
export function renderSayingCard(post, { detailed = false } = {}) {
  const el = document.createElement('article');
  el.className = 'saying-card reveal';

  const submeta = detailed ? `
    <div class="saying-card__submeta">
      <span class="post-card__category">${escapeHtml(post.categories?.name || 'Uncategorized')}</span>
      <span>&middot;</span>
      <span>${formatDate(post.published_at)}</span>
      ${post.reading_time_minutes ? `<span>&middot;</span><span>${post.reading_time_minutes} min read</span>` : ''}
    </div>
  ` : '';

  const bottomLeft = detailed
    ? escapeHtml(post.profiles?.display_name || 'Edgar Tee')
    : escapeHtml(post.categories?.name || '');

  const readMore = detailed
    ? `<a class="icon-btn" href="post.html?slug=${encodeURIComponent(post.slug)}">Read More &rarr;</a>`
    : '';

  el.innerHTML = `
    ${submeta}
    <a href="post.html?slug=${encodeURIComponent(post.slug)}" class="saying-card__quote">
      ${escapeHtml(post.title)}
    </a>
    <div class="saying-card__meta">
      <span>${bottomLeft}</span>
      <div class="saying-card__actions">
        <button class="icon-btn like-btn" data-post-id="${post.id}" aria-label="Like this saying">
          &#9825; <span>${post.like_count ?? 0}</span>
        </button>
        <button class="icon-btn share-btn" data-slug="${post.slug}" data-title="${escapeHtml(post.title)}" aria-label="Share this saying">
          &#8599;
        </button>
        ${readMore}
      </div>
    </div>
  `;
  return el;
}

/**
 * renderContentHtml is now imported from utils.js (re-exported below so
 * existing `import { renderContentHtml } from './posts.js'` call sites
 * elsewhere in the app don't need to change).
 */
export { renderContentHtml };

/** Renders `count` shimmering skeleton placeholders into a container. */
export function renderSkeletons(container, count = 3) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'skeleton skeleton-card';
    container.appendChild(el);
  }
}
