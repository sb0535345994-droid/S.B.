// ============================================================
// app.js — לוגיקה ראשית
// ============================================================

let currentUser    = null;
let currentProfile = null;
let userCards      = [];
let userBalance    = 0;
let siteManagers   = [];
let sitePackages   = [];
let siteSettings   = {};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {

  await loadPublicData();
  renderWAFloat();

  if (siteSettings.site_enabled === false) {
    showSiteClosed();
    return;
  }

  // האזנה ל-auth state (כולל שחזור session אחרי רענון)
  sb.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      currentUser = session.user;
      const { data } = await getProfile(session.user.id);
      currentProfile = data;
      // וודא profile + balance קיימים
      if (!data) await ensureProfileAndBalance(session.user, null);
    } else {
      currentUser    = null;
      currentProfile = null;
    }
    updateNav();
  });

  if (siteSettings.announcement_enabled && siteSettings.announcement_text) {
    showAnnouncement(siteSettings.announcement_text);
  }

  initPills();
  updatePreview();
  showBuilderStep(1);

  const hash = location.hash.replace('#', '') || 'home';
  go(hash, false);
});

async function loadPublicData() {
  const [settings, managers, packages] = await Promise.all([
    getSiteSettings(),
    getManagers(),
    getPackages()
  ]);
  siteSettings = settings;
  siteManagers = managers;
  sitePackages = packages;
}

// ============================================================
// NAV
// ============================================================
function updateNav() {
  const navAuth  = document.getElementById('na');
  const navUser  = document.getElementById('nu');
  const navName  = document.getElementById('nname');
  const navAv    = document.getElementById('navi');
  const mobAuth  = document.getElementById('ma');
  const mobUser  = document.getElementById('mur');
  const mobName  = document.getElementById('mun');
  const adminBtn = document.getElementById('admin-nav-btn');
  const mobDash  = document.getElementById('mob-dash-btn');
  const mobAdmin = document.getElementById('mob-admin-btn');

  if (currentProfile) {
    navAuth && (navAuth.style.display = 'none');
    navUser && (navUser.style.display = 'flex');
    navName && (navName.textContent = currentProfile.first_name);
    navAv   && (navAv.textContent   = currentProfile.first_name?.[0] || 'א');
    mobAuth && (mobAuth.style.display = 'none');
    mobUser && (mobUser.style.display = 'block');
    mobName && (mobName.textContent = currentProfile.first_name + ' ' + currentProfile.last_name);
    mobDash && (mobDash.style.display = 'block');
    const isAdmin = currentProfile.role === 'admin';
    if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    if (mobAdmin) mobAdmin.style.display = isAdmin ? 'block' : 'none';
  } else {
    navAuth && (navAuth.style.display = 'flex');
    navUser && (navUser.style.display = 'none');
    mobAuth && (mobAuth.style.display = 'flex');
    mobUser && (mobUser.style.display = 'none');
    mobDash && (mobDash.style.display = 'none');
    if (adminBtn) adminBtn.style.display = 'none';
    if (mobAdmin) mobAdmin.style.display = 'none';
  }

  const blp = document.getElementById('blp');
  if (blp) blp.style.display = currentProfile ? 'none' : 'block';
}

// ============================================================
// ניווט
// ============================================================
function go(name, pushState = true) {
  if (name === 'dashboard' && !currentUser) { go('login'); return; }
  if (name === 'admin') {
    if (!currentUser || currentProfile?.role !== 'admin') { go('home'); return; }
    loadAdmin();
  }
  if (name === 'publish' && !currentUser) {
    toast('יש להתחבר כדי לפרסם');
    go('login');
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + name);
  if (pg) pg.classList.add('active');
  else { go('home'); return; }

  document.querySelectorAll('.nl').forEach(l => l.classList.remove('active'));
  const nlMap = { about: 'על הערוץ', rules: 'תקנון', builder: 'יצירת', publish: 'פרסום' };
  if (nlMap[name]) {
    document.querySelectorAll('.nl').forEach(l => {
      if (l.textContent.includes(nlMap[name])) l.classList.add('active');
    });
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (pushState) { try { history.pushState({ page: name }, '', '#' + name); } catch(e) {} }

  if (name === 'dashboard') loadDashboard();
  if (name === 'publish')   initPublish();
  if (name === 'login' || name === 'register') {
    if (typeof applyTermsUI === 'function') applyTermsUI();
  }

  document.getElementById('md')?.classList.remove('open');
}

window.addEventListener('popstate', e => go(e.state?.page || 'home', false));

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  if (!currentUser) return;

  const [cardsRes, balance] = await Promise.all([
    getCards(currentUser.id),
    getBalance(currentUser.id)
  ]);

  userCards   = cardsRes.data || [];
  userBalance = balance;

  const elName  = document.getElementById('dash-name');
  const elBal   = document.getElementById('dash-balance');
  const elCount = document.getElementById('dash-card-count');
  if (elName)  elName.textContent  = currentProfile?.first_name || '';
  if (elBal)   elBal.textContent   = userBalance;
  if (elCount) elCount.textContent = userCards.length;

  renderDashCards();
  checkReminder();
}

function renderDashCards() {
  const favEl  = document.getElementById('dash-favs');
  const listEl = document.getElementById('dash-cards-list');
  if (!listEl) return;

  const favs    = userCards.filter(c => c.is_favorite);
  const regular = userCards.filter(c => !c.is_favorite);

  if (favEl) {
    favEl.style.display = favs.length ? 'block' : 'none';
    const inner = favEl.querySelector('.dash-cards-inner');
    if (inner) inner.innerHTML = favs.map(cardRow).join('');
  }

  if (!userCards.length) {
    listEl.innerHTML = `<div class="empty-state">
      <div style="font-size:48px;margin-bottom:12px">📝</div>
      <p>עדיין אין כרטיסים. <a onclick="go('builder')" style="color:var(--gold-d);font-weight:700;cursor:pointer">צור כרטיס ראשון ←</a></p>
    </div>`;
    return;
  }
  listEl.innerHTML = regular.map(cardRow).join('');
}

function cardRow(c) {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'ללא שם';
  return `<div class="dash-card-row">
    <div class="dash-card-name">${esc(name)}</div>
    <div class="dash-card-actions">
      <button class="dash-action-btn ${c.is_favorite?'fav-active':''}" title="מועדף" onclick="toggleFav('${c.id}',${!c.is_favorite})">⭐</button>
      <button class="dash-action-btn" title="ערוך" onclick="editCard('${c.id}')">✏️</button>
      <button class="dash-action-btn" title="העתק" onclick="copyCard('${c.id}')">📋</button>
      <button class="dash-action-btn" title="מחק" onclick="confirmDeleteCard('${c.id}')">🗑️</button>
    </div>
  </div>`;
}

async function toggleFav(cardId, isFav) {
  const { error } = await toggleFavorite(currentUser.id, cardId, isFav);
  if (error) { toast('שגיאה: ' + error.message); return; }
  await loadDashboard();
}

async function copyCard(cardId) {
  const card = userCards.find(c => c.id === cardId);
  if (!card) return;
  copyToClipboard(buildText(card), () => toast('הועתק! ✓'));
}

async function editCard(cardId) {
  const card = userCards.find(c => c.id === cardId);
  if (!card) return;
  currentCardId = card.id;
  loadCardToForm(card);
  go('builder');
}

async function confirmDeleteCard(cardId) {
  if (!confirm('למחוק כרטיס זה לצמיתות?')) return;
  const { error } = await deleteCard(currentUser.id, cardId);
  if (error) { toast('שגיאה במחיקה: ' + error.message); return; }
  toast('כרטיס נמחק');
  await loadDashboard();
}

function checkReminder() {
  const rem = document.getElementById('dash-reminder');
  if (!rem || !userCards.length) { if (rem) rem.style.display='none'; return; }
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const hasOld = userCards.some(c => new Date(c.updated_at).getTime() < sevenDaysAgo);
  rem.style.display = hasOld ? 'block' : 'none';
}

// ============================================================
// PUBLISH
// ============================================================
let selectedPackage = null;
let selectedManager = null;

async function initPublish() {
  await loadPublicData();
  if (currentUser) {
    const res = await getCards(currentUser.id);
    userCards = res.data || [];
  }
  renderPackages();
  renderManagersSelect();
  goPayStep(1);
}

function renderPackages() {
  const el = document.getElementById('pkg-list');
  if (!el) return;
  if (!sitePackages.length) {
    el.innerHTML = '<p style="color:var(--is)">אין מסלולים זמינים כרגע</p>';
    return;
  }
  el.innerHTML = sitePackages.map(p => `
    <div class="pcard ${p.is_popular?'feat':''}" onclick="selectPackage('${p.id}')">
      ${p.marketing_label ? `<div class="pbadge">${esc(p.marketing_label)}</div>` : ''}
      <div class="pname">${esc(p.name)}</div>
      <div class="pdesc">${esc(p.description)}</div>
      <div><span class="pcur">₪</span><span class="pamt">${p.price}</span></div>
      <ul class="pfeat">
        <li>${p.publications_count} פרסום${p.publications_count>1?'ים':''} בערוץ</li>
        <li>דיסקרטיות מלאה</li>
      </ul>
      <button class="btn btn-gold btn-full">בחירה ←</button>
    </div>`).join('');
}

function selectPackage(pkgId) {
  selectedPackage = sitePackages.find(p => p.id === pkgId);
  if (!selectedPackage) return;
  const el = document.getElementById('selected-pkg-name');
  if (el) el.textContent = `${selectedPackage.name} — ₪${selectedPackage.price}`;
  goPayStep(2);
}

function renderManagersSelect() {
  const el = document.getElementById('managers-list');
  if (!el) return;
  if (!siteManagers.length) {
    el.innerHTML = '<p style="color:var(--is)">אין מנהלים זמינים כרגע</p>';
    return;
  }
  el.innerHTML = siteManagers.map(m => `
    <button class="mgr-btn" onclick="selectManager('${m.id}')">
      <div class="mgr-btn-av">${esc(m.initials || m.name?.[0] || 'מ')}</div>
      <div>
        <div class="mgr-btn-name">${esc(m.name)}</div>
        <div class="mgr-btn-role">${esc(m.role_title || '')}</div>
      </div>
    </button>`).join('');
}

function selectManager(mgrId) {
  selectedManager = siteManagers.find(m => m.id === mgrId);
  if (!selectedManager) return;
  if (userCards.length > 0) {
    openPickCardModal();
  } else {
    // פתח WA ללא כרטיס — בלי טקסט אוטומטי
    const phone = selectedManager.phone.replace(/\D/g,'');
    window.open('https://wa.me/' + phone, '_blank');
  }
}

function goPayStep(n) {
  [1,2,3].forEach(i => {
    const el = document.getElementById('pay-step' + i);
    if (el) el.style.display = i === n ? 'block' : 'none';
  });
  if (n === 2) {
    const linkEl = document.getElementById('pay-link-btn');
    if (linkEl) {
      linkEl.innerHTML = selectedPackage?.payment_link
        ? `<a href="${esc(selectedPackage.payment_link)}" target="_blank" rel="noopener noreferrer"
            style="display:inline-flex;align-items:center;gap:10px;background:#003087;color:#fff;font-weight:700;font-size:15px;padding:13px 28px;border-radius:50px;text-decoration:none;box-shadow:0 4px 18px rgba(0,48,135,.3);margin-bottom:20px">
            💳 לתשלום מאובטח עם PayPal
           </a>`
        : '';
    }
  }
}

function openPickCardModal() {
  const el   = document.getElementById('pick-card-modal');
  const list = document.getElementById('pick-card-list');
  if (!el || !list) return;
  if (!userCards.length) {
    list.innerHTML = `<p style="color:var(--is);padding:10px 0">עדיין אין כרטיסים שמורים. <a onclick="closeModal('pick-card-modal');go('builder')" style="color:var(--gold-d);font-weight:700;cursor:pointer">צור כרטיס ←</a></p>`;
  } else {
    list.innerHTML = userCards.map(c => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'ללא שם';
      return `<button class="pick-card-btn" onclick="sendCardToManager('${c.id}')">${esc(name)}</button>`;
    }).join('');
  }
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function sendCardToManager(cardId) {
  const card = userCards.find(c => c.id === cardId);
  if (!card || !selectedManager) return;
  // שולח רק תוכן הכרטיס — ללא הודעת פתיחה אוטומטית
  const txt = buildText(card);
  const phone = selectedManager.phone.replace(/\D/g,'');
  window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(txt), '_blank');
  closeModal('pick-card-modal');
}

// ============================================================
// BUILDER
// ============================================================
let cbStep = 1;
const TOTAL_STEPS = 4;
let currentCardId = null;

function showBuilderStep(n) {
  cbStep = n;
  for (let i = 1; i <= 5; i++) {
    const p    = document.getElementById('p' + i);
    const pill = document.getElementById('pp' + i);
    if (p)    p.classList.toggle('active', i === n);
    if (pill) {
      pill.classList.toggle('active', i === n);
      pill.classList.toggle('done', i < n);
    }
  }
  const back  = document.getElementById('cbb');
  const fwd   = document.getElementById('cnext-btn');
  const label = document.getElementById('cpp2');
  if (back)  back.style.visibility = n > 1 ? 'visible' : 'hidden';
  if (fwd) {
    if (n === 5) { fwd.style.display = 'none'; }
    else { fwd.style.display = ''; fwd.textContent = n === TOTAL_STEPS ? 'סיים ←' : 'הבא ←'; }
  }
  if (label) label.textContent = n <= TOTAL_STEPS ? `שלב ${n} מתוך ${TOTAL_STEPS}` : '';
  updateProgressBar();
}

function cnext() {
  if (cbStep === 1 && !validateStep1()) return;
  if (cbStep === TOTAL_STEPS) { finishCard(); return; }
  showBuilderStep(cbStep + 1);
}
function cprev() { if (cbStep > 1) showBuilderStep(cbStep - 1); }

function validateStep1() {
  let ok = true;
  if (!v('fn').trim()) { se('en'); ok=false; } else { he('en'); }
  const age = parseInt(v('fa'));
  if (!age || age < 18) { se('ea'); ok=false; } else { he('ea'); }
  return ok;
}

function validateStep4() {
  let ok = true;
  if (!v('fab').trim())  { se('eab'); ok=false; } else { he('eab'); }
  if (!v('flk').trim())  { se('elk'); ok=false; } else { he('elk'); }
  if (!v('fcn').trim())  { se('ecn'); ok=false; } else { he('ecn'); }
  if (!v('fct2').trim()) { se('ect'); ok=false; } else { he('ect'); }
  return ok;
}

async function finishCard() {
  if (!validateStep4()) return;
  const card = collectCard();

  if (currentUser) {
    const payload = currentCardId ? { ...card, id: currentCardId } : card;
    const { data, error } = await saveCard(currentUser.id, payload);
    if (error) { toast('שגיאה בשמירה: ' + error.message); return; }
    if (data?.id) currentCardId = data.id;
    const res = await getCards(currentUser.id);
    userCards = res.data || [];
    const scn = document.getElementById('scn');
    if (scn) scn.style.display = 'block';
  }

  const txt = buildText(card);
  window._card  = txt;
  window._cdata = card;
  const fct = document.getElementById('fct');
  const lp  = document.getElementById('lp');
  if (fct) fct.textContent = txt;
  if (lp)  lp.textContent  = txt;
  showBuilderStep(5);
}

function collectCard() {
  const buildVal   = v('fb')==='אחר'  ? (v('fb-other')||'אחר')  : v('fb');
  const sectorVal  = v('fs')==='אחר'  ? (v('fs-other')||'אחר')  : v('fs');
  const eduVal     = v('fed')==='אחר' ? (v('fed-other')||'אחר') : v('fed');
  const coverVal   = v('fcv')==='אחר' ? (v('fcv-other')||'אחר') : v('fcv');
  const serviceVal = v('fse')==='אחר' ? (v('fse-other')||'אחר') : v('fse');
  return {
    first_name:    v('fn').trim(),
    last_name:     v('fln').trim(),
    age:           v('fa'),
    height:        v('fh'),
    build:         buildVal,
    edah:          v('fe'),
    city:          v('fc'),
    sector:        sectorVal,
    marital_status:v('fst'),
    kids:          v('fk'),
    kids_detail:   v('fkd'),
    edu:           eduVal,
    service:       serviceVal,
    job:           v('fj'),
    family_bg:     v('ff'),
    cover:         coverVal,
    touch:         v('ft'),
    smoke:         v('fsm'),
    phone_type:    v('fph'),
    about:         v('fab'),
    looking:       v('flk'),
    contact_name:  v('fcn'),
    contact_phone: v('fct2'),
  };
}

// טוען select — אם הערך לא ברשימה, בוחר "אחר" ומציג שדה חופשי
function loadSelectOrOther(selId, otherInputId, val, onchangeFn) {
  if (!val) return;
  const el = document.getElementById(selId);
  if (!el) return;
  const stdVals = Array.from(el.options).map(o => o.value || o.text).filter(Boolean);
  if (stdVals.includes(val)) {
    selOpt(selId, val);
    onchangeFn(val);
  } else {
    selOpt(selId, 'אחר');
    sv(otherInputId, val);
    onchangeFn('אחר');
  }
}

// טוען pill group — אם הערך לא ברשימה, בוחר "אחר" ומציג שדה חופשי
function loadPillOrOther(grpId, hidId, otherInputId, val, stdOpts) {
  if (!val) return;
  const h = document.getElementById(hidId);
  if (h) h.value = val;
  if (stdOpts.includes(val)) {
    const grp = document.getElementById(grpId);
    if (grp) grp.querySelectorAll('.pill').forEach(p => {
      const inp = p.querySelector('input');
      if (inp && inp.value === val) {
        p.classList.add('sel');
        const entry = Object.entries(PGS).find(([id]) => id === grpId);
        if (entry && entry[1].cb) entry[1].cb(val);
      }
    });
  } else {
    // ערך מותאם אישית — בחר "אחר" וצג שדה
    const grp = document.getElementById(grpId);
    if (grp) grp.querySelectorAll('.pill').forEach(p => {
      const inp = p.querySelector('input');
      if (inp && inp.value === 'אחר') p.classList.add('sel');
    });
    const other = document.getElementById(otherInputId);
    if (other) { other.value = val; other.style.display = 'block'; }
    if (h) h.value = val;
  }
}

function loadCardToForm(c) {
  sv('fn',c.first_name); sv('fln',c.last_name);
  sv('fa',c.age); sv('fh',c.height);
  sv('fe',c.edah); sv('fc',c.city);
  sv('fj',c.job); sv('ff',c.family_bg);
  sv('fab',c.about); sv('flk',c.looking);
  sv('fcn',c.contact_name); sv('fct2',c.contact_phone);
  sv('fkd',c.kids_detail||'');

  loadSelectOrOther('fb',  'fb-other',  c.build||'',  chkBuild);
  loadSelectOrOther('fs',  'fs-other',  c.sector||'', chkSector);
  loadSelectOrOther('fed', 'fed-other', c.edu||'',    chkEdu);

  sp2('fst',c.marital_status);
  sp2('fk',c.kids);
  loadPillOrOther('pg-cv','fcv','fcv-other', c.cover||'',   ['מטפחת','פאה','אחר']);
  loadPillOrOther('pg-se','fse','fse-other', c.service||'', ['צבאי','לאומי','ישיבה','כולל','פטור','לא רלוונטי','אחר']);
  sp2('ft',c.touch);
  sp2('fsm',c.smoke);
  sp2('fph',c.phone_type);

  const fkd = document.getElementById('fkd');
  if (fkd) fkd.style.display = c.kids==='כן' ? 'block' : 'none';

  showBuilderStep(1);
  updatePreview();
}

function newCard() {
  currentCardId = null;
  document.querySelectorAll('#bform input:not([type=hidden]), #bform textarea, #bform select').forEach(el => el.value='');
  document.querySelectorAll('#bform input[type=hidden]').forEach(el => el.value='');
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('sel'));
  ['fb-other','fs-other','fed-other','fcv-other','fse-other','fkd'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display='none';
  });
  const scn = document.getElementById('scn');
  if (scn) scn.style.display='none';
  showBuilderStep(1);
  updatePreview();
}

// ============================================================
// TEXT BUILDER
// ============================================================
function buildText(d) {
  const fullName = [d.first_name,d.last_name].filter(Boolean).join(' ') || '–';
  const kids = d.kids==='כן' ? (d.kids_detail?'כן – '+d.kids_detail:'כן') : (d.kids||'–');
  return [
    '💍 כרטיס שידוך',
    '⚠️ יש לפנות רק לאחר קריאת הכרטיס ובמידה ויש התאמה בסיסית.',
    'יש לפנות עם שם ותמונת פרופיל בלבד ובטווח גיל מתאים.',
    '',
    '🔹 שם: '           + fullName,
    '🔹 גיל: '          + (d.age||'–'),
    '🔹 גובה: '         + (d.height||'–'),
    '🔹 מבנה גוף: '     + (d.build||'–'),
    '🔹 עדה: '          + (d.edah||'–'),
    '',
    '🏡 אזור מגורים: '      + (d.city||'–'),
    '🙏 מגזר / סגנון דתי: ' + (d.sector||'–'),
    '📌 סטטוס: '            + (d.marital_status||'–'),
    ...(d.kids?['👶 ילדים: '+kids]:[]),
    '🎓 השכלה: '  + (d.edu||'–'),
    '🎖️ שירות: '  + (d.service||'–'),
    '💼 עיסוק: '  + (d.job||'–'),
    '',
    '👨‍👩‍👧 רקע משפחתי: '  + (d.family_bg||'–'),
    '👑 כיסוי ראש: '   + (d.cover||'–'),
    '🤝 שומר/ת נגיעה: '+ (d.touch||'–'),
    '🚬 מעשן/ת: '       + (d.smoke||'–'),
    '📱 סוג טלפון: '   + (d.phone_type||'–'),
    '',
    '✨ קצת עליי:', (d.about||'–'),
    '',
    '💍 מה אני מחפש/ת:', (d.looking||'–'),
    '',
    '📩 לפניות בהודעת וואטסאפ בלבד:',
    '👤 שם: '   + (d.contact_name||'–'),
    '📞 טלפון: '+ (d.contact_phone||'–'),
  ].join('\n');
}

function updatePreview() {
  const card = collectCard();
  const txt  = buildText(card);
  window._card = txt;
  const lp = document.getElementById('lp');
  if (lp) lp.textContent = txt;
}

// ============================================================
// PILLS
// ============================================================
const PGS = {
  'pg-st':{ hid:'fst', opts:['רווק/ה','גרוש/ה','אלמן/ה'] },
  'pg-k': { hid:'fk',  opts:['אין','כן'], cb: val=>{
    const el=document.getElementById('fkd');
    if(el) el.style.display=val==='כן'?'block':'none';
  }},
  'pg-cv':{ hid:'fcv', opts:['מטפחת','פאה','אחר'], cb: val=>{
    const el=document.getElementById('fcv-other');
    if(el) el.style.display=val==='אחר'?'block':'none';
  }},
  'pg-se':{ hid:'fse', opts:['צבאי','לאומי','ישיבה','כולל','פטור','לא רלוונטי','אחר'], cb: val=>{
    const el=document.getElementById('fse-other');
    if(el) el.style.display=val==='אחר'?'block':'none';
    updatePreview();
  }},
  'pg-t': { hid:'ft',  opts:['כן','לא'] },
  'pg-sm':{ hid:'fsm', opts:['לא','כן'] },
  'pg-ph':{ hid:'fph', opts:['כשר','רגיל'] },
};

function initPills() {
  Object.entries(PGS).forEach(([gid,cfg]) => {
    const c = document.getElementById(gid);
    if (!c) return;
    c.innerHTML = cfg.opts.map(o =>
      `<label class="pill" onclick="selPill(this,'${cfg.hid}','${o}',PGS['${gid}'].cb)">
        <input type="radio" name="${gid}" value="${o}"><span>${o}</span>
      </label>`
    ).join('');
  });
}

function selPill(lbl, hid, val, cb) {
  lbl.closest('.pill-g').querySelectorAll('.pill').forEach(p=>p.classList.remove('sel'));
  lbl.classList.add('sel');
  const h = document.getElementById(hid);
  if (h) h.value = val;
  if (cb) cb(val);
  updatePreview();
}

function sp2(hid, val) {
  if (!val) return;
  const h = document.getElementById(hid);
  if (h) h.value = val;
  const entry = Object.entries(PGS).find(([,cfg])=>cfg.hid===hid);
  if (!entry) return;
  const c = document.getElementById(entry[0]);
  if (!c) return;
  c.querySelectorAll('.pill').forEach(p=>{
    const inp = p.querySelector('input');
    if (inp && inp.value===val) {
      p.classList.add('sel');
      if (entry[1].cb) entry[1].cb(val);
    }
  });
}

// ============================================================
// HELPERS
// ============================================================
function chkBuild(val)  { const el=document.getElementById('fb-other');  if(el) el.style.display=val==='אחר'?'block':'none'; updatePreview(); }
function chkSector(val) { const el=document.getElementById('fs-other');  if(el) el.style.display=val==='אחר'?'block':'none'; updatePreview(); }
function chkEdu(val)    { const el=document.getElementById('fed-other'); if(el) el.style.display=val==='אחר'?'block':'none'; updatePreview(); }

function updateProgressBar() {
  const fills=[25,50,75,100,100];
  const pf=document.getElementById('prog-fill');
  if(pf) pf.style.width=(fills[Math.min(cbStep-1,4)]||25)+'%';
}

function copyToClipboard(txt,cb) {
  if(navigator.clipboard&&window.isSecureContext) {
    navigator.clipboard.writeText(txt).then(cb).catch(()=>fallbackCopy(txt,cb));
  } else { fallbackCopy(txt,cb); }
}
function fallbackCopy(txt,cb) {
  const ta=document.createElement('textarea');
  ta.value=txt; ta.style.cssText='position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try{document.execCommand('copy');if(cb)cb();}catch{toast('לא ניתן להעתיק');}
  document.body.removeChild(ta);
}
function cpFinal() {
  copyToClipboard(window._card||'',()=>{
    toast('הועתק! ✓');
    const b=document.getElementById('cfb');
    if(b){b.textContent='✅ הועתק!';setTimeout(()=>b.textContent='📋 העתק',2500);}
  });
}
function cpPrev() { copyToClipboard(window._card||'',()=>toast('הועתק! ✓')); }

function showSiteClosed() {
  document.body.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;direction:rtl;font-family:Heebo,sans-serif;background:#faf8f3"><div style="text-align:center;padding:40px 20px"><div style="font-size:52px;margin-bottom:16px">🔒</div><h1 style="font-family:Frank Ruhl Libre,serif;font-size:28px;margin-bottom:12px">המערכת סגורה זמנית</h1><p style="color:#6b5e48">${siteSettings.site_closed_message||'נחזור בקרוב.'}</p></div></div>`;
}

function showAnnouncement(text) {
  const el=document.getElementById('announcement-bar');
  if(el){el.textContent=text;el.style.display='block';document.body.classList.add('has-announcement');}
}

function closeModal(id) {
  const el=document.getElementById(id);
  if(el){el.classList.remove('open');document.body.style.overflow='';}
}

// ============================================================
// WA FLOAT BUTTON
// ============================================================
function renderWAFloat() {
  const panel = document.getElementById('waf-panel');
  if (!panel) return;
  const mgrBtns = siteManagers.map(m => `
    <button class="waf-mgr-btn" onclick="openWA('${m.phone.replace(/\D/g,'')}')">
      <div class="waf-mgr-av">${esc(m.initials || m.name?.[0] || 'מ')}</div>
      <div><span class="waf-mgr-name">${esc(m.name)}</span><span class="waf-mgr-role">${esc(m.role_title||'מנהל')} · וואטסאפ</span></div>
    </button>`).join('');
  panel.innerHTML = `
    <div class="waf-panel-hdr">💬 פנו אלינו</div>
    ${mgrBtns}
    <a href="mailto:s.b.0535345994@gmail.com" class="waf-mgr-btn" style="text-decoration:none">
      <div class="waf-mgr-av" style="background:#fef3c7;border-color:#f59e0b;color:#d97706">✉️</div>
      <div><span class="waf-mgr-name">מייל</span><span class="waf-mgr-role">s.b.0535345994@gmail.com</span></div>
    </a>`;
}

function openWA(phone) {
  const clean = String(phone).replace(/\D/g,'');
  window.open('https://wa.me/' + clean, '_blank');
  closeWAFloat();
}

function toggleWAFloat() {
  const panel = document.getElementById('waf-panel');
  if (panel) panel.classList.toggle('open');
}

function closeWAFloat() {
  const panel = document.getElementById('waf-panel');
  if (panel) panel.classList.remove('open');
}

document.addEventListener('click',e=>{
  const waf=document.getElementById('waf');
  if(waf&&!waf.contains(e.target)) closeWAFloat();
  const md=document.getElementById('md'),mn=document.getElementById('mn');
  if(md&&mn&&!mn.contains(e.target)) md.classList.remove('open');
  document.querySelectorAll('.ov.open').forEach(ov=>{if(e.target===ov)closeModal(ov.id);});
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    document.querySelectorAll('.ov.open').forEach(ov=>closeModal(ov.id));
    closeWAFloat();
  }
});

function sv(id,val){ const el=document.getElementById(id);if(el&&val!=null)el.value=val; }
function selOpt(id,val){
  const el=document.getElementById(id);if(!el||!val)return;
  for(let o of el.options) if(o.value===val||o.text===val){o.selected=true;break;}
}
function se(id){ const el=document.getElementById(id);if(el)el.classList.add('show'); }
function he(id){ const el=document.getElementById(id);if(el)el.classList.remove('show'); }
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function cc(el,cid,max){
  const len=el.value.length,c=document.getElementById(cid);
  if(c){c.textContent=len+'/'+max;c.classList.toggle('warn',len>max*.85);}
}
function toast(msg){
  const t=document.getElementById('toast');if(!t)return;
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2800);
}
function toggleMob(){ document.getElementById('md')?.classList.toggle('open'); }
function togglePw(id,btn){
  const el=document.getElementById(id);if(!el)return;
  const show=el.type==='password';el.type=show?'text':'password';btn.textContent=show?'🙈':'👁';
}

function prevImg(e){
  const f=e.target.files[0];if(!f)return;
  if(!['image/jpeg','image/png','image/gif','image/webp'].includes(f.type)){toast('פורמט לא תקין');return;}
  if(f.size>5*1024*1024){toast('התמונה גדולה מדי (מקס׳ 5MB)');return;}
  const r=new FileReader();
  r.onload=e2=>{const img=document.getElementById('imgP');img.src=e2.target.result;img.style.display='block';};
  r.readAsDataURL(f);
}

// Live preview listeners
document.addEventListener('DOMContentLoaded',()=>{
  ['fn','fln','fa','fh','fe','fc','fj','ff','fab','flk','fs-other','fed-other','fcv-other','fse-other','fcn','fct2','fb-other','fkd'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.addEventListener('input',updatePreview);
  });
  ['fb','fs','fed'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.addEventListener('change',updatePreview);
  });
});
