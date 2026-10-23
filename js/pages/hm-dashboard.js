// js/pages/hm-dashboard.js — v12.0 (Premium redesign)
let currentSchoolData = null;

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('dm_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const savedSize = localStorage.getItem('dm_font_size');
    if (savedSize) document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');

    const session = Auth.checkAuth('headmaster');
    if (!session) return;

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('dashboardApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        await loadDashboardData();
        await checkUnreadNotices();
    }, 1200);

    bindEvents();
});

async function loadDashboardData() {
    try {
        if (typeof authReady !== 'undefined') {
            await Promise.race([authReady, new Promise(r => setTimeout(r, 3000))]);
        }

        const doc = await db.collection('schoolInfo').doc('main').get();
        if (!doc.exists) {
            UI.toast('⚠️ పాఠశాల సెటప్ పూర్తి కాలేదు.', 'warning');
            return;
        }

        currentSchoolData = doc.data();

        // Greeting (single line)
        const hour = new Date().getHours();
        let greeting = '👋 స్వాగతం';
        if (hour < 12) greeting = '🌅 శుభోదయం';
        else if (hour < 17) greeting = '☀️ శుభ మధ్యాహ్నం';
        else greeting = '🌙 శుభ సాయంత్రం';

        const greetingEl = document.getElementById('welcomeGreeting');
        if (greetingEl) {
            greetingEl.innerHTML = `${greeting} <span id="welcomeHmName">${escapeHtml(currentSchoolData.hmName || '—')} గారు</span>`;
        }

        const schoolNameEl = document.getElementById('welcomeSchoolName');
        if (schoolNameEl) schoolNameEl.textContent = currentSchoolData.schoolName || '—';

        // School Info
        document.getElementById('infoSchool').textContent = currentSchoolData.schoolName || '—';
        document.getElementById('infoDistrict').textContent = currentSchoolData.district || '—';
        document.getElementById('infoMandal').textContent = currentSchoolData.mandal || '—';
        document.getElementById('infoVillage').textContent = currentSchoolData.village || '—';

        // Section Toggles
        const sections = currentSchoolData.sections || {};
        document.getElementById('toggleTeacher').checked = sections.teacher === true;
        document.getElementById('toggleCook').checked = sections.cook === true;
        document.getElementById('toggleParent').checked = sections.parent === true;
        document.getElementById('toggleOffice').checked = sections.office === true;

    } catch (error) {
        console.error('Load dashboard:', error);
        UI.toast('డేటా లోడ్ విఫలమైంది.', 'error');
    }
}

// =====================================================
// RED DOT — Unread Notices
// =====================================================
async function checkUnreadNotices() {
    try {
        if (typeof UI === 'undefined') return;
        const snap = await db.collection('noticeBoard')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        if (snap.empty) return;
        const latest = snap.docs[0].data();
        const latestTime = latest.createdAt?.toDate
            ? latest.createdAt.toDate()
            : new Date(latest.createdAt || Date.now());
        if (UI.hasUnreadNotices(latestTime.toISOString())) {
            const card = document.getElementById('cardNotice');
            if (card) card.classList.add('notice-badge');
        }
    } catch (err) {
        console.warn('Notice check skipped:', err.message);
    }
}

// =====================================================
// COLLAPSIBLE SCHOOL INFO
// =====================================================
function toggleSchoolInfo() {
    const card = document.getElementById('schoolInfoCard');
    if (!card) return;
    card.classList.toggle('open');
}

// =====================================================
// EVENT BINDINGS
// =====================================================
function bindEvents() {
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', () => {
        if (typeof UI !== 'undefined') UI.toggleTheme();
        themeBtn.textContent = document.body.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        if (typeof UI !== 'undefined' && UI.confirmLogout) UI.confirmLogout();
        else if (typeof Auth !== 'undefined') Auth.logout();
    });

    ['toggleTeacher', 'toggleCook', 'toggleParent', 'toggleOffice'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => handleSectionToggle(el));
    });
}

// =====================================================
// SECTION TOGGLE HANDLER
// =====================================================
async function handleSectionToggle(el) {
    const section = el.getAttribute('data-section');
    const isEnabled = el.checked;
    el.disabled = true;
    try {
        await db.collection('schoolInfo').doc('main').update({
            [`sections.${section}`]: isEnabled
        });
        UI.toast(`✅ ${getSectionLabel(section)} ${isEnabled ? 'ఎనేబుల్' : 'డిసేబుల్'} అయ్యింది!`, 'success', 2000);
        if (!currentSchoolData.sections) currentSchoolData.sections = {};
        currentSchoolData.sections[section] = isEnabled;
    } catch (error) {
        console.error('Toggle error:', error);
        UI.toast('❌ మార్పు సేవ్ అవ్వలేదు.', 'error');
        el.checked = !isEnabled;
    } finally {
        el.disabled = false;
    }
}

function getSectionLabel(section) {
    const labels = {
        teacher: 'Teacher', cook: 'Cook',
        parent: 'Parent', office: 'Office'
    };
    return labels[section] || section;
}

// =====================================================
// NAVIGATION
// =====================================================
function navigateTo(page) {
    window.location.href = page;
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
