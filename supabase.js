// ============================================================
// supabase.js — חיבור ל-Supabase + כל פונקציות DB
// ============================================================

const SUPABASE_URL = 'https://imllvprysqowzfufxryh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbGx2cHJ5c3Fvd3pmdWZ4cnloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDAyMTUsImV4cCI6MjA5MTk3NjIxNX0.BOMwQO0FDOsVNwGWgK7gOLns6v1mC2ADigJdR6Idm-U';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// ============================================================
// AUTH
// ============================================================
async function sbSignUp(email, password, meta) {
  return await sb.auth.signUp({ email, password, options: { data: meta } });
}
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

async function createProfile(uid, { first_name, last_name, phone }) {
  const { data, error } = await sb
    .from('profiles')
    .upsert({ id: uid, first_name, last_name, phone, role: 'user' }, { onConflict: 'id' })
    .select().single();
  return { data, error };
}

// ============================================================
// BLOCKED
// ============================================================
async function isBlocked(phone, email) {
  try {
    const conditions = [];
    if (phone?.trim()) conditions.push(`phone.eq.${phone.trim()}`);
    if (email?.trim()) conditions.push(`email.eq.${email.trim().toLowerCase()}`);
    if (!conditions.length) return false;
    const { data } = await sb.from('blocked_users').select('id').or(conditions.join(',')).limit(1);
    return !!(data && data.length > 0);
  } catch { return false; }
}

// ============================================================
// SHIDDUCH CARDS
// ============================================================
async function getCards(uid) {
  const { data, error } = await sb
    .from('shidduch_cards').select('*')
    .eq('user_id', uid).order('created_at', { ascending: false });
  return { data: data || [], error };
}

async function saveCard(uid, card) {
  if (card.id) {
    // UPDATE
    const { id, user_id, created_at, ...fields } = card;
    const { data, error } = await sb
      .from('shidduch_cards').update(fields)
      .eq('id', id).eq('user_id', uid).select().single();
    return { data, error };
  } else {
    // INSERT — הסר id אם undefined/null
    const clean = Object.fromEntries(
      Object.entries(card).filter(([k, v]) => k !== 'id' && v !== undefined && v !== null)
    );
    const { data, error } = await sb
      .from('shidduch_cards').insert({ ...clean, user_id: uid }).select().single();
    return { data, error };
  }
}

async function deleteCard(uid, cardId) {
  const { error } = await sb
    .from('shidduch_cards').delete()
    .eq('id', cardId).eq('user_id', uid);
  return { error };
}

async function toggleFavorite(uid, cardId, isFav) {
  const { error } = await sb
    .from('shidduch_cards').update({ is_favorite: isFav })
    .eq('id', cardId).eq('user_id', uid);
  return { error };
}

// ============================================================
// BALANCE
// ============================================================
async function getBalance(uid) {
  try {
    const { data } = await sb
      .from('user_publication_balances')
      .select('available_publications').eq('user_id', uid).single();
    return data?.available_publications ?? 0;
  } catch { return 0; }
}

async function initBalance(uid) {
  return await sb
    .from('user_publication_balances')
    .upsert({ user_id: uid, available_publications: 0 }, { onConflict: 'user_id' });
}

async function decrementBalance(uid) {
  const current = await getBalance(uid);
  if (current <= 0) return { error: { message: 'אין פרסומים זמינים' } };
  const { error } = await sb
    .from('user_publication_balances')
    .upsert({ user_id: uid, available_publications: current - 1 }, { onConflict: 'user_id' });
  return { error };
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
    const { data } = await sb.from('purchase_packages').select('*').eq('is_active', true).order('display_order');
    return data || [];
  } catch { return []; }
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
async function adminGetBlocked() {
  const { data } = await sb.from('blocked_users').select('*').order('created_at', { ascending: false });
  return data || [];
}

async function adminBlockUser({ phone, email, reason }) {
  return await sb.from('blocked_users').insert({
    phone: phone || null,
    email: email?.toLowerCase() || null,
    reason: reason || ''
  });
}

async function adminUnblock(id) {
  const { error } = await sb.from('blocked_users').delete().eq('id', id);
  return { error };
}

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

async function getProfileByPhone(phone) {
  const { data, error } = await sb
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('phone', phone.trim())
    .single();
  return { data, error };
}

async function adminAddPublications(userId, count) {
  const current = await getBalance(userId);
  const { error } = await sb
    .from('user_publication_balances')
    .upsert({ user_id: userId, available_publications: current + count }, { onConflict: 'user_id' });
  return { error };
}
