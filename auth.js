// ============================================================
// auth.js — התחברות, הרשמה, יציאה
// ============================================================

// helper — קריאת ערך שדה (מוגדר גם כאן למקרה שנטען לפני app.js)
function v(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

// ============================================================
// תקנון — הסתרת תיבת הסימון אם כבר אושר
// ============================================================
function applyTermsUI() {
  const accepted = localStorage.getItem('sb_terms_accepted') === '1';
  const wrap = document.getElementById('terms-wrap-login');
  if (wrap) wrap.style.display = accepted ? 'none' : 'block';
}

// ============================================================
// כניסה
// ============================================================
async function doLogin() {
  const email    = v('lem').trim().toLowerCase();
  const password = v('lpw').trim();

  clearErrs(['e-lem','e-lpw']);
  hideAlert('l-alert');

  if (!email)    { showFieldErr('e-lem','אנא הכנס אימייל'); return; }
  if (!password) { showFieldErr('e-lpw','אנא הכנס סיסמה'); return; }

  // בדיקת תקנון
  const termsWrap = document.getElementById('terms-wrap-login');
  if (termsWrap && termsWrap.style.display !== 'none') {
    const termsCheck = document.getElementById('terms-check-login');
    if (!termsCheck?.checked) {
      showAlert('l-alert', 'עליך לאשר את תקנון האתר כדי להתחבר', 'red');
      return;
    }
  }

  setBtnLoading('btn-login', true);

  const { data, error } = await sbSignIn(email, password);

  setBtnLoading('btn-login', false);

  if (error) {
    showAlert('l-alert', translateError(error.message), 'red');
    return;
  }

  const { data: profile } = await getProfile(data.user.id);

  // בדיקת חסימה לפי טלפון (מהפרופיל)
  if (profile?.phone) {
    const blockedPhone = await isBlocked(profile.phone);
    if (blockedPhone) {
      await sbSignOut();
      currentUser = null; currentProfile = null;
      showAlert('l-alert', 'משתמש זה חסום. לפרטים פנה למנהל.', 'red');
      updateNav();
      return;
    }
  }

  localStorage.setItem('sb_terms_accepted', '1');
  currentUser    = data.user;
  currentProfile = profile;

  updateNav();
  go(profile?.role === 'admin' ? 'admin' : 'home');
  toast('ברוכים הבאים, ' + (profile?.first_name || '') + ' 👋');
}

// ============================================================
// יציאה
// ============================================================
async function doLogout() {
  await sbSignOut();
  currentUser    = null;
  currentProfile = null;
  updateNav();
  go('home');
  toast('👋 יצאת בהצלחה');
}

// ============================================================
// עזר
// ============================================================
function translateError(msg) {
  if (!msg) return 'שגיאה לא ידועה';
  if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('User already registered'))
    return 'כתובת האימייל כבר רשומה במערכת';
  if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials'))
    return 'אימייל או סיסמה שגויים';
  if (msg.includes('Email not confirmed'))
    return 'אנא אמת את האימייל שלך לפני הכניסה';
  if (msg.includes('Too many requests') || msg.includes('rate limit'))
    return 'יותר מדי ניסיונות. המתן מספר דקות.';
  if (msg.includes('Password should be'))
    return 'הסיסמה חייבת להכיל לפחות 8 תווים';
  return msg;
}

function showFieldErr(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearErrs(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function showAlert(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'al ' + (type === 'red' ? 'al-red' : type === 'green' ? 'al-green' : 'al-gold');
  el.style.display = 'block';
}

function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function setBtnLoading(id, loading) {
  const el = document.getElementById(id);
  if (!el) return;
  el.disabled = loading;
  if (!el.dataset.orig) el.dataset.orig = el.textContent;
  el.textContent = loading ? 'רגע...' : el.dataset.orig;
}
