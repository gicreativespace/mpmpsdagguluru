// js/pages/cook.js — v12.0 (Step 6.3 + 6.4 + 6.5)
let currentScreen = 'login';
let currentCook = null;
let currentMenuData = null;
let currentHelpers = [];
let todaySubmission = null;

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('dm_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const savedSize = localStorage.getItem('dm_font_size');
    if (savedSize) document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');

    if (typeof UI !== 'undefined') UI.initLayout();

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('cookApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        addCustomBackButton();
        await decideScreen();
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
    backBtn.className = 'icon-btn back-btn hidden';
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
    backBtn.addEventListener('click', () => {
        if (currentScreen === 'login') {
            localStorage.removeItem('dm_cook_session');
            window.location.href = 'index.html';
        }
    });
    header.insertBefore(backBtn, header.firstChild);
}

async function decideScreen() {
    try {
        if (typeof authReady !== 'undefined') await Promise.race([authReady, new Promise(r => setTimeout(r, 3000))]);

        const session = localStorage.getItem('dm_cook_session');
        if (session) {
            const s = JSON.parse(session);
            currentCook = s;
            const savedName = localStorage.getItem('dm_cook_name');
            if (!savedName) { showScreen('namePrompt'); return; }
            currentCook.name = savedName;
            await loadCookData();
            showScreen('dashboard');
            return;
        }
        const schoolDoc = await db.collection('schoolInfo').doc('main').get();
        if (!schoolDoc.exists || !schoolDoc.data().isSetupComplete) {
            UI.toast('⚠️ సెటప్ పూర్తి కాలేదు.', 'warning', 5000);
            showScreen('login'); return;
        }
        if (schoolDoc.data().sections?.cook !== true) {
            UI.toast('⚠️ Cook సెక్షన్ ఎనేబుల్ కాలేదు.', 'warning', 5000);
            showScreen('login'); return;
        }
        showScreen('login');
    } catch (error) {
        console.error('Screen decision error:', error);
        showScreen('login');
    }
}

function showScreen(name) {
    currentScreen = name;
    ['login', 'namePrompt', 'dashboard'].forEach(s => {
        const el = document.getElementById('screen' + capitalize(s));
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('screen' + capitalize(name));
    if (target) target.classList.remove('hidden');

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        if (name === 'login' || name === 'namePrompt') backBtn.classList.add('hidden');
        else backBtn.classList.remove('hidden');
    }
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        if (name === 'login' || name === 'namePrompt') logoutBtn.classList.add('hidden');
        else logoutBtn.classList.remove('hidden');
    }
    const title = document.getElementById('pageTitle');
    if (title) {
        title.textContent = { login: 'Cook Login', namePrompt: 'Welcome', dashboard: 'Cook Dashboard' }[name] || 'Cook';
    }
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function bindEvents() {
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', () => {
        if (typeof UI !== 'undefined') UI.toggleTheme();
        themeBtn.textContent = document.body.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    });
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        if (typeof UI !== 'undefined' && UI.confirmLogout) UI.confirmLogout();
        else if (confirm('లాగౌట్ చేయాలా?')) {
            localStorage.removeItem('dm_cook_session');
            window.location.href = 'index.html';
        }
    });
    document.querySelectorAll('.pin-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const t = document.getElementById(btn.getAttribute('data-target'));
            if (!t) return;
            const isPwd = t.type === 'password';
            t.type = isPwd ? 'text' : 'password';
            btn.textContent = isPwd ? '🙈' : '👁';
        });
    });
    const phoneInput = document.getElementById('cookPhone');
    if (phoneInput) phoneInput.addEventListener('input', () => {
        phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
    });
    const pinInput = document.getElementById('cookPin');
    if (pinInput) pinInput.addEventListener('input', () => {
        pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
    });
    const loginForm = document.getElementById('cookLoginForm');
    if (loginForm) loginForm.addEventListener('submit', e => { e.preventDefault(); handleCookLogin(); });
    const nameForm = document.getElementById('cookNameForm');
    if (nameForm) nameForm.addEventListener('submit', e => { e.preventDefault(); handleSaveName(); });
}

async function handleCookLogin() {
    const phone = document.getElementById('cookPhone').value.trim();
    const pin = document.getElementById('cookPin').value;
    const errorEl = document.getElementById('cookLoginError');
    const btn = document.getElementById('cookLoginBtn');

    if (!/^\d{10}$/.test(phone)) return showFormError(errorEl, '10 అంకెల ఫోన్ నింపండి.');
    if (!/^\d{4}$/.test(pin)) return showFormError(errorEl, 'PIN 4 అంకెలు.');

    btn.disabled = true; btn.textContent = 'లాగిన్...'; hideFormError(errorEl);

    try {
        const snapshot = await db.collection('users').where('phone', '==', phone).where('role', '==', 'cook').limit(1).get();
        if (snapshot.empty) {
            btn.disabled = false; btn.textContent = 'లాగిన్';
            return showFormError(errorEl, '❌ ఫోన్ కనుగొనబడలేదు.');
        }
        const cookDoc = snapshot.docs[0];
        const cookData = cookDoc.data();
        if (cookData.isActive === false) {
            btn.disabled = false; btn.textContent = 'లాగిన్';
            return showFormError(errorEl, '🔒 ఖాతా నిలిపివేయబడింది.');
        }
        const last4 = parseInt(phone.slice(-4), 10);
        let expectedPin = 9999 - last4;
        if (expectedPin < 0) expectedPin = expectedPin + 10000;
        expectedPin = String(expectedPin).padStart(4, '0');
        const storedPin = String(cookData.masterPin || '').trim();
        if (storedPin !== expectedPin || pin !== expectedPin) {
            btn.disabled = false; btn.textContent = 'లాగిన్';
            return showFormError(errorEl, '❌ తప్పు Master PIN.');
        }

        currentCook = { id: cookDoc.id, name: cookData.name || '', phone: cookData.phone, role: 'cook' };
        localStorage.setItem('dm_cook_session', JSON.stringify(currentCook));

        const savedName = localStorage.getItem('dm_cook_name');
        if (!savedName) {
            UI.toast('✅ Login విజయవంతం!', 'success');
            showScreen('namePrompt');
        } else {
            currentCook.name = savedName;
            UI.toast(`✅ స్వాగతం ${savedName} గారు!`, 'success');
            await loadCookData();
            showScreen('dashboard');
        }
    } catch (error) {
        console.error('Login error:', error);
        showFormError(errorEl, 'నెట్‌వర్క్ లోపం.');
    } finally {
        btn.disabled = false; btn.textContent = 'లాగిన్';
    }
}

function handleSaveName() {
    const name = document.getElementById('cookNameInput').value.trim();
    const errorEl = document.getElementById('cookNameError');
    if (!name) return showFormError(errorEl, 'పేరు నింపండి.');
    localStorage.setItem('dm_cook_name', name);
    currentCook.name = name;
    UI.toast(`✅ స్వాగతం ${name} గారు!`, 'success');
    loadCookData();
    showScreen('dashboard');
}

async function loadCookData() {
    if (!currentCook) return;
    const hour = new Date().getHours();
    let greeting = '👋 స్వాగతం';
    if (hour < 12) greeting = '🌅 శుభోదయం';
    else if (hour < 17) greeting = '☀️ శుభ మధ్యాహ్నం';
    else greeting = '🌙 శుభ సాయంత్రం';

    const greetingEl = document.getElementById('cookGreetingText');
    if (greetingEl) greetingEl.textContent = greeting;
    const nameEl = document.getElementById('cookWelcomeName');
    if (nameEl) nameEl.textContent = `${currentCook.name || '—'} గారు`;
    const phoneEl = document.getElementById('cookWelcomePhone');
    if (phoneEl) phoneEl.textContent = currentCook.phone || '—';

    await loadHelpers();
    await loadTodayMenu();
    await loadMySubmissions();
}

// =====================================================
// HELPER ATTENDANCE (Step 6.3)
// =====================================================
async function loadHelpers() {
    try {
        const doc = await db.collection('users').doc(currentCook.id).get();
        const data = doc.data() || {};
        currentHelpers = (data.helpers || []).map(h => ({ name: h.name, present: true }));
        renderHelpers();
    } catch (e) {
        console.warn('Load helpers:', e);
        currentHelpers = [];
        renderHelpers();
    }
}

function renderHelpers() {
    const container = document.getElementById('helpersList');
    if (!container) return;
    if (currentHelpers.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">ఇంకా helpers add చేయలేదు</p>`;
        return;
    }
    container.innerHTML = currentHelpers.map((h, i) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: var(--bg-color); border-radius: var(--radius-sm); margin-bottom: 6px;">
            <span style="font-size: 0.9rem; font-weight: 600;">👤 ${escapeHtml(h.name)}</span>
            <div style="display: flex; align-items: center; gap: 6px;">
                <label class="switch" style="transform: scale(0.85);">
                    <input type="checkbox" ${h.present ? 'checked' : ''} onchange="toggleHelper(${i}, this.checked)" />
                    <span class="slider round"></span>
                </label>
                <button class="icon-btn" onclick="removeHelper(${i})" title="Remove" style="width: 30px; height: 30px; background: var(--danger); color: #fff; font-size: 0.75rem;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function toggleHelper(index, present) {
    if (currentHelpers[index]) currentHelpers[index].present = present;
}

async function addHelper() {
    const input = document.getElementById('newHelperName');
    const name = input.value.trim();
    if (!name) { UI.toast('Helper పేరు నింపండి.', 'warning'); return; }
    if (currentHelpers.find(h => h.name === name)) { UI.toast('Helper ఇప్పటికే ఉంది.', 'warning'); return; }
    currentHelpers.push({ name, present: true });
    input.value = '';
    renderHelpers();
    await persistHelpers();
}

async function removeHelper(index) {
    if (!confirm('Helper తీసేయాలా?')) return;
    currentHelpers.splice(index, 1);
    renderHelpers();
    await persistHelpers();
}

async function persistHelpers() {
    try {
        await db.collection('users').doc(currentCook.id).update({
            helpers: currentHelpers.map(h => ({ name: h.name }))
        });
    } catch (e) { console.warn('Persist helpers:', e); }
}

// =====================================================
// TODAY'S MENU (Step 6.4)
// =====================================================
function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayDayName() {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
}

const TELUGU_DAYS = {
    Monday: "సోమవారం", Tuesday: "మంగళవారం", Wednesday: "బుధవారం",
    Thursday: "గురువారం", Friday: "శుక్రవారం", Saturday: "శనివారం", Sunday: "ఆదివారం"
};

async function loadTodayMenu() {
    const container = document.getElementById('todayMenu');
    const dateEl = document.getElementById('menuDate');
    const sendBtn = document.getElementById('sendToHmBtn');

    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-sm);">లోడ్...</p>`;
    sendBtn.style.display = 'none';

    try {
        const today = new Date();
        const dateStr = getTodayStr();
        const dayName = getTodayDayName();

        if (dateEl) dateEl.textContent = `📅 ${TELUGU_DAYS[dayName]} (${dateStr})`;

        // Load menu/{date}
        const menuDoc = await db.collection('menu').doc(dateStr).get();
        currentMenuData = menuDoc.exists ? menuDoc.data() : null;

        // Load today submission (if any)
        const subDoc = await db.collection('cookSubmissions').doc(`${dateStr}_${currentCook.id}`).get();
        todaySubmission = subDoc.exists ? subDoc.data() : null;

        if (dayName === 'Sunday') {
            container.innerHTML = `<div style="padding: var(--space-md); text-align: center; background: #FFF3E0; border-radius: var(--radius-md);">
                <p style="font-size: 1.1rem; color: #E65100; font-weight: 700;">🏖️ ఆదివారం — Holiday</p>
                <p style="font-size: 0.8rem; color: var(--text-muted);">ఈరోజు menu అవసరం లేదు</p>
            </div>`;
            return;
        }

        if (!currentMenuData) {
            container.innerHTML = `<div style="padding: var(--space-md); text-align: center;">
                <p style="font-size: 1.1rem; color: var(--text-muted);">📋 ఈరోజు మెనూ ఇంకా సెట్ కాలేదు</p>
                <p style="font-size: 0.8rem; color: var(--text-muted);">HM ని సంప్రదించండి</p>
            </div>`;
            return;
        }

        if (currentMenuData.isHoliday) {
            container.innerHTML = `<div style="padding: var(--space-md); text-align: center; background: #FFF3E0; border-radius: var(--radius-md);">
                <p style="font-size: 1.1rem; color: #E65100; font-weight: 700;">🔒 Holiday</p>
                <p style="font-size: 0.8rem; color: var(--text-muted);">HM ఈరోజు Holiday గా mark చేశారు</p>
            </div>`;
            return;
        }

        // Render menu with checkboxes (all tick default; from submission if exists)
        renderMenuWithTicks(currentMenuData, todaySubmission);
        sendBtn.style.display = 'block';
    } catch (error) {
        console.error('Load menu error:', error);
        container.innerHTML = `<p style="color: var(--danger); text-align: center;">లోడ్ విఫలం</p>`;
    }
}

function renderMenuWithTicks(menu, submission) {
    const container = document.getElementById('todayMenu');
    const lunch = menu.lunch || [];
    const snacks = menu.snacks || [];
    const sponsor = menu.sponsor || null;

    const subMenu = submission?.menu || null;

    let html = '';

    if (sponsor && sponsor.item) {
        html += `<div class="sponsor-box" style="margin-bottom: var(--space-md);">
            <div class="sponsor-title">🎁 Sponsor</div>
            <p style="font-size: 0.85rem;">${escapeHtml(sponsor.donor || '—')} — ${escapeHtml(sponsor.item)}</p>
        </div>`;
    }

    if (lunch.length > 0) {
        html += `<div style="padding: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-md); border-left: 4px solid var(--primary); margin-bottom: var(--space-sm);">
            <p style="font-size: 0.85rem; font-weight: 700; color: var(--primary); margin-bottom: 6px;">🍚 Lunch:</p>
            ${lunch.map((item, i) => {
                const prepared = subMenu?.lunch?.[i]?.prepared !== false;
                return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
                    <span style="font-size: 0.85rem;">${escapeHtml(item)}</span>
                    <label class="switch" style="transform: scale(0.8);">
                        <input type="checkbox" class="menu-lunch-tick" data-index="${i}" ${prepared ? 'checked' : ''} onchange="updateMenuTick(this)" />
                        <span class="slider round"></span>
                    </label>
                </div>`;
            }).join('')}
        </div>`;
    }

    if (snacks.length > 0) {
        html += `<div style="padding: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-md); border-left: 4px solid #F57C00; margin-bottom: var(--space-sm);">
            <p style="font-size: 0.85rem; font-weight: 700; color: #F57C00; margin-bottom: 6px;">🍪 Snacks:</p>
            ${snacks.map((item, i) => {
                const prepared = subMenu?.snacks?.[i]?.prepared !== false;
                return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
                    <span style="font-size: 0.85rem;">${escapeHtml(item)}</span>
                    <label class="switch" style="transform: scale(0.8);">
                        <input type="checkbox" class="menu-snack-tick" data-index="${i}" ${prepared ? 'checked' : ''} onchange="updateMenuTick(this)" />
                        <span class="slider round"></span>
                    </label>
                </div>`;
            }).join('')}
        </div>`;
    }

    if (submission) {
        let statusBadge = '';
        if (submission.status === 'approved') statusBadge = '<span class="status-badge status-approved" style="margin-left: 6px;">✅ Approved</span>';
        else if (submission.status === 'rejected') statusBadge = '<span class="status-badge status-rejected" style="margin-left: 6px;">❌ Rejected</span>';
        else statusBadge = '<span class="status-badge status-pending" style="margin-left: 6px;">⏳ Pending</span>';
        html += `<div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; margin-top: var(--space-sm);">Status: ${statusBadge}</div>`;
    }

    container.innerHTML = html;
}

function updateMenuTick() { /* No-op — ticks read from DOM on send */ }

// =====================================================
// SEND TO HM (Step 6.4)
// =====================================================
async function sendToHM() {
    if (!currentCook || !currentMenuData) return;

    const btn = document.getElementById('sendToHmBtn');
    btn.disabled = true; btn.innerHTML = 'పంపిస్తోంది...';

    try {
        const dateStr = getTodayStr();
        const lunchItems = Array.from(document.querySelectorAll('.menu-lunch-tick')).map(cb => ({
            item: currentMenuData.lunch[parseInt(cb.dataset.index)],
            prepared: cb.checked
        }));
        const snacksItems = Array.from(document.querySelectorAll('.menu-snack-tick')).map(cb => ({
            item: currentMenuData.snacks[parseInt(cb.dataset.index)],
            prepared: cb.checked
        }));

        const submissionData = {
            cookId: currentCook.id,
            cookName: currentCook.name,
            cookPhone: currentCook.phone,
            date: dateStr,
            day: getTodayDayName(),
            menu: { lunch: lunchItems, snacks: snacksItems },
            sponsor: currentMenuData.sponsor || null,
            isHoliday: false,
            helperAttendance: currentHelpers.map(h => ({ name: h.name, present: h.present })),
            status: todaySubmission?.status === 'approved' ? 'approved' : 'pending',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('cookSubmissions').doc(`${dateStr}_${currentCook.id}`).set(submissionData, { merge: true });
        UI.toast('✅ HM కి పంపబడింది!', 'success');
        await loadTodayMenu();
        await loadMySubmissions();
    } catch (error) {
        console.error('Send error:', error);
        UI.toast('❌ పంపడం విఫలం.', 'error');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> HM కి Send చేయండి';
    }
}

// =====================================================
// MY SUBMISSIONS (Step 6.5)
// =====================================================
async function loadMySubmissions() {
    const container = document.getElementById('mySubmissions');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">లోడ్...</p>`;

    try {
        const snap = await db.collection('cookSubmissions').where('cookId', '==', currentCook.id).get();
        const subs = [];
        snap.forEach(doc => subs.push({ id: doc.id, ...doc.data() }));
        subs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        if (subs.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">ఇంకా submissions లేవు</p>`;
            return;
        }

        container.innerHTML = subs.slice(0, 10).map(s => {
            let bc = 'status-pending', st = '⏳ Pending';
            if (s.status === 'approved') { bc = 'status-approved'; st = '✅ Approved'; }
            else if (s.status === 'rejected') { bc = 'status-rejected'; st = '❌ Rejected'; }
            return `<div style="padding: var(--space-sm) 0; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.85rem; font-weight: 600;">📅 ${escapeHtml(s.date || '')}</span>
                    <span class="status-badge ${bc}">${st}</span>
                </div>
                <p style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">
                    🍚 ${(s.menu?.lunch || []).filter(i => i.prepared).length} / ${(s.menu?.lunch || []).length} items |
                    🍪 ${(s.menu?.snacks || []).filter(i => i.prepared).length} / ${(s.menu?.snacks || []).length}
                </p>
            </div>`;
        }).join('');
    } catch (e) {
        console.error('Load submissions:', e);
        container.innerHTML = `<p style="color: var(--danger); text-align: center; font-size: 0.85rem;">లోడ్ విఫలం</p>`;
    }
}

// =====================================================
// HELPERS
// =====================================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showFormError(el, message) {
    if (el) { el.textContent = message; el.classList.remove('hidden'); }
    else if (typeof UI !== 'undefined') UI.toast(message, 'error');
}

function hideFormError(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
}
