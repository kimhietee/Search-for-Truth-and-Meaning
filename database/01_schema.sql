-- ============================================================================
-- 01_schema.sql — EDGAR TEE Database Schema
-- Supabase PostgreSQL
--
-- Normalized tables for a single-author blog with room to grow into
-- multi-author (profiles.role), comments, likes, view stats, and a
-- newsletter — per the Future Features list in the project brief.
--
-- Run this file first, then 02_functions_triggers.sql, then 03_policies.sql.
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- profiles
-- One row per authenticated user (admin/author). Mirrors auth.users 1:1.
-- Public visitors never get a row here — they don't need accounts.
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  display_name  text not null,
  avatar_url    text,
  bio           text,
  role          text not null default 'author'
                  check (role in ('admin', 'author')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table profiles is
  'Admin/author accounts. role=admin can manage everything; role=author is scoped to own posts (future multi-author).';

-- ----------------------------------------------------------------------------
-- categories
-- ----------------------------------------------------------------------------
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  slug        text unique not null,
  description text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- tags
-- ----------------------------------------------------------------------------
create table if not exists tags (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  slug        text unique not null,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- posts
-- Covers both long-form "Articles" and short "Sayings" — distinguished by
-- post_type so both share one editor, one table, one search index.
-- ----------------------------------------------------------------------------
create table if not exists posts (
  id                 uuid primary key default gen_random_uuid(),
  author_id          uuid references profiles(id) on delete set null,
  post_type          text not null default 'article'
                        check (post_type in ('article', 'saying')),
  title              text not null,
  subtitle           text,
  slug               text unique not null,
  excerpt            text,
  content            text not null,           -- markdown-ready plain/markdown text
  featured_image_url text,
  category_id        uuid references categories(id) on delete set null,
  status             text not null default 'draft'
                        check (status in ('draft', 'published')),
  is_featured        boolean not null default false,
  seo_description    text,
  reading_time_minutes integer,
  view_count         integer not null default 0,   -- denormalized counter, kept in sync by trigger
  like_count         integer not null default 0,   -- denormalized counter, kept in sync by trigger
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_posts_slug          on posts (slug);
create index if not exists idx_posts_status         on posts (status);
create index if not exists idx_posts_post_type      on posts (post_type);
create index if not exists idx_posts_category_id    on posts (category_id);
create index if not exists idx_posts_published_at   on posts (published_at desc);
create index if not exists idx_posts_is_featured    on posts (is_featured) where is_featured = true;
-- Full-text search across title, subtitle, excerpt, content
create index if not exists idx_posts_search on posts
  using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(subtitle,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,'')));

comment on table posts is
  'Both articles and sayings live here (post_type). Denormalized view_count/like_count kept current via triggers on views/likes.';

-- ----------------------------------------------------------------------------
-- post_tags (many-to-many junction)
-- ----------------------------------------------------------------------------
create table if not exists post_tags (
  post_id  uuid not null references posts(id) on delete cascade,
  tag_id   uuid not null references tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create index if not exists idx_post_tags_tag_id on post_tags (tag_id);

-- ----------------------------------------------------------------------------
-- comments (future feature — table exists now so editor/dashboard counts
-- and future UI can be wired without a migration later)
-- ----------------------------------------------------------------------------
create table if not exists comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references posts(id) on delete cascade,
  author_name   text not null,
  author_email  text,
  content       text not null,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'spam')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_comments_post_id on comments (post_id);
create index if not exists idx_comments_status  on comments (status);

-- ----------------------------------------------------------------------------
-- likes
-- Public visitors can like without an account, identified by an anonymous
-- client-generated visitor_id (stored in localStorage by the frontend).
-- The unique constraint prevents the same visitor liking a post twice.
-- ----------------------------------------------------------------------------
create table if not exists likes (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  visitor_id  text not null,
  created_at  timestamptz not null default now(),
  unique (post_id, visitor_id)
);

create index if not exists idx_likes_post_id on likes (post_id);

-- ----------------------------------------------------------------------------
-- views
-- Append-only view log (dedupe/throttling handled in app logic, e.g. one
-- view per visitor_id per post per day). Powers dashboard "Total Views".
-- ----------------------------------------------------------------------------
create table if not exists views (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  visitor_id  text,
  viewed_at   timestamptz not null default now()
);

create index if not exists idx_views_post_id   on views (post_id);
create index if not exists idx_views_viewed_at on views (viewed_at);

-- ----------------------------------------------------------------------------
-- newsletter
-- ----------------------------------------------------------------------------
create table if not exists newsletter (
  id             uuid primary key default gen_random_uuid(),
  email          text unique not null,
  status         text not null default 'subscribed'
                    check (status in ('subscribed', 'unsubscribed')),
  subscribed_at  timestamptz not null default now()
);
