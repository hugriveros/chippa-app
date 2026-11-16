import { createClient } from '@supabase/supabase-js';

const url = import.meta.env?.VITE_SUPABASE_URL?.trim();
const key = (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)?.trim();

function validSupabaseUrl(value) {
  if (!value || /your-project|example|placeholder/i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || (import.meta.env?.DEV && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname));
  } catch { return false; }
}

function validPublicKey(value) {
  if (!value || value.length < 20 || /your-|example|placeholder|<|>/i.test(value) || value.startsWith('sb_secret_')) return false;
  if (value.startsWith('sb_publishable_')) return value.length > 'sb_publishable_'.length + 16;
  const payload = value.split('.')[1];
  if (payload) {
    try {
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)));
      return claims.role === 'anon';
    } catch { /* Las claves publicables nuevas no son JWT. */ }
  }
  return false;
}

export const supabaseConfigured = validSupabaseUrl(url) && validPublicKey(key);
export const supabase = supabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

