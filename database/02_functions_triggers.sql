-- ============================================================================
-- 02_functions_triggers.sql — EDGAR TEE Database Automation
-- Supabase PostgreSQL
--
-- Keeps updated_at fresh, keeps posts.view_count / posts.like_count in
-- sync with the views/likes tables, and auto-provisions a profiles row
-- whenever a new Supabase Auth user is created.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Generic "touch updated_at" trigger, reused by profiles + posts
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists trg_posts_updated_at on posts;
create trigger trg_posts_updated_at
  before update on posts
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Auto-create a profiles row when a new admin/author signs up via
-- Supabase Auth. username defaults from email local-part; editable after.
-- ----------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, role)
  values (
    new.id,
    split_part(new.email, '@', 1),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'author'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- Keep posts.like_count in sync with likes table
-- ----------------------------------------------------------------------------
create or replace function sync_post_like_count()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    update posts set like_count = like_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_likes_sync_count on likes;
create trigger trg_likes_sync_count
  after insert or delete on likes
  for each row execute function sync_post_like_count();

-- ----------------------------------------------------------------------------
-- Keep posts.view_count in sync with views table
-- ----------------------------------------------------------------------------
create or replace function sync_post_view_count()
returns trigger as $$
begin
  update posts set view_count = view_count + 1 where id = new.post_id;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_views_sync_count on views;
create trigger trg_views_sync_count
  after insert on views
  for each row execute function sync_post_view_count();

-- ----------------------------------------------------------------------------
-- Auto-generate a URL-safe slug from title if one wasn't supplied
-- (the editor UI also generates one client-side; this is a DB-level
-- safety net so slugs are never null/blank).
-- ----------------------------------------------------------------------------
create or replace function slugify(input text)
returns text as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'));
$$ language sql immutable;

create or replace function ensure_post_slug()
returns trigger as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := slugify(new.title) || '-' || substr(new.id::text, 1, 8);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_posts_ensure_slug on posts;
create trigger trg_posts_ensure_slug
  before insert on posts
  for each row execute function ensure_post_slug();
