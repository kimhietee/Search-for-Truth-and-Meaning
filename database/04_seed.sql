-- ============================================================================
-- 04_seed.sql — EDGAR TEE Sample Data (optional, for local dev/testing only)
-- Supabase PostgreSQL
--
-- Do NOT run against production. Assumes at least one admin already
-- exists in auth.users (create via Supabase Auth first, then re-run the
-- profiles update below with that user's real id).
-- ============================================================================

insert into categories (name, slug, description) values
  ('Philosophy',        'philosophy',        'Reflections on meaning, truth, and how to live.'),
  ('Life Lessons',      'life-lessons',       'Hard-won lessons from everyday experience.'),
  ('Inspiration',       'inspiration',        'Short pieces meant to lift and motivate.'),
  ('Personal Thoughts', 'personal-thoughts',  'Unfiltered, personal reflections.')
on conflict (slug) do nothing;

insert into tags (name, slug) values
  ('truth',      'truth'),
  ('growth',     'growth'),
  ('stillness',  'stillness'),
  ('purpose',    'purpose'),
  ('resilience', 'resilience')
on conflict (slug) do nothing;

-- Sample "saying" (short-form) and "article" (long-form) posts.
-- author_id left null here since seed runs before a real admin exists;
-- update after creating your admin user:
--   update posts set author_id = '<your-admin-uuid>';
insert into posts (post_type, title, slug, excerpt, content, category_id, status, is_featured, reading_time_minutes, published_at)
values
  (
    'saying',
    'The quiet mind hears what the noisy mind misses.',
    'the-quiet-mind-hears',
    'On stillness as a form of understanding.',
    'The quiet mind hears what the noisy mind misses.',
    (select id from categories where slug = 'stillness' limit 1),
    'published',
    true,
    1,
    now()
  ),
  (
    'article',
    'Searching for Truth in an Age of Noise',
    'searching-for-truth-in-an-age-of-noise',
    'Why the search for meaning matters more than ever, and where to begin.',
    'Full article content goes here — written in the post editor (Module 8) once it exists...',
    (select id from categories where slug = 'philosophy' limit 1),
    'published',
    true,
    6,
    now()
  )
on conflict (slug) do nothing;
