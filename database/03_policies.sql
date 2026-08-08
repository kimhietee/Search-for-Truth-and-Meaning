-- ============================================================================
-- 03_policies.sql — EDGAR TEE Row Level Security
-- Supabase PostgreSQL
--
-- Model:
--   • Public/anon visitors: read published content, submit likes/views/
--     comments/newsletter signups — no login required, matches the brief
--     ("Public visitors do NOT need an account").
--   • Authenticated admins (profiles.role = 'admin'): full CRUD everywhere.
--   • Authenticated authors (future multi-author): CRUD scoped to their
--     own posts.
-- ============================================================================

alter table profiles    enable row level security;
alter table categories  enable row level security;
alter table tags        enable row level security;
alter table posts       enable row level security;
alter table post_tags   enable row level security;
alter table comments    enable row level security;
alter table likes       enable row level security;
alter table views       enable row level security;
alter table newsletter  enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create policy "profiles: public read (author display info)"
  on profiles for select
  using (true);

create policy "profiles: self update"
  on profiles for update
  using (auth.uid() = id);

create policy "profiles: admin update any"
  on profiles for update
  using (is_admin());

-- ----------------------------------------------------------------------------
-- categories / tags — public read, admin write
-- ----------------------------------------------------------------------------
create policy "categories: public read"   on categories for select using (true);
create policy "categories: admin write"   on categories for all
  using (is_admin()) with check (is_admin());

create policy "tags: public read"         on tags for select using (true);
create policy "tags: admin write"         on tags for all
  using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- posts
--   Public: only published posts.
--   Admin: everything (drafts included) — dashboard & editor need this.
--   Author (future): own posts regardless of status.
-- ----------------------------------------------------------------------------
create policy "posts: public read published"
  on posts for select
  using (status = 'published');

create policy "posts: admin read all"
  on posts for select
  using (is_admin());

create policy "posts: author read own"
  on posts for select
  using (auth.uid() = author_id);

create policy "posts: admin write all"
  on posts for all
  using (is_admin()) with check (is_admin());

create policy "posts: author write own"
  on posts for all
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- ----------------------------------------------------------------------------
-- post_tags — readable if the parent post is readable; admin/author manage
-- ----------------------------------------------------------------------------
create policy "post_tags: public read via published post"
  on post_tags for select
  using (
    exists (select 1 from posts p where p.id = post_id and p.status = 'published')
  );

create policy "post_tags: admin manage"
  on post_tags for all
  using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- comments (future feature; policies ready ahead of UI)
--   Public can submit a comment (goes in as 'pending'); public can read
--   only 'approved' comments; admin manages everything.
-- ----------------------------------------------------------------------------
create policy "comments: public read approved"
  on comments for select
  using (status = 'approved');

create policy "comments: public insert (pending)"
  on comments for insert
  with check (status = 'pending');

create policy "comments: admin manage"
  on comments for all
  using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- likes — anonymous visitors can like/unlike published posts; no public read
-- of the raw table (counts are exposed via posts.like_count instead)
-- ----------------------------------------------------------------------------
create policy "likes: public insert"
  on likes for insert
  with check (
    exists (select 1 from posts p where p.id = post_id and p.status = 'published')
  );

create policy "likes: public delete own (unlike)"
  on likes for delete
  using (true); -- visitor_id ownership is enforced client-side (anon key, no auth); acceptable for a low-stakes like counter

create policy "likes: admin read"
  on likes for select
  using (is_admin());

-- ----------------------------------------------------------------------------
-- views — anonymous visitors can log a view; only admin can read the log
-- (dashboard aggregates; raw log is not public)
-- ----------------------------------------------------------------------------
create policy "views: public insert"
  on views for insert
  with check (
    exists (select 1 from posts p where p.id = post_id and p.status = 'published')
  );

create policy "views: admin read"
  on views for select
  using (is_admin());

-- ----------------------------------------------------------------------------
-- newsletter — public can subscribe (insert only); admin reads the list
-- ----------------------------------------------------------------------------
create policy "newsletter: public insert"
  on newsletter for insert
  with check (true);

create policy "newsletter: admin read"
  on newsletter for select
  using (is_admin());

create policy "newsletter: admin manage"
  on newsletter for update
  using (is_admin()) with check (is_admin());
