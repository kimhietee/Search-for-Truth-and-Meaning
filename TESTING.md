# EDGAR TEE — Testing (Module 11)

Two layers of testing, matched to what each part of the stack actually needs:

1. **Automated unit tests** — for the pure logic (`js/utils.js`) that has
   no DOM or network dependency, and can genuinely be verified by a
   machine.
2. **Manual QA checklist** — for everything that depends on a real
   browser, a live Supabase project, and RLS policies actually enforcing
   what they claim to. There's no practical vanilla-JS way to spin up a
   headless browser + a seeded Postgres instance without introducing a
   build step and test-framework dependencies the brief explicitly
   ruled out — so this is the deliberate, honest boundary of what's
   automated here.

---

## 1. Automated Unit Tests

**Location:** `tests/unit.test.js`
**Covers:** every function in `js/utils.js` — `escapeHtml`, `slugify`,
`formatDate`, `formatLongDate`, `estimateReadingTime`, `toDatetimeLocal`,
`initials`, `renderContentHtml`. These were extracted out of `posts.js`,
`editor.js`, and `dashboard.js` in this module specifically because they
were duplicated three times over and had drifted slightly — consolidating
them was a prerequisite for testing them meaningfully at all.

**Run them:**
```bash
npm test
# or directly:
node --test tests/unit.test.js
```

Uses Node's built-in test runner (Node 18+) — no Jest, no Mocha, no
dependency install. 20 assertions, covering the normal case, the empty/
falsy-input edge case, and the "content contains something dangerous or
weird" edge case for each function.

**Why not test posts.js / editor.js / dashboard.js the same way?**
Those files call `document.createElement`, `supabase.from(...)`, etc.
Testing them for real means either a headless browser (Playwright/
Puppeteer — a dependency and a Chromium download the brief's "vanilla
only, no build step" constraint doesn't leave room for) or mocking
Supabase so thoroughly the test stops proving anything real. The manual
checklist below is the honest way to verify that layer.

---

## 2. Manual QA Checklist

Run this against a real Supabase project (see `AUTH.md` and
`database/DATABASE.md` for setup) before every deploy.

### Public Pages

**Home (`index.html`)**
- [ ] Hero renders; featured saying loads (or hides gracefully if none exists)
- [ ] Search bar submits to `sayings.html?q=...`
- [ ] Latest Posts, Popular Sayings, Recent Articles each load real data
- [ ] Skeletons show briefly before content, not indefinitely
- [ ] Category pills link to `sayings.html?category=<slug>` and show correct counts
- [ ] Newsletter form: valid email succeeds; duplicate email shows a friendly "already subscribed" message, not an error
- [ ] Like button on a saying card increments the count and persists (localStorage `visitor_id`) across reloads
- [ ] Share button uses native share sheet on mobile, copies link on desktop

**Sayings / Search (`sayings.html`)**
- [ ] Arriving via nav shows Sayings only, heading reads "Sayings"
- [ ] Arriving via `?q=...` searches Articles + Sayings, heading reads "Search Results"
- [ ] Search matches on title, excerpt, content, AND tag names
- [ ] Category filter narrows results correctly; invalid/unknown category slug returns zero results, not everything
- [ ] Type filter (Sayings / Articles / All) works in both directions
- [ ] Sort: Newest, Most Liked, Most Viewed, Title A–Z all reorder correctly
- [ ] Pagination: Prev/Next disable at the boundaries; page count matches result count
- [ ] URL reflects all active filters (bookmarkable, back/forward works)
- [ ] Empty state shows when nothing matches, not a blank grid

**Single Post (`post.html`)**
- [ ] `?slug=` for a real published post loads title, subtitle, category, date, author, reading time, image (if set), full content
- [ ] Missing/invalid slug shows the 404 state, not a broken page
- [ ] Draft or unpublished post's slug is NOT publicly viewable (confirms RLS is working, not just UI hiding it)
- [ ] A view is logged in `views` on load (check Supabase table)
- [ ] Like/share buttons work same as on cards
- [ ] Related Posts shows same-category posts, excludes the current post
- [ ] Previous/Next nav points to the correct adjacent posts by date, and disables at the ends
- [ ] Comment section shows the "coming soon" placeholder, not a broken form

**About (`about.html`)**
- [ ] All sections render (bio, mission, vision, philosophy, contact, social)
- [ ] Contact email link opens mail client with correct address

### Authentication

- [ ] `login.html`: correct credentials redirect to `dashboard.html`
- [ ] Wrong password shows an inline error, not a silent failure
- [ ] Already-logged-in admin visiting `login.html` skips straight to the dashboard
- [ ] Visiting `dashboard.html` or `editor.html` while signed out redirects to `login.html`
- [ ] A signed-in **non-admin** account (if one exists) is also redirected out of admin pages — confirms `role` is actually checked, not just "is logged in"
- [ ] Log Out clears the session and redirects correctly

### Admin Dashboard (`dashboard.html`)

- [ ] Stats (Total Posts, Categories, Views) match what's actually in the database
- [ ] Recent Posts and Draft Posts lists are accurate and up to date
- [ ] Manage Posts table: search filters by title live; status filter works
- [ ] Publish/Unpublish toggle updates status and (on publish) sets `published_at`
- [ ] Pin/Unpin toggles `is_featured` and reflects on the homepage's Featured Saying / badges
- [ ] Delete asks for confirmation, then actually removes the post (and it disappears from public pages)
- [ ] Category manager: add works, appears immediately in the editor's dropdown; delete on a category with posts warns first
- [ ] Tag manager: add/delete work correctly

### Post Editor (`editor.html`)

- [ ] New post: all fields start empty/defaulted; Delete button is hidden until the post has been saved once
- [ ] Article/Saying toggle changes subtitle visibility and textarea height sensibly
- [ ] Slug auto-generates from title, stops once manually edited, and stays locked on an existing post
- [ ] Reading time auto-estimates from content, editable, stops auto-updating once touched
- [ ] Image upload: file uploads to Supabase Storage, preview shows, "Remove image" clears it
- [ ] Tags: comma-separated input creates new tags that didn't exist yet, and correctly links existing ones
- [ ] SEO character counter updates live and flags when over ~155 characters
- [ ] **Save Draft** creates/updates with `status: 'draft'`
- [ ] **Publish** sets `status: 'published'` and stamps `published_at` if it wasn't already set
- [ ] **Preview** renders the current unsaved form content accurately, closes on the × and on backdrop click
- [ ] Editing an existing post (`?id=...`) pre-fills every field correctly, including its tags and category
- [ ] Saving a brand-new post updates the URL to `?id=<newId>` without a full reload, and Delete becomes available

### Responsive / Cross-Device

Test at minimum: 375px (mobile), 768px (tablet), 1440px (desktop).
- [ ] Nav collapses to a hamburger menu below 600px and opens/closes correctly
- [ ] Hero, cards, and toolbar all reflow without horizontal scroll
- [ ] Admin dashboard and editor sidebar stack below 960px
- [ ] Touch targets (buttons, links) are comfortably tappable on mobile

### Accessibility

- [ ] Tab through every page — focus order is logical, focus ring is visible (`:focus-visible`)
- [ ] All images/icons that convey meaning have `alt` or `aria-label`
- [ ] Color contrast holds up for body text against the paper background
- [ ] `prefers-reduced-motion` disables scroll-reveal and shrinks nav transitions

### Data Integrity / Security (RLS)

- [ ] Log out completely, then try fetching a draft post's data directly via the Supabase REST API — should be denied
- [ ] Confirm the anon key in `js/supabase.js` cannot write to `posts`, `categories`, or `tags` (only `likes`, `views`, `newsletter`, and `comments` inserts should succeed while signed out)
- [ ] Confirm a signed-in admin CAN write to all of the above

### Cross-Browser

- [ ] Chrome, Firefox, Safari (desktop) — at minimum
- [ ] Safari iOS, Chrome Android — at minimum
