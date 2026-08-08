/**
 * supabase.js — Supabase Client (Single Source of Truth)
 * EDGAR TEE
 *
 * Owns: Initializes and exports ONE Supabase client instance using the
 * project URL + anon public key. Every other module (auth, posts, editor,
 * dashboard, search) imports { supabase } from here — never creates its
 * own client, so there is exactly one connection/session source of truth.
 *
 * Loaded via CDN ESM build (no bundler/build step, per project constraints).
 *
 * SETUP: Replace SUPABASE_URL and SUPABASE_ANON_KEY below with your
 * project's values from Supabase Dashboard → Settings → API. The anon
 * key is safe to expose client-side — it only grants what Row Level
 * Security (see database/03_policies.sql) allows.
 *
 * Full data-layer integration (posts.js, editor.js queries, Storage
 * uploads) is wired in Module 10; this file just establishes the client
 * so Module 3 (Authentication) has something to authenticate against.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// TODO: replace with your actual project values before deploying
const SUPABASE_URL = 'https://vhkgpzxqphnaqbpjlmzw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoa2dwenhxcGhuYXFicGpsbXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4ODYyNTYsImV4cCI6MjEwMTQ2MjI1Nn0.OOjCALFJxRIQJvU0cAMrjb3XrwnAbPZ_2pfu2thWtD0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
