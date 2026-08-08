/**
 * editor.js — Post Editor Logic
 * EDGAR TEE
 *
 * Owns: editor.html behavior — create/update posts (articles & sayings
 * share this one editor via post_type), draft vs. published status,
 * featured toggle, slug auto-generation, tag management, featured image
 * upload to Supabase Storage, SEO description, reading-time estimate,
 * and preview-before-publish.
 *
 * URL contract: editor.html creates a new post. editor.html?id=<uuid>
 * loads and edits an existing one.
 */

import { supabase } from './supabase.js';
import { requireAdmin } from './auth.js';
import { fetchCategories, renderContentHtml } from './posts.js';
import { slugify, estimateReadingTime, escapeHtml, toDatetimeLocal } from './utils.js';

const STORAGE_BUCKET = 'post-images';

/* ----------------------------------------------------------------------------
   Helpers
   (slugify, estimateReadingTime, escapeHtml, toDatetimeLocal now live in utils.js)
   ---------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
   Editor state
   ---------------------------------------------------------------------------- */
const state = {
  id: null,               // null = creating a new post
  postType: 'article',
  featuredImageUrl: '',
  slugManuallyEdited: false,
  readingTimeManuallyEdited: false,
};

/* Element references, grabbed once on boot */
const els = {};

function cacheElements() {
  els.titleInput = document.querySelector('[data-editor-title]');
  els.subtitleInput = document.querySelector('[data-editor-subtitle]');
  els.contentTextarea = document.querySelector('[data-editor-content]');
  els.excerptInput = document.querySelector('[data-editor-excerpt]');
  els.seoTextarea = document.querySelector('[data-editor-seo]');
  els.seoCharCount = document.querySelector('[data-editor-seo-count]');
  els.categorySelect = document.querySelector('[data-editor-category]');
  els.tagsInput = document.querySelector('[data-editor-tags]');
  els.slugInput = document.querySelector('[data-editor-slug]');
  els.slugPreview = document.querySelector('[data-editor-slug-preview]');
  els.dateInput = document.querySelector('[data-editor-date]');
  els.readingTimeInput = document.querySelector('[data-editor-reading-time]');
  els.featuredToggle = document.querySelector('[data-editor-featured-toggle]');
  els.imageInput = document.querySelector('[data-editor-image-input]');
  els.imagePreview = document.querySelector('[data-editor-image-preview]');
  els.imageRemoveBtn = document.querySelector('[data-editor-image-remove]');
  els.imageDropLabel = document.querySelector('[data-editor-image-label]');
  els.postTypeButtons = document.querySelectorAll('[data-editor-post-type]');
  els.statusPill = document.querySelector('[data-editor-status-pill]');
  els.saveMessage = document.querySelector('[data-editor-save-message]');
  els.saveDraftBtn = document.querySelector('[data-editor-save-draft]');
  els.publishBtn = document.querySelector('[data-editor-publish]');
  els.previewBtn = document.querySelector('[data-editor-preview]');
  els.deleteBtn = document.querySelector('[data-editor-delete]');
  els.previewModal = document.querySelector('[data-preview-modal]');
  els.previewClose = document.querySelector('[data-preview-close]');
}

/* ----------------------------------------------------------------------------
   Post type toggle (Article / Saying)
   ---------------------------------------------------------------------------- */
function setPostType(type) {
  state.postType = type;
  els.postTypeButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.editorPostType === type));
  // Sayings are short — content textarea can stay compact; articles need room.
  if (els.contentTextarea) {
    els.contentTextarea.style.minHeight = type === 'saying' ? '120px' : '480px';
  }
  if (els.subtitleInput?.closest('.editor-field')) {
    els.subtitleInput.closest('.editor-field').style.display = type === 'saying' ? 'none' : '';
  }
}

function initPostTypeToggle() {
  els.postTypeButtons.forEach((btn) => {
    btn.addEventListener('click', () => setPostType(btn.dataset.editorPostType));
  });
}

/* ----------------------------------------------------------------------------
   Slug auto-generation
   ---------------------------------------------------------------------------- */
function updateSlugFromTitle() {
  if (state.slugManuallyEdited) return;
  const slug = slugify(els.titleInput.value);
  els.slugInput.value = slug;
  updateSlugPreview();
}

function updateSlugPreview() {
  if (!els.slugPreview) return;
  const slug = els.slugInput.value || 'your-post-title';
  els.slugPreview.innerHTML = `post.html?slug=<strong>${escapeHtml(slug)}</strong>`;
}

function initSlugGenerator() {
  els.titleInput?.addEventListener('input', updateSlugFromTitle);
  els.slugInput?.addEventListener('input', () => {
    state.slugManuallyEdited = true;
    els.slugInput.value = slugify(els.slugInput.value);
    updateSlugPreview();
  });
}

/* ----------------------------------------------------------------------------
   Reading time estimate
   ---------------------------------------------------------------------------- */
function initReadingTime() {
  els.contentTextarea?.addEventListener('input', () => {
    if (!state.readingTimeManuallyEdited) {
      els.readingTimeInput.value = estimateReadingTime(els.contentTextarea.value);
    }
  });
  els.readingTimeInput?.addEventListener('input', () => { state.readingTimeManuallyEdited = true; });
}

/* ----------------------------------------------------------------------------
   SEO character counter
   ---------------------------------------------------------------------------- */
function initSeoCounter() {
  if (!els.seoTextarea || !els.seoCharCount) return;
  const update = () => {
    const len = els.seoTextarea.value.length;
    els.seoCharCount.textContent = `${len} / 155 characters ${len > 155 ? '(a bit long for search results)' : ''}`;
  };
  els.seoTextarea.addEventListener('input', update);
  update();
}

/* ----------------------------------------------------------------------------
   Featured image upload
   ---------------------------------------------------------------------------- */
function setImagePreview(url) {
  state.featuredImageUrl = url || '';
  if (!els.imagePreview) return;
  if (url) {
    els.imagePreview.style.backgroundImage = `url('${url}')`;
    els.imagePreview.classList.add('has-image');
    els.imageRemoveBtn?.classList.add('is-visible');
    if (els.imageDropLabel) els.imageDropLabel.textContent = 'Click to replace image';
  } else {
    els.imagePreview.style.backgroundImage = '';
    els.imagePreview.classList.remove('has-image');
    els.imageRemoveBtn?.classList.remove('is-visible');
    if (els.imageDropLabel) els.imageDropLabel.textContent = 'Click to upload a featured image';
  }
}

function initImageUpload() {
  els.imageInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (els.imageDropLabel) els.imageDropLabel.textContent = 'Uploading\u2026';

    const ext = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (uploadError) {
      alert('Image upload failed: ' + uploadError.message);
      setImagePreview(state.featuredImageUrl);
      return;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    setImagePreview(data.publicUrl);
  });

  els.imageRemoveBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    setImagePreview('');
    if (els.imageInput) els.imageInput.value = '';
  });
}

/* ----------------------------------------------------------------------------
   Categories dropdown
   ---------------------------------------------------------------------------- */
async function loadCategoriesDropdown(selectedId = '') {
  if (!els.categorySelect) return;
  const categories = await fetchCategories();
  els.categorySelect.innerHTML = '<option value="">Uncategorized</option>';
  categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    if (cat.id === selectedId) opt.selected = true;
    els.categorySelect.appendChild(opt);
  });
}

/* ----------------------------------------------------------------------------
   Tags — find-or-create by name, sync post_tags junction rows
   ---------------------------------------------------------------------------- */
function parseTagNames() {
  return (els.tagsInput?.value || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

async function findOrCreateTagIds(names) {
  const ids = [];
  for (const name of names) {
    const slug = slugify(name);
    const { data: existing } = await supabase.from('tags').select('id').eq('slug', slug).maybeSingle();
    if (existing) {
      ids.push(existing.id);
    } else {
      const { data: created, error } = await supabase.from('tags').insert({ name, slug }).select('id').single();
      if (!error && created) ids.push(created.id);
    }
  }
  return ids;
}

async function syncPostTags(postId, tagIds) {
  await supabase.from('post_tags').delete().eq('post_id', postId);
  if (tagIds.length === 0) return;
  await supabase.from('post_tags').insert(tagIds.map((tagId) => ({ post_id: postId, tag_id: tagId })));
}

/* ----------------------------------------------------------------------------
   Load an existing post for editing
   ---------------------------------------------------------------------------- */
async function loadExistingPost(id) {
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !post) {
    alert('Could not load that post — it may have been deleted.');
    window.location.href = 'dashboard.html';
    return;
  }

  state.id = post.id;
  state.slugManuallyEdited = true;    // never auto-overwrite a saved post's slug
  state.readingTimeManuallyEdited = true;
  setPostType(post.post_type);
  setImagePreview(post.featured_image_url);

  els.titleInput.value = post.title || '';
  els.subtitleInput.value = post.subtitle || '';
  els.contentTextarea.value = post.content || '';
  els.excerptInput.value = post.excerpt || '';
  els.seoTextarea.value = post.seo_description || '';
  els.slugInput.value = post.slug || '';
  els.dateInput.value = toDatetimeLocal(post.published_at) || toDatetimeLocal(new Date().toISOString());
  els.readingTimeInput.value = post.reading_time_minutes || estimateReadingTime(post.content || '');
  els.featuredToggle.checked = !!post.is_featured;
  updateSlugPreview();
  initSeoCounter();

  await loadCategoriesDropdown(post.category_id);

  const { data: postTags } = await supabase
    .from('post_tags')
    .select('tags ( name )')
    .eq('post_id', post.id);
  els.tagsInput.value = (postTags ?? []).map((pt) => pt.tags?.name).filter(Boolean).join(', ');

  setStatusPill(post.status);
  if (els.deleteBtn) els.deleteBtn.style.display = '';
}

function setStatusPill(status) {
  if (!els.statusPill) return;
  els.statusPill.textContent = status === 'published' ? 'Published' : 'Draft';
}

/* ----------------------------------------------------------------------------
   Save (create or update)
   ---------------------------------------------------------------------------- */
function gatherFormData(status) {
  const content = els.contentTextarea.value.trim();
  return {
    post_type: state.postType,
    title: els.titleInput.value.trim(),
    subtitle: els.subtitleInput.value.trim() || null,
    slug: els.slugInput.value.trim() || slugify(els.titleInput.value),
    excerpt: els.excerptInput.value.trim() || content.slice(0, 160),
    content,
    featured_image_url: state.featuredImageUrl || null,
    category_id: els.categorySelect.value || null,
    status,
    is_featured: els.featuredToggle.checked,
    seo_description: els.seoTextarea.value.trim() || null,
    reading_time_minutes: Number(els.readingTimeInput.value) || estimateReadingTime(content),
    published_at: els.dateInput.value ? new Date(els.dateInput.value).toISOString() : new Date().toISOString(),
  };
}

async function savePost(status) {
  if (!els.titleInput.value.trim()) {
    alert('Please give the post a title before saving.');
    return;
  }
  if (!els.contentTextarea.value.trim()) {
    alert('Please write some content before saving.');
    return;
  }

  const payload = gatherFormData(status);
  setSaveMessage(status === 'published' ? 'Publishing\u2026' : 'Saving draft\u2026');

  let postId = state.id;
  let error;

  if (postId) {
    ({ error } = await supabase.from('posts').update(payload).eq('id', postId));
  } else {
    const { data, error: insertError } = await supabase.from('posts').insert(payload).select('id').single();
    error = insertError;
    if (data) postId = data.id;
  }

  if (error) {
    setSaveMessage('');
    alert('Could not save: ' + error.message);
    return;
  }

  const tagIds = await findOrCreateTagIds(parseTagNames());
  await syncPostTags(postId, tagIds);

  state.id = postId;
  setStatusPill(status);
  setSaveMessage(status === 'published' ? 'Published!' : 'Draft saved.');

  // A brand-new post now has an id — switch the URL to edit mode without reloading
  if (window.location.search.indexOf(`id=${postId}`) === -1) {
    window.history.replaceState({}, '', `editor.html?id=${postId}`);
    if (els.deleteBtn) els.deleteBtn.style.display = '';
  }

  setTimeout(() => setSaveMessage(''), 3000);
}

function setSaveMessage(text) {
  if (els.saveMessage) els.saveMessage.textContent = text;
}

/* ----------------------------------------------------------------------------
   Delete
   ---------------------------------------------------------------------------- */
async function deletePost() {
  if (!state.id) return;
  if (!confirm('Delete this post permanently? This cannot be undone.')) return;

  const { error } = await supabase.from('posts').delete().eq('id', state.id);
  if (error) { alert('Could not delete: ' + error.message); return; }
  window.location.href = 'dashboard.html';
}

/* ----------------------------------------------------------------------------
   Preview modal
   ---------------------------------------------------------------------------- */
function openPreview() {
  if (!els.previewModal) return;

  const title = els.titleInput.value.trim() || 'Untitled';
  const subtitle = els.subtitleInput.value.trim();
  const content = els.contentTextarea.value.trim();
  const categoryName = els.categorySelect.selectedOptions[0]?.textContent || 'Uncategorized';
  const readingTime = els.readingTimeInput.value;

  els.previewModal.querySelector('[data-preview-category]').textContent = categoryName;
  els.previewModal.querySelector('[data-preview-title]').textContent = title;
  const subEl = els.previewModal.querySelector('[data-preview-subtitle]');
  subEl.textContent = subtitle;
  subEl.style.display = subtitle ? '' : 'none';
  els.previewModal.querySelector('[data-preview-meta]').textContent =
    `Edgar Tee \u00b7 ${new Date(els.dateInput.value || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} \u00b7 ${readingTime} min read`;
  els.previewModal.querySelector('[data-preview-content]').innerHTML = renderContentHtml(content);

  const imgEl = els.previewModal.querySelector('[data-preview-image]');
  if (state.featuredImageUrl) {
    imgEl.style.backgroundImage = `url('${state.featuredImageUrl}')`;
    imgEl.style.display = '';
  } else {
    imgEl.style.display = 'none';
  }

  els.previewModal.classList.add('is-open');
}

function initPreviewModal() {
  els.previewBtn?.addEventListener('click', openPreview);
  els.previewClose?.addEventListener('click', () => els.previewModal.classList.remove('is-open'));
  els.previewModal?.addEventListener('click', (e) => {
    if (e.target === els.previewModal) els.previewModal.classList.remove('is-open');
  });
}

/* ----------------------------------------------------------------------------
   Boot
   ---------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAdmin();
  if (!session) return;

  cacheElements();
  initPostTypeToggle();
  initSlugGenerator();
  initReadingTime();
  initSeoCounter();
  initImageUpload();
  initPreviewModal();

  els.saveDraftBtn?.addEventListener('click', () => savePost('draft'));
  els.publishBtn?.addEventListener('click', () => savePost('published'));
  els.deleteBtn?.addEventListener('click', deletePost);

  const id = new URLSearchParams(window.location.search).get('id');

  if (id) {
    await loadExistingPost(id);
  } else {
    setPostType('article');
    els.dateInput.value = toDatetimeLocal(new Date().toISOString());
    els.readingTimeInput.value = 1;
    setStatusPill('draft');
    await loadCategoriesDropdown();
    if (els.deleteBtn) els.deleteBtn.style.display = 'none';
  }
});
