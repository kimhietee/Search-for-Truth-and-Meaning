/**
 * dashboard.js — Admin Dashboard Logic
 * EDGAR TEE
 *
 * Owns: dashboard.html behavior — the admin route guard, statistics
 * (total posts, categories, views), recent posts, draft posts, quick
 * actions, the full Manage Posts table (search/filter/publish/pin/
 * delete), and the Category/Tag manager panels.
 *
 * Every post-content field itself (title, body, editing) belongs to
 * editor.js / editor.html (Module 8) — this file manages posts as a
 * collection, not their content.
 */

import { supabase } from './supabase.js';
import { requireAdmin, getCurrentProfile, signOut } from './auth.js';
import { escapeHtml, slugify, formatDate, initials } from './utils.js';

/* ----------------------------------------------------------------------------
   (escapeHtml, slugify, formatDate, initials now live in utils.js)
   ---------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
   Header: greet the signed-in admin, wire sign-out
   ---------------------------------------------------------------------------- */
async function initHeader() {
  const profile = await getCurrentProfile();
  const nameEl = document.querySelector('[data-admin-name]');
  const avatarEl = document.querySelector('[data-admin-avatar]');
  if (nameEl) nameEl.textContent = profile?.display_name || 'Admin';
  if (avatarEl) avatarEl.textContent = initials(profile?.display_name);

  document.querySelector('[data-logout-btn]')?.addEventListener('click', () => signOut('login.html'));
}

/* ----------------------------------------------------------------------------
   Stat cards
   ---------------------------------------------------------------------------- */
async function loadStats() {
  const [{ count: postCount }, { count: categoryCount }, { data: viewRows }] = await Promise.all([
    supabase.from('posts').select('id', { count: 'exact', head: true }),
    supabase.from('categories').select('id', { count: 'exact', head: true }),
    supabase.from('posts').select('view_count'),
  ]);

  const totalViews = (viewRows ?? []).reduce((sum, r) => sum + (r.view_count || 0), 0);

  const setStat = (key, value) => {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = value;
  };
  setStat('posts', postCount ?? 0);
  setStat('categories', categoryCount ?? 0);
  setStat('views', totalViews.toLocaleString());
}

/* ----------------------------------------------------------------------------
   Recent Posts / Draft Posts mini-lists
   ---------------------------------------------------------------------------- */
function renderMiniList(container, posts, emptyMessage) {
  container.innerHTML = '';
  if (posts.length === 0) {
    container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }
  posts.forEach((post) => {
    const row = document.createElement('div');
    row.className = 'mini-list__row';
    row.innerHTML = `
      <a class="mini-list__title" href="editor.html?id=${post.id}">${escapeHtml(post.title)}</a>
      <span class="mini-list__meta">
        <span class="badge badge--${post.status}">${post.status}</span>
        <span>${formatDate(post.updated_at)}</span>
      </span>
    `;
    container.appendChild(row);
  });
}

async function loadRecentAndDrafts() {
  const recentEl = document.querySelector('[data-recent-posts]');
  const draftEl = document.querySelector('[data-draft-posts]');

  const [{ data: recent }, { data: drafts }] = await Promise.all([
    supabase.from('posts').select('id, title, status, updated_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('posts').select('id, title, status, updated_at').eq('status', 'draft').order('updated_at', { ascending: false }).limit(5),
  ]);

  if (recentEl) renderMiniList(recentEl, recent ?? [], 'No posts yet — write your first one!');
  if (draftEl) renderMiniList(draftEl, drafts ?? [], 'No drafts sitting around. Nicely done.');
}

/* ----------------------------------------------------------------------------
   Manage Posts — full table with search, status filter, and row actions
   ---------------------------------------------------------------------------- */
let allPostsCache = [];

function renderPostsTable() {
  const tbody = document.querySelector('[data-posts-table-body]');
  const searchInput = document.querySelector('[data-posts-search]');
  const statusFilter = document.querySelector('[data-posts-status-filter]');
  if (!tbody) return;

  const q = (searchInput?.value || '').toLowerCase().trim();
  const status = statusFilter?.value || '';

  const filtered = allPostsCache.filter((p) => {
    const matchesQ = !q || p.title.toLowerCase().includes(q);
    const matchesStatus = !status || p.status === status;
    return matchesQ && matchesStatus;
  });

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No posts match your search.</div></td></tr>`;
    return;
  }

  filtered.forEach((post) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="admin-table__title">${escapeHtml(post.title)}</span></td>
      <td>${post.post_type === 'saying' ? 'Saying' : 'Article'}</td>
      <td>
        <span class="badge badge--${post.status}">${post.status}</span>
        ${post.is_featured ? '<span class="badge badge--featured">Featured</span>' : ''}
      </td>
      <td>${escapeHtml(post.categories?.name || '\u2014')}</td>
      <td>${formatDate(post.published_at || post.created_at)}</td>
      <td>
        <div class="row-actions">
          <a href="editor.html?id=${post.id}">Edit</a>
          <button data-action="toggle-publish" data-id="${post.id}" data-status="${post.status}">
            ${post.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
          <button data-action="toggle-featured" data-id="${post.id}" data-featured="${post.is_featured}">
            ${post.is_featured ? 'Unpin' : 'Pin'}
          </button>
          <button data-action="delete" data-id="${post.id}" class="is-danger">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadManagePostsTable() {
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, post_type, status, is_featured, published_at, created_at, categories ( name )')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[dashboard] loadManagePostsTable error:', error.message);
    return;
  }
  allPostsCache = data ?? [];
  renderPostsTable();
}

async function handleTableAction(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'toggle-publish') {
    const nextStatus = btn.dataset.status === 'published' ? 'draft' : 'published';
    const patch = { status: nextStatus };
    if (nextStatus === 'published') patch.published_at = new Date().toISOString();
    const { error } = await supabase.from('posts').update(patch).eq('id', id);
    if (error) { alert('Could not update post status: ' + error.message); return; }
  }

  if (action === 'toggle-featured') {
    const nextFeatured = btn.dataset.featured !== 'true';
    const { error } = await supabase.from('posts').update({ is_featured: nextFeatured }).eq('id', id);
    if (error) { alert('Could not update featured status: ' + error.message); return; }
  }

  if (action === 'delete') {
    if (!confirm('Delete this post permanently? This cannot be undone.')) return;
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) { alert('Could not delete post: ' + error.message); return; }
  }

  // Refresh everything that could be affected by the change
  await Promise.all([loadManagePostsTable(), loadRecentAndDrafts(), loadStats()]);
}

/* ----------------------------------------------------------------------------
   Category manager
   ---------------------------------------------------------------------------- */
async function loadCategoryManager() {
  const listEl = document.querySelector('[data-category-manager-list]');
  if (!listEl) return;

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, posts!posts_category_id_fkey(count)')
    .order('name', { ascending: true });

  if (error) { console.error('[dashboard] loadCategoryManager error:', error.message); return; }

  listEl.innerHTML = '';
  (data ?? []).forEach((cat) => {
    const count = cat.posts?.[0]?.count ?? 0;
    const row = document.createElement('div');
    row.className = 'manager-list__row';
    row.innerHTML = `
      <span>${escapeHtml(cat.name)}<span class="manager-list__count">${count} post${count === 1 ? '' : 's'}</span></span>
      <button data-action="delete-category" data-id="${cat.id}" data-count="${count}" class="row-actions is-danger" style="border:none;background:none;">Delete</button>
    `;
    listEl.appendChild(row);
  });
}

function initCategoryManager() {
  const form = document.querySelector('[data-category-form]');
  const listEl = document.querySelector('[data-category-manager-list]');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const name = input.value.trim();
    if (!name) return;

    const { error } = await supabase.from('categories').insert({ name, slug: slugify(name) });
    if (error) { alert('Could not add category: ' + error.message); return; }
    input.value = '';
    loadCategoryManager();
  });

  listEl?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="delete-category"]');
    if (!btn) return;
    const count = Number(btn.dataset.count);
    if (count > 0 && !confirm(`This category has ${count} post(s). Delete anyway? Those posts will become uncategorized.`)) return;
    if (count === 0 && !confirm('Delete this category?')) return;

    const { error } = await supabase.from('categories').delete().eq('id', btn.dataset.id);
    if (error) { alert('Could not delete category: ' + error.message); return; }
    loadCategoryManager();
  });
}

/* ----------------------------------------------------------------------------
   Tag manager
   ---------------------------------------------------------------------------- */
async function loadTagManager() {
  const listEl = document.querySelector('[data-tag-manager-list]');
  if (!listEl) return;

  const { data, error } = await supabase.from('tags').select('id, name, slug').order('name', { ascending: true });
  if (error) { console.error('[dashboard] loadTagManager error:', error.message); return; }

  listEl.innerHTML = '';
  (data ?? []).forEach((tag) => {
    const row = document.createElement('div');
    row.className = 'manager-list__row';
    row.innerHTML = `
      <span>${escapeHtml(tag.name)}</span>
      <button data-action="delete-tag" data-id="${tag.id}" class="row-actions is-danger" style="border:none;background:none;">Delete</button>
    `;
    listEl.appendChild(row);
  });
}

function initTagManager() {
  const form = document.querySelector('[data-tag-form]');
  const listEl = document.querySelector('[data-tag-manager-list]');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const name = input.value.trim();
    if (!name) return;

    const { error } = await supabase.from('tags').insert({ name, slug: slugify(name) });
    if (error) { alert('Could not add tag: ' + error.message); return; }
    input.value = '';
    loadTagManager();
  });

  listEl?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="delete-tag"]');
    if (!btn) return;
    if (!confirm('Delete this tag?')) return;
    const { error } = await supabase.from('tags').delete().eq('id', btn.dataset.id);
    if (error) { alert('Could not delete tag: ' + error.message); return; }
    loadTagManager();
  });
}

/* ----------------------------------------------------------------------------
   Boot
   ---------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAdmin(); // redirects to login.html if not an admin
  if (!session) return;

  initHeader();
  loadStats();
  loadRecentAndDrafts();
  loadManagePostsTable();
  initCategoryManager();
  loadCategoryManager();
  initTagManager();
  loadTagManager();

  document.querySelector('[data-posts-table-body]')?.closest('table')
    .addEventListener('click', handleTableAction);
  document.querySelector('[data-posts-search]')?.addEventListener('input', renderPostsTable);
  document.querySelector('[data-posts-status-filter]')?.addEventListener('change', renderPostsTable);
});
