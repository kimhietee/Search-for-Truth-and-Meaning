# EDGAR TEE — "Search for Truth and Meaning"

A modern, minimalist personal blog site built with vanilla HTML5, CSS3, and
ES6 JavaScript modules, backed by Supabase (Auth, Postgres, Storage).
Hosted as a static site on GitHub Pages.

## Tech Stack

| Layer          | Choice                                   |
|----------------|-------------------------------------------|
| Markup         | Semantic HTML5                            |
| Styling        | Vanilla CSS3 (custom properties, Grid/Flexbox) |
| Behavior       | Vanilla JavaScript, ES6 Modules (no framework) |
| Backend        | Supabase (Auth, PostgreSQL, Storage, Realtime) |
| Hosting        | GitHub Pages (static)                     |

No React/Vue/Angular/build step required — everything runs directly in
the browser via native `<script type="module">` imports.

## Folder Structure

```
/
├── index.html          Home page
├── sayings.html         Sayings listing page
├── post.html            Single post/article page
├── about.html            About the author
├── login.html            Admin login (Supabase Auth)
├── dashboard.html         Admin dashboard (protected)
├── editor.html            Post editor (protected)
│
├── css/
│   ├── style.css         Core design system: variables, typography, layout, components
│   ├── responsive.css      Breakpoints for tablet/mobile
│   ├── dashboard.css        Admin dashboard-specific styles
│   └── editor.css            Post editor-specific styles
│
├── js/
│   ├── app.js             Shared site init: nav, back-to-top, search bar wiring, footer
│   ├── supabase.js         Supabase client init & shared config (single source of truth)
│   ├── auth.js              Login/logout, session/route guarding for admin pages
│   ├── posts.js              CRUD + fetch helpers for posts/sayings, likes, views
│   ├── editor.js               Post editor logic: drafts, publish, slug gen, image upload
│   ├── dashboard.js              Admin dashboard stats & quick actions
│   └── search.js                  Client-side/Supabase-backed search & filtering
│
├── assets/
│   ├── images/            Static images (hero, author photo, placeholders)
│   └── icons/              Minimalist SVG icon set
│
└── README.md
```

## Architecture Principles

- **Single Supabase client**: `js/supabase.js` exports one initialized client;
  every other module imports from it. No duplicate client instances.
- **Feature-based JS modules**: each `.js` file owns one concern (auth, posts,
  search, editor, dashboard) and exposes functions via ES6 `export`. Pages
  import only what they need via `<script type="module">`.
- **Progressive enhancement**: pages render meaningful semantic HTML first;
  JS enhances (fetches live data, wires interactivity) on top.
- **Design tokens in CSS**: colors, spacing, radii, shadows, and font scales
  live as CSS custom properties in `style.css` so theme (white/blue) and
  future dark mode stay centralized.
- **Extensible by default**: database and folder layout leave clear seams for
  future features (comments, accounts, newsletter, multi-author, RSS, PWA,
  i18n) without restructuring existing modules.

## Development Roadmap (build order)

1. ✅ Folder Structure
2. Supabase Database Design
3. Authentication
4. Homepage
5. Sayings Page
6. Single Post Page
7. Admin Dashboard
8. Post Editor
9. Search
10. Supabase Integration
11. Testing
12. Deployment

Each module is built and approved before moving to the next.
