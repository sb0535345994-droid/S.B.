// ============================================================
// admin.js — מערכת ניהול
// ============================================================

async function loadAdmin() {
  // הגנה כפולה — גם בצד לקוח
  if (!currentUser || currentProfile?.role !== 'admin') {
    go('home');
    return;
  }

  const [settings, pkgs, mgrs, blocked, vip] = await Promise.all([
    getSiteSettings(),
    adminGetPackages(),
    adminGetManagers(),
    adminGetBlocked(),
    getVipSettings()
  ]);

  // ביט
  const bitEl = document.getElementById('admin-bit-phone');
  if (bitEl) bitEl.value = settings.bit_phone || '';

  // סטטוס אתר
  const siteBtn = document.getElementById('admin-site-btn');
  const siteTxt = document.getElementById('admin-site-status-txt');
  if (siteBtn) {
    siteBtn.textContent   = settings.site_enabled ? 'השבת אתר' : 'הפעל אתר';
    siteBtn.style.background = settings.site_enabled ? '#c0392b' : 'var(--green)';
    siteBtn.style.color   = '#fff';
  }
  if (siteTxt) siteTxt.textContent = settings.site_enabled ? '✅ האתר פעיל' : '⚠️ האתר מושבת';

  // הודעה כללית
  const annTxt = document.getElementById('admin-announce-txt');
  if (annTxt) annTxt.value = settings.announcement_text || '';

  // כללים
  const rulesTxt = document.getElementById('admin-rules-txt');
  if (rulesTxt) rulesTxt.value = settings.general_rules || '';

  renderAdminPkgs(pkgs);
  renderAdminMgrs(mgrs);
  renderBlockedList(blocked);
  renderAdminVip(vip);
}

// ============================================================
// אתר
// ============================================================
async function adminToggleSite() {
  const settings = await getSiteSettings();
  const { error } = await adminSaveSiteSettings({ site_enabled: !settings.site_enabled });
  if (error) { toast('שגיאה: ' + error.message); return; }
  toast(settings.site_enabled ? '⚠️ האתר הושבת' : '✅ האתר הופעל');
  await loadAdmin();
}

// ============================================================
// ביט
// ============================================================
async function adminSaveBit() {
  const phone = document.getElementById('admin-bit-phone')?.value?.trim() || '';
  const { error } = await adminSaveSiteSettings({ bit_phone: phone });
  if (error) { toast('שגיאה: ' + error.message); return; }
  siteSettings = await getSiteSettings();
  toast('פרטי תשלום נשמרו ✓');
}

// ============================================================
// הודעה כללית
// ============================================================
async function adminSaveAnnounce() {
  const text = document.getElementById('admin-announce-txt')?.value || '';
  const { error } = await adminSaveSiteSettings({
    announcement_text: text,
    announcement_enabled: !!text
  });
  if (error) { toast('שגיאה: ' + error.message); return; }
  toast('הודעה נשמרה ✓');
}
async function adminClearAnnounce() {
  const { error } = await adminSaveSiteSettings({ announcement_text: '', announcement_enabled: false });
  if (error) { toast('שגיאה: ' + error.message); return; }
  const el = document.getElementById('admin-announce-txt');
  if (el) el.value = '';
  toast('הודעה בוטלה');
}

// ============================================================
// כללים
// ============================================================
async function adminSaveRules() {
  const rules = document.getElementById('admin-rules-txt')?.value || '';
  const { error } = await adminSaveSiteSettings({ general_rules: rules });
  if (error) { toast('שגיאה: ' + error.message); return; }
  toast('תקנון נשמר ✓');
}

// ============================================================
// מסלולים
// ============================================================
function renderAdminPkgs(pkgs) {
  const list = document.getElementById('admin-pkgs-list');
  if (!list) return;
  if (!pkgs.length) { list.innerHTML = '<p style="font-size:13px;color:var(--il)">אין מסלולים</p>'; return; }
  list.innerHTML = pkgs.map(p => `
    <div class="admin-pkg-row" data-id="${p.id}">
      <button class="admin-pkg-toggle ${p.is_active?'on':'off'}" onclick="adminTogglePkg('${p.id}',${!p.is_active})" title="${p.is_active?'כבה':'הפעל'}"></button>
      <input value="${esc(p.name)}"  placeholder="שם" onchange="adminEditPkgField('${p.id}','name',this.value)" style="max-width:110px"/>
      <input value="${esc(p.price)}" placeholder="₪" type="number" onchange="adminEditPkgField('${p.id}','price',+this.value)" style="max-width:70px"/>
      <input value="${esc(p.publications_count)}" placeholder="כמות" type="number" onchange="adminEditPkgField('${p.id}','publications_count',+this.value)" style="max-width:70px"/>
      <input value="${esc(p.marketing_label||'')}" placeholder="תווית" onchange="adminEditPkgField('${p.id}','marketing_label',this.value)" style="max-width:130px"/>
      <input value="${esc(p.payment_link||'')}" placeholder="קישור תשלום (PayPal...)" onchange="adminEditPkgField('${p.id}','payment_link',this.value)" style="max-width:220px"/>
      <label style="font-size:12px;display:flex;align-items:center;gap:4px;white-space:nowrap">
        <input type="checkbox" ${p.is_popular?'checked':''} onchange="adminEditPkgField('${p.id}','is_popular',this.checked)"/> פופולרי
      </label>
      <button class="btn-del" onclick="adminDeletePkgItem('${p.id}')">🗑️</button>
    </div>`).join('');
}

async function adminEditPkgField(id, field, val) {
  const { error } = await adminSavePackage({ id, [field]: val });
  if (error) toast('שגיאה: ' + error.message);
}
async function adminTogglePkg(id, active) {
  const { error } = await adminSavePackage({ id, is_active: active });
  if (error) { toast('שגיאה'); return; }
  renderAdminPkgs(await adminGetPackages());
}
async function adminAddPkg() {
  const { error } = await adminSavePackage({ name:'מסלול חדש', description:'', price:0, publications_count:1, is_active:true, display_order:99 });
  if (error) { toast('שגיאה: ' + error.message); return; }
  renderAdminPkgs(await adminGetPackages());
  toast('מסלול נוסף ✓');
}
async function adminDeletePkgItem(id) {
  if (!confirm('למחוק מסלול זה?')) return;
  const { error } = await adminDeletePackage(id);
  if (error) { toast('שגיאה'); return; }
  renderAdminPkgs(await adminGetPackages());
  toast('מסלול נמחק');
}

// ============================================================
// מנהלים
// ============================================================
function renderAdminMgrs(mgrs) {
  const list = document.getElementById('admin-mgr-list');
  if (!list) return;
  list.innerHTML = mgrs.map(m => `
    <div class="admin-mgr-row" data-id="${m.id}">
      <input value="${esc(m.name)}"        placeholder="שם"     onchange="adminEditMgrField('${m.id}','name',this.value)"/>
      <input value="${esc(m.phone)}"       placeholder="972..."  onchange="adminEditMgrField('${m.id}','phone',this.value)"/>
      <input value="${esc(m.role_title||'')}" placeholder="תפקיד" onchange="adminEditMgrField('${m.id}','role_title',this.value)" style="max-width:120px"/>
      <input value="${esc(m.initials||'')}"   placeholder="ר"    onchange="adminEditMgrField('${m.id}','initials',this.value)" style="max-width:50px"/>
      <button class="btn-del" onclick="adminDeleteMgrItem('${m.id}')">🗑️</button>
    </div>`).join('');
}
async function adminEditMgrField(id, field, val) {
  const { error } = await adminSaveManager({ id, [field]: val });
  if (error) toast('שגיאה: ' + error.message);
}
async function adminAddMgr() {
  const { error } = await adminSaveManager({ name:'מנהל חדש', phone:'972', role_title:'', initials:'מ', is_active:true, display_order:99 });
  if (error) { toast('שגיאה'); return; }
  renderAdminMgrs(await adminGetManagers());
  toast('מנהל נוסף ✓');
}
async function adminDeleteMgrItem(id) {
  if (!confirm('למחוק מנהל זה?')) return;
  const { error } = await adminDeleteManager(id);
  if (error) { toast('שגיאה'); return; }
  renderAdminMgrs(await adminGetManagers());
  toast('מנהל נמחק');
}

// ============================================================
// הוספת פרסומים
// ============================================================
async function adminAddPublicationsForm() {
  const phone = document.getElementById('admin-pub-phone')?.value?.trim();
  const count = +(document.getElementById('admin-pub-count')?.value) || 0;
  if (!phone) { toast('הכנס מספר טלפון'); return; }
  if (!count || count < 1) { toast('הכנס כמות תקינה'); return; }
  const { data: profile, error: profileErr } = await getProfileByPhone(phone);
  if (profileErr || !profile) { toast('משתמש לא נמצא'); return; }
  const { error } = await adminAddPublications(profile.id, count);
  if (error) { toast('שגיאה: ' + error.message); return; }
  const el = document.getElementById('admin-pub-phone');
  if (el) el.value = '';
  toast(`✓ נוספו ${count} פרסומים ל-${profile.first_name}`);
}

// ============================================================
// חסימות
// ============================================================
function renderBlockedList(blocked) {
  const list = document.getElementById('admin-blocked-list');
  if (!list) return;
  if (!blocked.length) { list.innerHTML = '<p style="font-size:13px;color:var(--il)">אין חסומים</p>'; return; }
  list.innerHTML = blocked.map(b => `
    <div class="admin-blocked-row">
      <div>
        <strong>${esc(b.phone||'–')}</strong>
        ${b.reason?' · '+esc(b.reason):''}
      </div>
      <button class="btn-del" onclick="adminUnblockUser('${b.id}')">בטל חסימה</button>
    </div>`).join('');
}
async function adminBlockUserForm() {
  const phone  = document.getElementById('admin-block-phone')?.value?.trim();
  const reason = document.getElementById('admin-block-reason')?.value?.trim();
  if (!phone) { toast('הכנס מספר טלפון'); return; }
  const { error } = await adminBlockUser({ phone, reason });
  if (error) { toast('שגיאה: ' + error.message); return; }
  ['admin-block-phone','admin-block-reason'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  renderBlockedList(await adminGetBlocked());
  toast('משתמש נחסם ✓');
}
async function adminUnblockUser(id) {
  const { error } = await adminUnblock(id);
  if (error) { toast('שגיאה'); return; }
  renderBlockedList(await adminGetBlocked());
  toast('חסימה בוטלה');
}

// ============================================================
// VIP
// ============================================================
function renderAdminVip(vip) {
  const enabled = document.getElementById('admin-vip-enabled');
  const price   = document.getElementById('admin-vip-price');
  const desc    = document.getElementById('admin-vip-desc');
  if (enabled) enabled.checked = vip.is_enabled || false;
  if (price)   price.value     = vip.price || 0;
  if (desc)    desc.value      = vip.description || '';
}
async function adminSaveVipForm() {
  const is_enabled  = document.getElementById('admin-vip-enabled')?.checked || false;
  const price       = +(document.getElementById('admin-vip-price')?.value) || 0;
  const description = document.getElementById('admin-vip-desc')?.value || '';
  const { error } = await adminSaveVip({ is_enabled, price, description });
  if (error) { toast('שגיאה: ' + error.message); return; }
  toast('VIP נשמר ✓');
}

