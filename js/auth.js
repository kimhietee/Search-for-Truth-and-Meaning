/**
 * auth.js — Authentication
 * EDGAR TEE
 *
 * Owns: Supabase Auth sign-in for administrators, session handling, and
 * route guarding for protected admin pages (dashboard.html, editor.html).
 * Public visitors never need an account — this module exists purely to
 * gate the admin-only pages.
 *
 * Usage:
 *   Protected page (dashboard.html / editor.html), top of its module script:
 *     import { requireAdmin } from './auth.js';
 *     const session = await requireAdmin(); // redirects to login.html if not an admin
 *
 *   login.html:
 *     import { signIn, redirectIfAuthenticated } from './auth.js';
 */

import { supabase } from './supabase.js';

/**
 * Sign in with email + password. Throws on failure so callers (login.html)
 * can display the error message inline.
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

/** Sign the current user out and send them home. */
export async function signOut(redirectTo = 'index.html') {
  await supabase.auth.signOut();
  window.location.href = redirectTo;
}

/** Returns the current Supabase session, or null if not signed in. */
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[auth] getSession error:', error.message);
    return null;
  }
  return data.session;
}

/**
 * Returns the current user's profile row (includes `role`), or null.
 * Used to distinguish admin vs. author, and to display display_name/avatar
 * in the dashboard header.
 */
export async function getCurrentProfile() {
  const session = await getCurrentSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('[auth] getCurrentProfile error:', error.message);
    return null;
  }
  return data;
}

/** True if the current user is signed in AND has role = 'admin'. */
export async function isAdmin() {
  const profile = await getCurrentProfile();
  return profile?.role === 'admin';
}

/**
 * Route guard for protected pages. Call at the top of dashboard.html /
 * editor.html's module script. Redirects to login.html if the visitor
 * isn't signed in, or isn't an admin (in which case it also signs them
 * out, since a non-admin session has no business staying active on an
 * admin page).
 *
 * Returns the active session on success (so callers don't need a second
 * getCurrentSession() call).
 */
export async function requireAdmin(redirectTo = 'login.html') {
  const session = await getCurrentSession();

  if (!session) {
    window.location.href = redirectTo;
    return null;
  }

  const admin = await isAdmin();
  if (!admin) {
    await signOut(redirectTo);
    return null;
  }

  return session;
}

/**
 * For login.html: if someone who's already an authenticated admin lands
 * on the login page, skip the form and send them straight to the
 * dashboard instead of making them log in again.
 */
export async function redirectIfAuthenticated(redirectTo = 'dashboard.html') {
  const session = await getCurrentSession();
  if (session && (await isAdmin())) {
    window.location.href = redirectTo;
  }
}

/**
 * Subscribe to auth state changes (sign in / sign out / token refresh).
 * Useful for e.g. updating a "Log In" vs "Dashboard" link in the nav
 * (wired in app.js).
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
