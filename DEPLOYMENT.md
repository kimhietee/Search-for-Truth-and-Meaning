# EDGAR TEE — Deployment (Module 12)

The site is static (HTML/CSS/vanilla JS) — GitHub Pages hosts the files,
Supabase is the entire backend. There is no build step.

---

## 1. Supabase Setup (do this first)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the files in `database/` **in order**:
   1. `01_schema.sql`
   2. `02_functions_triggers.sql`
   3. `03_policies.sql`
   4. `05_storage.sql`
   5. `04_seed.sql` — **optional**, sample data for a fresh dev project only. Skip this in production.
3. Create your admin account and promote it to `role = 'admin'` — full steps in `AUTH.md`.
4. Copy your **Project URL** and **anon public key** from
   Settings → API.

## 2. Connect the Frontend to Supabase

Edit `js/supabase.js`:
```js
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```
The anon key is safe to publish — every table is protected by the RLS
policies in `database/03_policies.sql`. Do not put a service-role key
anywhere in this repository.

## 3. Run the Test Suite

```bash
npm test
```
See `TESTING.md` for the full automated + manual checklist. Run the
manual checklist against your live Supabase project before every deploy.

## 4. Deploy to GitHub Pages

### Option A — GitHub UI
1. Push this repository to GitHub (public, or private on a paid plan —
   GitHub Pages requires a public repo on free plans).
2. Repo → **Settings → Pages**.
3. Source: **Deploy from a branch**. Branch: `main`, folder: `/ (root)`.
4. Save. Your site will be live at
   `https://<your-username>.github.io/<repo-name>/` within a minute or two.

### Option B — Command line
```bash
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```
Then enable Pages as in Option A.

### Custom Domain (optional)
Repo → Settings → Pages → **Custom domain** → enter your domain, add the
DNS records GitHub shows you (a `CNAME` record pointing at
`<your-username>.github.io`), and check "Enforce HTTPS" once it
provisions.

## 5. Post-Deploy Verification

- [ ] Visit the live URL — homepage loads with real data, not skeletons stuck loading
- [ ] `login.html` → sign in with the admin account → reach `dashboard.html`
- [ ] Publish a test post from `editor.html`, confirm it appears on `sayings.html` and `index.html`
- [ ] Confirm image upload works from the live domain (Supabase Storage CORS is open by default, but double-check if you've customized it)
- [ ] Check the browser console for any 404s on fonts/assets (paths are relative, so a repo served from a subpath like `/repo-name/` needs those relative paths — this project already uses relative paths throughout, e.g. `css/style.css` not `/css/style.css`, specifically so it works whether it's served from the domain root or a GitHub Pages subpath)

## 6. Updating the Live Site

GitHub Pages redeploys automatically on every push to `main`:
```bash
git add .
git commit -m "Describe the change"
git push
```
No build, no CI step required — the files GitHub serves are the files
in the repo.

## 7. Environment Notes

- **No `.env` file / secrets in this repo.** The Supabase anon key in
  `js/supabase.js` is meant to be public — GitHub Pages serves static
  files with no server-side process, so there's nowhere to hide a secret
  even if you wanted to. Security is enforced entirely by RLS
  (`database/03_policies.sql`), not by hiding the key.
- **Supabase Storage CORS**: the `post-images` bucket is public-read by
  default (`database/05_storage.sql`), which covers image `<img>` tags
  and CSS `background-image` from any origin, including GitHub Pages.
- **Custom SMTP for Supabase Auth** (optional): if you want password-
  reset emails to come from your own domain rather than Supabase's
  shared sender, configure this in Supabase Dashboard → Authentication →
  Email Templates / SMTP Settings. Not required to launch.
