# EDGAR TEE — Authentication Setup Notes (Module 3)

## 1. Connect the real Supabase project

Edit `js/supabase.js` and replace the placeholders:

```js
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```

Both values are in **Supabase Dashboard → Settings → API**. The anon key
is safe to ship in client-side code — every table is protected by the
Row Level Security policies from Module 2 (`database/03_policies.sql`).

## 2. Run the Module 2 SQL (if not already done)

In the Supabase SQL Editor, run in order:
`01_schema.sql` → `02_functions_triggers.sql` → `03_policies.sql`.

## 3. Create your admin account

1. Supabase Dashboard → **Authentication → Users → Add user** (or sign up
   normally once `login.html` is live — but there's no public sign-up
   page by design, so creating the user directly in the dashboard is the
   intended path for a single-author blog).
2. The `handle_new_user()` trigger (Module 2) automatically creates a
   matching `profiles` row with `role = 'author'`.
3. Promote yourself to admin — run once in the SQL Editor:
   ```sql
   update profiles set role = 'admin' where username = 'your-email-local-part';
   ```

## 4. How the pieces fit together

- **`login.html`** — public-facing form. Calls `signIn()` from `auth.js`.
  On success, redirects to `dashboard.html`. On failure, shows the
  Supabase error message inline (e.g. wrong password).
- **`auth.js`** — the only module that talks to `supabase.auth`. Exposes:
  - `signIn(email, password)`
  - `signOut(redirectTo)`
  - `getCurrentSession()`
  - `getCurrentProfile()` — includes `role`
  - `isAdmin()`
  - `requireAdmin(redirectTo)` — the route guard
  - `redirectIfAuthenticated(redirectTo)` — used on `login.html` itself
  - `onAuthStateChange(callback)`
- **`dashboard.html` / `editor.html`** (built in Modules 7 & 8) will open
  their module script with:
  ```js
  import { requireAdmin } from './js/auth.js';
  const session = await requireAdmin();
  // page only continues rendering past this line for a confirmed admin
  ```
  These two pages are still empty stubs — this is documentation for how
  they'll wire in when their own modules are built, not a change to
  those files now.

## 5. Why `role` lives on `profiles`, not just "logged in = admin"

Any authenticated Supabase user could otherwise reach the dashboard.
`profiles.role` is the actual gate (`requireAdmin()` checks it, and RLS
policies check it server-side too via `is_admin()`), which is also what
makes multi-author support (Future Feature) a data change later, not a
rebuild of the auth system.

## Next Module

**Module 4: Homepage** — `index.html` + `css/style.css` (the shared
design system: colors, type scale, nav, cards, footer) built out fully
for the first time.
