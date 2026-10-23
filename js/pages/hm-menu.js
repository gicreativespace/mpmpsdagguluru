// js/pages/hm-menu.js — v12.0 (Step 6.4 — Cook Submissions approve)
let currentTab = 'template';
let templateData = null;
let todayData = null;
let allSubmissions = [];

const DEFAULT_MENU = {
    Monday: { lunch: ["వైట్ రైస్ (White Rice)", "ఆకుకూర పప్పు (Dal with Greens)", "కోడిగుడ్డు ఫ్రై (Egg Fry)"], snacks: ["వేరుశనగ బెల్లం చిక్కీ (Peanut Chikki)"] },
    Tuesday: { lunch: ["పులిహోర (Pulihora)", "చట్నీ (Chutney)", "ఉడికించిన కోడిగుడ్డు (Boiled Egg)"], snacks: ["రాగిజావ (Ragi Java)"] },
    Wednesday: { lunch: ["వైట్ రైస్ (White Rice)", "కూరగాయల కూర (Vegetable Curry)", "కోడిగుడ్డు ఫ్రై (Egg Fry)"], snacks: ["వేరుశనగ బెల్లం చిక్కీ (Peanut Chikki)"] },
    Thursday: { lunch: ["వెజిటబుల్ రైస్ / వెజ్ పలావ్ (Veg Pulao)", "ఆలూ కుర్మా (Aloo Kurma)", "ఉడికించిన కోడిగుడ్డు (Boiled Egg)"], snacks: ["రాగిజావ (Ragi Java)"] },
    Friday: { lunch: ["వైట్ రైస్ (White Rice)", "ఆకుకూర పప్పు (Dal with Greens)", "కోడిగుడ్డు ఫ్రై (Egg Fry)"], snacks: ["వేరుశనగ బెల్లం చిక్కీ (Peanut Chikki)"] },
    Saturday: { lunch: ["వైట్ రైస్ (White Rice)", "కూరగాయల కూర (Vegetable Curry)", "స్వీట్ పొంగల్ (Sweet Pongal)"], snacks: ["రాగిజావ (Ragi Java)"] },
    Sunday: { isHoliday: true, lunch: [], snacks: [] }
};

const NUTRITION = { rice: "100g", dal: "20g", vegetables: "50g", oil: "5g", egg: "1", chikki: "25g" };

const TELUGU_DAYS = {
    Monday: "సోమవారం", Tuesday: "మంగళవారం", Wednesday: "బుధవారం",
    Thursday: "గురువారం", Friday: "శుక్రవారం", Saturday: "శనివారం", Sunday: "ఆదివారం"
};

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('dm_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const savedSize = localStorage.getItem('dm_font_size');
    if (savedSize) document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');

    const session = Auth.checkAuth('headmaster');
    if (!session) return;

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('menuApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        addCustomBackButton();
        await loadTemplate();
        await loadToday();
        renderTab();
    }, 1200);

    bindEvents();
});

function addCustomBackButton() {
    const header = document.querySelector('.app-header');
    if (!header) return;
    let backBtn = header.querySelector('#backBtn');
    if (backBtn) backBtn.remove();
    backBtn = document.createElement('button');
    backBtn.id = 'backBtn';
    backBtn.className = 'icon-btn back-btn';
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
    backBtn.addEventListener('click', () => window.location.href = 'hm-dashboard.html');
    header.insertBefore(backBtn, header.firstChild);
}

function bindEvents() {
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', () => {
        if (typeof UI !== 'undefined') UI.toggleTheme();
        themeBtn.textContent = document.body.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    });
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        if (typeof UI !== 'undefined' && UI.confirmLogout) UI.confirmLogout();
        else if (confirm('లాగౌట్ చేయాలా?')) Auth.logout();
    });
}

async function loadTemplate() {
    try {
        if (typeof authReady !== 'undefined') await Promise.race([authReady, new Promise(r => setTimeout(r, 3000))]);
        const doc = await db.collection('menuTemplates').doc('main').get();
        templateData = doc.exists ? (doc.data().weeklyMenu || DEFAULT_MENU) : DEFAULT_MENU;
    } catch (e) { console.warn('Load template:', e); templateData = DEFAULT_MENU; }
}

async function loadToday() {
    try {
        const doc = await db.collection('menu').doc(getTodayStr()).get();
        todayData = doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (e) { console.warn('Load today:', e); }
}

function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayDayName() {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
}

// =====================================================
// TABS
// =====================================================
function switchTab(tab) {
    currentTab = tab;
    ['template', 'today', 'sponsor', 'submissions'].forEach(t => {
        const btn = document.getElementById('tab' + capitalize(t));
        if (btn) btn.className = t === tab ? 'btn btn-primary' : 'btn btn-outline';
    });
    renderTab();
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function renderTab() {
    if (currentTab === 'template') renderTemplate();
    else if (currentTab === 'today') renderToday();
    else if (currentTab === 'sponsor') renderSponsor();
    else if (currentTab === 'submissions') renderSubmissions();
}

// =====================================================
// TEMPLATE
// =====================================================
function renderTemplate() {
    const container = document.getElementById('tabContent');
    let html = `<div class="card"><h3 class="card-title" style="font-size: 1rem; text-align: left; margin-bottom: var(--space-md);">📋 Weekly Template</h3>`;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    days.forEach(day => {
        const menu = templateData[day] || { lunch: [], snacks: [] };
        html += `<div style="padding: var(--space-md); margin-bottom: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-md); border-left: 4px solid var(--primary);">
            <h4 style="font-size: 0.95rem; color: var(--primary); margin-bottom: 6px;">${TELUGU_DAYS[day]} (${day})</h4>
            <p style="font-size: 0.8rem; margin-bottom: 4px;">🍚 <strong>Lunch:</strong> ${escapeHtml((menu.lunch || []).join(', ') || '—')}</p>
            <p style="font-size: 0.8rem;">🍪 <strong>Snacks:</strong> ${escapeHtml((menu.snacks || []).join(', ') || '—')}</p>
        </div>`;
    });

    html += `<div style="padding: var(--space-md); margin-bottom: var(--space-sm); background: #FFF3E0; border-radius: var(--radius-md); border-left: 4px solid #F57C00;">
        <h4 style="font-size: 0.95rem; color: #E65100;">${TELUGU_DAYS.Sunday} (Sunday)</h4>
        <p style="font-size: 0.8rem; font-weight: 600;">🔒 Holiday — No Menu</p>
    </div>`;

    html += `<div style="margin-top: var(--space-md); padding: var(--space-md); background: var(--surface); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <h4 style="font-size: 0.9rem; color: var(--primary); margin-bottom: var(--space-sm);">📊 Nutrition (Class 1-5)</h4>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 0.75rem;">
            <div>🍚 Rice: <strong>${NUTRITION.rice}</strong></div>
            <div>🥣 Dal: <strong>${NUTRITION.dal}</strong></div>
            <div>🥬 Veg: <strong>${NUTRITION.vegetables}</strong></div>
            <div>🫒 Oil: <strong>${NUTRITION.oil}</strong></div>
            <div>🥚 Egg: <strong>${NUTRITION.egg}</strong></div>
            <div>🍬 Chikki: <strong>${NUTRITION.chikki}</strong></div>
        </div>
    </div>`;

    html += `</div>`;
    container.innerHTML = html;
}

// =====================================================
// TODAY
// =====================================================
function renderToday() {
    const container = document.getElementById('tabContent');
    const todayDay = getTodayDayName();
    const dateStr = getTodayStr();

    if (todayDay === 'Sunday') {
        container.innerHTML = `<div class="card" style="text-align: center; padding: var(--space-xl);">
            <div style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);">🏖️</div>
            <h3 style="color: #E65100;">ఆదివారం — Holiday</h3>
            <p style="color: var(--text-muted); margin-top: var(--space-sm);">Menu అవసరం లేదు.</p>
        </div>`;
        return;
    }

    const templateMenu = templateData[todayDay] || { lunch: [], snacks: [] };
    const menu = todayData || { day: todayDay, lunch: templateMenu.lunch, snacks: templateMenu.snacks, isHoliday: false, sponsor: null };
    const isOverride = todayData !== null;

    container.innerHTML = `<div class="card">
        <h3 class="card-title" style="font-size: 1rem; text-align: left; margin-bottom: var(--space-xs);">📅 ${TELUGU_DAYS[todayDay]} (${dateStr})</h3>
        <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: var(--space-md);">${isOverride ? '✏️ Override' : '📋 Template auto'}</p>

        ${menu.isHoliday ? `<div style="padding: var(--space-md); background: #FFF3E0; border-radius: var(--radius-md); text-align: center; margin-bottom: var(--space-md);">
            <p style="font-size: 1.2rem; color: #E65100; font-weight: 700;">🔒 Holiday</p>
        </div>` : `<div style="padding: var(--space-md); background: var(--bg-color); border-radius: var(--radius-md); margin-bottom: var(--space-md);">
            <p style="font-size: 0.85rem; font-weight: 700; color: var(--primary); margin-bottom: 6px;">🍚 Lunch:</p>
            <p style="font-size: 0.85rem; margin-bottom: 12px;">${(menu.lunch || []).map(i => escapeHtml(i)).join(', ') || '—'}</p>
            <p style="font-size: 0.85rem; font-weight: 700; color: var(--primary); margin-bottom: 6px;">🍪 Snacks:</p>
            <p style="font-size: 0.85rem;">${(menu.snacks || []).map(i => escapeHtml(i)).join(', ') || '—'}</p>
        </div>`}

        ${menu.sponsor && menu.sponsor.item ? `<div class="sponsor-box" style="margin-bottom: var(--space-md);">
            <div class="sponsor-title">🎁 Sponsor</div>
            <p style="font-size: 0.85rem;">${escapeHtml(menu.sponsor.donor || '—')} — ${escapeHtml(menu.sponsor.item)}</p>
        </div>` : ''}

        <div style="display: flex; gap: var(--space-sm);">
            <button class="btn btn-primary" onclick="saveTodayFromTemplate()" style="flex: 1; padding: 12px; font-size: 0.85rem;">
                <i class="fas fa-save"></i> Save Today
            </button>
            <button class="btn btn-outline" onclick="markTodayHoliday()" style="flex: 1; padding: 12px; font-size: 0.85rem;">
                <i class="fas fa-lock"></i> Holiday
            </button>
        </div>
    </div>`;
}

// =====================================================
// SPONSOR
// =====================================================
function renderSponsor() {
    const container = document.getElementById('tabContent');
    const todayDay = getTodayDayName();
    const existing = todayData?.sponsor || {};

    container.innerHTML = `<div class="card">
        <h3 class="card-title" style="font-size: 1rem; text-align: left; margin-bottom: var(--space-sm);">🎁 Sponsor (${TELUGU_DAYS[todayDay]})</h3>
        <p class="card-desc" style="text-align: left; font-size: 0.8rem; margin-bottom: var(--space-md);">ఈరోజు food donate చేస్తే ఇక్కడ add చేయండి.</p>
        <div class="form">
            <div class="field">
                <label for="sponsorDonor">Donor పేరు</label>
                <input type="text" id="sponsorDonor" placeholder="ఉదా: Ravi Kumar" value="${escapeHtml(existing.donor || '')}" />
            </div>
            <div class="field">
                <label for="sponsorItem">Sponsored Item</label>
                <input type="text" id="sponsorItem" placeholder="ఉదా: Sweets, Fruits" value="${escapeHtml(existing.item || '')}" />
            </div>
            <button class="btn btn-primary btn-block" onclick="saveSponsor()" style="padding: 14px;">
                <i class="fas fa-save"></i> Save Sponsor
            </button>
            ${existing.donor ? `<button class="btn btn-danger btn-block" onclick="removeSponsor()" style="padding: 12px; margin-top: 8px;">
                <i class="fas fa-trash"></i> Remove Sponsor
            </button>` : ''}
        </div>
    </div>`;
}

// =====================================================
// COOK SUBMISSIONS (NEW — Step 6.4)
// =====================================================
async function renderSubmissions() {
    const container = document.getElementById('tabContent');
    container.innerHTML = `<div class="card"><p style="text-align: center; color: var(--text-muted);">లోడ్...</p></div>`;

    try {
        const snap = await db.collection('cookSubmissions').get();
        allSubmissions = [];
        snap.forEach(doc => allSubmissions.push({ id: doc.id, ...doc.data() }));

        // Sort: pending first, then date desc
        allSubmissions.sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return (b.date || '').localeCompare(a.date || '');
        });

        if (allSubmissions.length === 0) {
            container.innerHTML = `<div class="card" style="text-align: center; padding: var(--space-xl);">
                <div style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);">📋</div>
                <p style="color: var(--text-muted);">Cook submissions లేవు</p>
            </div>`;
            return;
        }

        let html = `<div class="card"><h3 class="card-title" style="font-size: 1rem; text-align: left; margin-bottom: var(--space-md);">🍳 Cook Submissions</h3>`;

        allSubmissions.forEach(s => {
            let bc = 'status-pending', st = '⏳ Pending';
            if (s.status === 'approved') { bc = 'status-approved'; st = '✅ Approved'; }
            else if (s.status === 'rejected') { bc = 'status-rejected'; st = '❌ Rejected'; }

            const lunch = s.menu?.lunch || [];
            const snacks = s.menu?.snacks || [];
            const helpers = s.helperAttendance || [];
            const canAct = s.status === 'pending';

            html += `<div style="padding: var(--space-md); margin-bottom: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-md); border-left: 4px solid ${s.status === 'approved' ? 'var(--success)' : s.status === 'rejected' ? 'var(--danger)' : '#F9A825'};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-sm);">
                    <div style="flex: 1;">
                        <h4 style="font-size: 0.95rem; margin-bottom: 4px;">👨‍🍳 ${escapeHtml(s.cookName || '—')}</h4>
                        <p style="font-size: 0.75rem; color: var(--text-muted);">📅 ${escapeHtml(s.date || '—')} • ${escapeHtml(s.day || '')}</p>
                    </div>
                    <span class="status-badge ${bc}">${st}</span>
                </div>

                ${lunch.length > 0 ? `<div style="margin-bottom: 6px;">
                    <p style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">🍚 Lunch:</p>
                    <p style="font-size: 0.8rem;">${lunch.map(i => `${i.prepared ? '✅' : '❌'} ${escapeHtml(i.item)}`).join(' • ')}</p>
                </div>` : ''}

                ${snacks.length > 0 ? `<div style="margin-bottom: 6px;">
                    <p style="font-size: 0.75rem; font-weight: 700; color: #F57C00;">🍪 Snacks:</p>
                    <p style="font-size: 0.8rem;">${snacks.map(i => `${i.prepared ? '✅' : '❌'} ${escapeHtml(i.item)}`).join(' • ')}</p>
                </div>` : ''}

                ${s.sponsor && s.sponsor.item ? `<div style="margin-bottom: 6px; padding: 6px; background: #FFF8E1; border-radius: var(--radius-sm);">
                    <p style="font-size: 0.75rem;">🎁 <strong>Sponsor:</strong> ${escapeHtml(s.sponsor.donor || '—')} — ${escapeHtml(s.sponsor.item)}</p>
                </div>` : ''}

                ${helpers.length > 0 ? `<div style="margin-bottom: 6px;">
                    <p style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">👥 Helpers:</p>
                    <p style="font-size: 0.8rem;">${helpers.map(h => `${h.present ? '✅' : '❌'} ${escapeHtml(h.name)}`).join(' • ')}</p>
                </div>` : ''}

                ${canAct ? `<div style="display: flex; gap: var(--space-sm); margin-top: var(--space-sm);">
                    <button class="btn btn-primary" onclick="approveSubmission('${s.id}')" style="flex: 1; padding: 10px; font-size: 0.85rem;">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-danger" onclick="rejectSubmission('${s.id}')" style="flex: 1; padding: 10px; font-size: 0.85rem;">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>` : `<p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 6px;">
                    ${s.approvedBy ? '✅ ' + escapeHtml(s.approvedBy) : ''}
                </p>`}
            </div>`;
        });

        html += `</div>`;
        container.innerHTML = html;
    } catch (e) {
        console.error('Load submissions:', e);
        container.innerHTML = `<div class="card"><p style="color: var(--danger); text-align: center;">లోడ్ విఫలం</p></div>`;
    }
}

async function approveSubmission(id) {
    if (!confirm('Cook submission approve చేయాలా?')) return;
    try {
        const session = JSON.parse(localStorage.getItem('dm_session') || '{}');
        await db.collection('cookSubmissions').doc(id).update({
            status: 'approved',
            approvedBy: session.name || 'HM',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        UI.toast('✅ Approved!', 'success');
        renderSubmissions();
    } catch (e) {
        console.error('Approve:', e);
        UI.toast('❌ విఫలం.', 'error');
    }
}

async function rejectSubmission(id) {
    const reason = prompt('Reject కారణం (optional):');
    if (reason === null) return;
    try {
        const session = JSON.parse(localStorage.getItem('dm_session') || '{}');
        await db.collection('cookSubmissions').doc(id).update({
            status: 'rejected',
            rejectedBy: session.name || 'HM',
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            rejectionReason: reason || ''
        });
        UI.toast('❌ Rejected.', 'success');
        renderSubmissions();
    } catch (e) {
        console.error('Reject:', e);
        UI.toast('❌ విఫలం.', 'error');
    }
}

// =====================================================
// SAVE ACTIONS
// =====================================================
async function saveTodayFromTemplate() {
    const todayDay = getTodayDayName();
    const dateStr = getTodayStr();
    const templateMenu = templateData[todayDay] || { lunch: [], snacks: [] };
    try {
        await db.collection('menu').doc(dateStr).set({
            day: todayDay, date: dateStr,
            lunch: templateMenu.lunch || [],
            snacks: templateMenu.snacks || [],
            isHoliday: false,
            sponsor: todayData?.sponsor || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        UI.toast('✅ Save!', 'success');
        await loadToday();
        renderTab();
    } catch (e) { UI.toast('Save విఫలం.', 'error'); }
}

async function markTodayHoliday() {
    if (!confirm('Holiday గా mark చేయాలా?')) return;
    try {
        await db.collection('menu').doc(getTodayStr()).set({
            day: getTodayDayName(), date: getTodayStr(),
            isHoliday: true, lunch: [], snacks: [],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        UI.toast('🔒 Holiday!', 'success');
        await loadToday();
        renderTab();
    } catch (e) { UI.toast('విఫలం.', 'error'); }
}

async function saveSponsor() {
    const donor = document.getElementById('sponsorDonor').value.trim();
    const item = document.getElementById('sponsorItem').value.trim();
    if (!donor || !item) { UI.toast('Donor మరియు Item నింపండి.', 'warning'); return; }
    const dateStr = getTodayStr();
    const todayDay = getTodayDayName();
    const templateMenu = templateData[todayDay] || { lunch: [], snacks: [] };
    try {
        await db.collection('menu').doc(dateStr).set({
            day: todayDay, date: dateStr,
            lunch: todayData?.lunch || templateMenu.lunch || [],
            snacks: todayData?.snacks || templateMenu.snacks || [],
            isHoliday: false,
            sponsor: { donor, item },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        UI.toast('✅ Sponsor save!', 'success');
        await loadToday();
        renderTab();
    } catch (e) { UI.toast('Save విఫలం.', 'error'); }
}

async function removeSponsor() {
    if (!confirm('Sponsor తీసేయాలా?')) return;
    try {
        await db.collection('menu').doc(getTodayStr()).update({ sponsor: null });
        UI.toast('Sponsor తీసేయబడింది.', 'success');
        await loadToday();
        renderTab();
    } catch (e) { UI.toast('విఫలం.', 'error'); }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
