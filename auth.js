// ============================================================
// auth.js — התחברות, הרשמה, יציאה
// ============================================================

// ============================================================
// הרשמה
// ============================================================
async function doRegister() {
  const firstName = v('rfn').trim();
  const lastName  = v('rln').trim();
  const phone     = v('rph').trim();
  const email     = v('rem').trim().toLowerCase();
  const password  = v('rpw').trim();

  clearErrs(['e-rfn','e-rln','e-rph','e-rem','e-rpw']);
  hideAlert('r-alert');

  let ok = true;
  if (!firstName)                       { showFieldErr('e-rfn','אנא הכנס שם פרטי'); ok=false; }
  if (!lastName)                        { showFieldErr('e-rln','אנא הכנס שם משפחה'); ok=false; }
  if (!phone || phone.length < 9)       { showFieldErr('e-rph','מספר טלפון לא תקין'); ok=false; }
  if (!email || !email.includes('@'))   { showFieldErr('e-rem','אימייל לא תקין'); ok=false; }
  if (!password || password.length < 8) { showFieldErr('e-rpw','סיסמה חייבת להיות לפחות 8 תווים'); ok=false; }
  if (!ok) return;

  setBtnLoading('btn-register', true);

  // בדיקת חסימה לפי טלפון ואימייל לפני הרשמה
  const blocked = await isBlocked(phone, email);
  if (blocked) {
    showAlert('r-alert', 'משתמש זה חסום. לפרטים פנה למנהל.', 'red');
    setBtnLoading('btn-register', false);
    return;
  }

  const { data, error } = await sbSignUp(email, password, { first_name: firstName, last_name: lastName, phone });

  if (error) {
    showAlert('r-alert', translateError(error.message), 'red');
    setBtnLoading('btn-register', false);
    return;
  }

  setBtnLoading('btn-register', false);

  if (data?.session && data?.user) {
    // מחובר מיידית (Email Confirm = OFF)
    // יוצר profile + balance
    await ensureProfileAndBalance(data.user, { first_name: firstName, last_name: lastName, phone });
    currentUser = data.user;
    const { data: profile } = await getProfile(data.user.id);
    currentProfile = profile;
    updateNav();
    go('dashboard');
    toast('ברוכים הבאים, ' + firstName + ' 👋');
  } else if (data?.user) {
    // ממתין לאימות אימייל
    showAlert('r-alert', '✅ נרשמת בהצלחה! אנא בדוק את האימייל שלך לאימות.', 'green');
  } else {
    showAlert('r-alert', 'שגיאה בהרשמה. נסה שוב.', 'red');
  }
}

// יצירה בטוחה של profile + balance (אם לא קיימים)
async function ensureProfileAndBalance(user, meta) {
  try {
    const { data: existing } = await getProfile(user.id);
    if (!existing) {
      await createProfile(user.id, {
        first_name: meta?.first_name || user.user_metadata?.first_name || '',
        last_name:  meta?.last_name  || user.user_metadata?.last_name  || '',
        phone:      meta?.phone      || user.user_metadata?.phone      || ''
      });
    }
    await initBalance(user.id);
  } catch(e) {
    console.error('ensureProfileAndBalance error:', e);
  }
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

  setBtnLoading('btn-login', true);

  // בדיקת חסימה לפי אימייל לפני כניסה
  const blockedEmail = await isBlocked(null, email);
  if (blockedEmail) {
    showAlert('l-alert', 'משתמש זה חסום. לפרטים פנה למנהל.', 'red');
    setBtnLoading('btn-login', false);
    return;
  }

  const { data, error } = await sbSignIn(email, password);

  setBtnLoading('btn-login', false);

  if (error) {
    showAlert('l-alert', translateError(error.message), 'red');
    return;
  }

  const { data: profile } = await getProfile(data.user.id);

  // בדיקת חסימה לפי טלפון (מהפרופיל)
  if (profile?.phone) {
    const blockedPhone = await isBlocked(profile.phone, null);
    if (blockedPhone) {
      await sbSignOut();
      currentUser = null; currentProfile = null;
      showAlert('l-alert', 'משתמש זה חסום. לפרטים פנה למנהל.', 'red');
      updateNav();
      return;
    }
  }

  currentUser    = data.user;
  currentProfile = profile;

  // וודא שיש profile ו-balance (למקרה שנוצר ידנית)
  await ensureProfileAndBalance(data.user, null);

  updateNav();
  go('dashboard');
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
