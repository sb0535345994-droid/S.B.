// ============================================================
// admin.js — מערכת ניהול
// ============================================================

async function loadAdmin() {
  // הגנה כפולה — גם בצד לקוח
  if (!currentUser || currentProfile?.role !== 'admin') {
    go('home');
    return;
  }

  const [settings, pkgs, mgrs, vip] = await Promise.all([
    getSiteSettings(),
    adminGetPackages(),
    adminGetManagers(),
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
  const header = `<div style="display:flex;align-items:center;gap:10px;padding:0 16px 6px;font-size:11px;font-weight:700;color:var(--il);flex-wrap:wrap">
    <span style="width:40px;flex-shrink:0">פעיל</span>
    <span style="max-width:110px;flex:1;min-width:80px">שם</span>
    <span style="max-width:70px;flex:1;min-width:50px">מחיר ₪</span>
    <span style="max-width:70px;flex:1;min-width:50px">כמות פרסומים</span>
    <span style="max-width:130px;flex:1;min-width:80px">תווית שיווקית</span>
    <span style="max-width:220px;flex:1;min-width:80px">קישור תשלום</span>
    <span style="width:60px;flex-shrink:0">פופולרי</span>
  </div>`;
  list.innerHTML = header + pkgs.map(p => `
    <div class="admin-pkg-row" data-id="${p.id}">
      <button class="admin-pkg-toggle ${p.is_active?'on':'off'}" onclick="adminTogglePkg('${p.id}',${!p.is_active})" title="${p.is_active?'כבה':'הפעל'}"></button>
      <input value="${esc(p.name)}"  placeholder="שם" data-field="name" style="max-width:110px"/>
      <input value="${esc(p.price)}" placeholder="₪" type="number" data-field="price" style="max-width:70px"/>
      <input value="${esc(p.publications_count)}" placeholder="כמות" type="number" data-field="publications_count" style="max-width:70px"/>
      <input value="${esc(p.marketing_label||'')}" placeholder="תווית" data-field="marketing_label" style="max-width:130px"/>
      <input value="${esc(p.payment_link||'')}" placeholder="קישור תשלום (PayPal...)" data-field="payment_link" style="max-width:220px"/>
      <label style="font-size:12px;display:flex;align-items:center;gap:4px;white-space:nowrap">
        <input type="checkbox" ${p.is_popular?'checked':''} data-field="is_popular"/> פופולרי
      </label>
      <button class="btn-del" onclick="adminDeletePkgItem('${p.id}')">🗑️</button>
    </div>`).join('');
}

async function adminSaveAllPkgs() {
  const rows = document.querySelectorAll('.admin-pkg-row');
  let errors = 0;
  for (const row of rows) {
    const id = row.dataset.id;
    const fields = { id };
    row.querySelectorAll('[data-field]').forEach(el => {
      const f = el.dataset.field;
      if (el.type === 'checkbox') fields[f] = el.checked;
      else if (el.type === 'number') fields[f] = +el.value;
      else fields[f] = el.value;
    });
    const { error } = await adminSavePackage(fields);
    if (error) errors++;
  }
  toast(errors ? 'שגיאה בשמירת ' + errors + ' מסלולים' : 'מסלולים נשמרו ✓');
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
      <input value="${esc(m.name)}"           placeholder="שם"    data-field="name"/>
      <input value="${esc(m.phone)}"          placeholder="972..." data-field="phone"/>
      <input value="${esc(m.role_title||'')}" placeholder="תפקיד" data-field="role_title" style="max-width:120px"/>
      <input value="${esc(m.initials||'')}"   placeholder="ר"     data-field="initials" style="max-width:50px"/>
      <button class="btn-del" onclick="adminDeleteMgrItem('${m.id}')">🗑️</button>
    </div>`).join('');
}

async function adminSaveAllMgrs() {
  const rows = document.querySelectorAll('.admin-mgr-row');
  let errors = 0;
  for (const row of rows) {
    const id = row.dataset.id;
    const fields = { id };
    row.querySelectorAll('[data-field]').forEach(el => { fields[el.dataset.field] = el.value; });
    const { error } = await adminSaveManager(fields);
    if (error) errors++;
  }
  toast(errors ? 'שגיאה בשמירת ' + errors + ' מנהלים' : 'מנהלים נשמרו ✓');
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

