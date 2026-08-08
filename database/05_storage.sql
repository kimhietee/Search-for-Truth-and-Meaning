-- ============================================================================
-- 05_storage.sql — EDGAR TEE Storage Setup
-- Supabase PostgreSQL / Storage
--
-- Creates the `post-images` bucket used by editor.js for featured image
-- uploads (Module 8), and the author photo used on about.html. Public
-- read (so images render on the live site with no auth), admin-only
-- write.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Anyone can view images (they're embedded in public pages)
create policy "post-images: public read"
  on storage.objects for select
  using (bucket_id = 'post-images');

-- Only admins can upload/replace/delete
create policy "post-images: admin insert"
  on storage.objects for insert
  with check (bucket_id = 'post-images' and is_admin());

create policy "post-images: admin update"
  on storage.objects for update
  using (bucket_id = 'post-images' and is_admin());

create policy "post-images: admin delete"
  on storage.objects for delete
  using (bucket_id = 'post-images' and is_admin());
