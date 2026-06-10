// ============================================================
// supabase.js — חיבור ל-Supabase + כל פונקציות DB
// ============================================================

const SUPABASE_URL = 'https://imllvprysqowzfufxryh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbGx2cHJ5c3Fvd3pmdWZ4cnloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDAyMTUsImV4cCI6MjA5MTk3NjIxNX0.BOMwQO0FDOsVNwGWgK7gOLns6v1mC2ADigJdR6Idm-U';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

// ============================================================
// AUTH
// ============================================================
async function sbSignIn(email, password) {
  return await sb.auth.signInWithPassword({ email, password });
}
async function sbSignOut() {
  return await sb.auth.signOut();
}

// ============================================================
// PROFILES
// ============================================================
async function getProfile(uid) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', uid).single();
  return { data, error };
}

// ============================================================
// BLOCKED
// ============================================================
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('972') && digits.length === 12) return '0' + digits.slice(3);
  return digits;
}

async function isBlocked(phone) {
  try {
    const normalized = normalizePhone(phone);
    if (!normalized) return false;
    const { data } = await sb.from('blocked_users').select('id').eq('phone', normalized).limit(1);
    return !!(data && data.length > 0);
  } catch { return false; }
}

// ============================================================
// PUBLIC DATA
// ============================================================
const STATIC_MANAGERS = [
  { id: 's1', name: 'אלישע', phone: '972535345994', role_title: 'מנהל ראשי', initials: 'א', is_active: true, display_order: 1 },
  { id: 's2', name: 'חנה',   phone: '972535346046', role_title: 'מנהלת',     initials: 'ח', is_active: true, display_order: 2 },
];

async function getManagers() {
  try {
    const { data } = await sb.from('managers').select('*').eq('is_active', true).order('display_order');
    return (data && data.length) ? data : STATIC_MANAGERS;
  } catch { return STATIC_MANAGERS; }
}

async function getPackages() {
  try {
    const { data, error } = await sb.from('purchase_packages').select('*').eq('is_active', true).order('display_order', { nullsFirst: false });
    if (error) { console.error('getPackages:', error.message, error.code); return []; }
    return data || [];
  } catch(e) { console.error('getPackages exception:', e); return []; }
}

async function getSiteSettings() {
  try {
    const { data } = await sb.from('site_settings').select('*').limit(1).single();
    return data || { site_enabled: true, announcement_enabled: false };
  } catch { return { site_enabled: true, announcement_enabled: false }; }
}

async function getVipSettings() {
  try {
    const { data } = await sb.from('vip_settings').select('*').limit(1).single();
    return data || {};
  } catch { return {}; }
}

// ============================================================
// ADMIN
// ============================================================
async function adminGetPackages() {
  const { data } = await sb.from('purchase_packages').select('*').order('display_order');
  return data || [];
}

async function adminSavePackage(pkg) {
  if (pkg.id) {
    const { id, created_at, ...f } = pkg;
    const { error } = await sb.from('purchase_packages').update(f).eq('id', id);
    return { error };
  }
  const { error } = await sb.from('purchase_packages').insert(pkg);
  return { error };
}

async function adminDeletePackage(id) {
  const { error } = await sb.from('purchase_packages').delete().eq('id', id);
  return { error };
}

async function adminGetManagers() {
  const { data } = await sb.from('managers').select('*').order('display_order');
  return data || [];
}

async function adminSaveManager(mgr) {
  if (mgr.id) {
    const { id, created_at, ...f } = mgr;
    const { error } = await sb.from('managers').update(f).eq('id', id);
    return { error };
  }
  const { error } = await sb.from('managers').insert(mgr);
  return { error };
}

async function adminDeleteManager(id) {
  const { error } = await sb.from('managers').delete().eq('id', id);
  return { error };
}

async function adminSaveSiteSettings(fields) {
  const { data } = await sb.from('site_settings').select('id').limit(1).single();
  if (data?.id) {
    const { error } = await sb.from('site_settings').update(fields).eq('id', data.id);
    return { error };
  }
  const { error } = await sb.from('site_settings').insert(fields);
  return { error };
}

async function adminSaveVip(fields) {
  const { data } = await sb.from('vip_settings').select('id').limit(1).single();
  if (data?.id) {
    const { error } = await sb.from('vip_settings').update(fields).eq('id', data.id);
    return { error };
  }
  const { error } = await sb.from('vip_settings').insert(fields);
  return { error };
}

