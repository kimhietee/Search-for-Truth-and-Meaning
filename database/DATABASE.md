# EDGAR TEE — Database Design (Module 2)

Supabase PostgreSQL. Run the numbered SQL files in order:

1. `01_schema.sql` — tables, constraints, indexes
2. `02_functions_triggers.sql` — automation (timestamps, counters, slug fallback, auto-profile-on-signup)
3. `03_policies.sql` — Row Level Security
4. `04_seed.sql` — optional sample data for local dev only

## Entity Relationship Overview

```
auth.users (Supabase-managed)
     │ 1:1 (trigger-created)
     ▼
 profiles ──┐
     │      │ role: admin | author
     │ 1:N  │
     ▼      │
  posts ────┼──────────────► categories   (N:1)
     │      │
     │ N:M  │
     ▼      │
 post_tags ─┴──────────────► tags         (N:1 via junction)
     │
     ├──1:N──► comments   (future UI; table + policies ready now)
     ├──1:N──► likes      (anonymous, deduped by visitor_id)
     └──1:N──► views      (anonymous, append-only log)

newsletter  (standalone — email capture, no FK to posts)
```

## Key Design Decisions

**One `posts` table for both Sayings and Articles.**
`post_type` ('article' | 'saying') distinguishes them. This avoids
duplicating category/tag/like/view/comment logic across two schemas —
the Sayings page and Home page just filter `where post_type = 'saying'`.

**Public visitors need no account.**
Likes, views, comments, and newsletter signups all accept anonymous
writes via the Supabase anon key. Likes are deduplicated by a
client-generated `visitor_id` (stored in `localStorage`) rather than a
user id, since the brief is explicit that public visitors don't need
accounts.

**Denormalized counters (`posts.view_count`, `posts.like_count`).**
Reading counts off `posts` directly is far cheaper than `count(*)` over
`views`/`likes` on every page load. Triggers in
`02_functions_triggers.sql` keep them accurate on every insert/delete.

**`profiles.role` anticipates multi-author (Future Feature) today.**
Single-author now (you'll be `admin`), but RLS policies already
distinguish "admin: full access" from "author: own posts only" so
adding a second writer later is a data change, not a schema change.

**Comments table + policies exist now, UI comes later.**
Per the brief, comments are a "future feature" but building the table
and RLS now means Module 8 (editor) and a future comments UI need zero
migrations — just front-end work.

**Full-text search index on `posts`.**
A GIN index over `title + subtitle + excerpt + content` backs Module 9
(Search) via Postgres `to_tsvector`/`websearch_to_tsquery`, avoiding a
separate search service for a personal blog's scale.

**Slug safety net at the DB layer.**
The editor (Module 8) will generate slugs client-side, but
`ensure_post_slug()` guarantees a non-null, URL-safe slug even if that
ever gets bypassed (e.g. a direct API call).

## Row Level Security Summary

| Table       | Public (anon)                          | Admin                  |
|-------------|------------------------------------------|--------------------------|
| profiles    | read all                                  | update any                |
| categories  | read                                       | full CRUD                  |
| tags        | read                                        | full CRUD                   |
| posts       | read where `status = 'published'`            | full CRUD, incl. drafts       |
| post_tags   | read (via published post)                      | full CRUD                       |
| comments    | read `approved`; insert as `pending`             | full CRUD (approve/reject/delete) |
| likes       | insert / delete                                    | read                                |
| views       | insert                                               | read                                 |
| newsletter  | insert (subscribe)                                    | read, update (unsubscribe mgmt)       |

## Storage (Images)

Not a table, but part of this module: create a public Supabase Storage
bucket named `post-images` for featured images and author photo, with a
storage policy allowing public read and admin-only write. Wired up in
Module 10 (Supabase Integration) alongside `editor.js` image upload.

## Next Module

**Module 3: Authentication** — Supabase Auth wiring in `auth.js` and
`login.html`: admin sign-in, session persistence, and route guarding for
`dashboard.html` / `editor.html`.
