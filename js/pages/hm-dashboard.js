// js/pages/hm-dashboard.js

let currentSchoolData = null;

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('dm_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);

    const savedSize = localStorage.getItem('dm_font_size');
    if (savedSize) {
        document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');
    }

    // Session చెక్
    const session = Auth.checkAuth('headmaster');
    if (!session) return;

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('dashboardApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        await loadDashboardData();
    }, 1200);

    bindEvents();
});

// =====================================================
// LOAD DASHBOARD DATA
// =====================================================
async function loadDashboardData() {
    try {
        if (typeof authReady !== 'undefined') {
            await Promise.race([
                authReady,
                new Promise(resolve => setTimeout(resolve, 3000))
            ]);
        }

        const doc = await db.collection('schoolInfo').doc('main').get();
        if (!doc.exists) {
            UI.toast('⚠️ పాఠశాల సెటప్ పూర్తి కాలేదు.', 'warning');
            return;
        }

        currentSchoolData = doc.data();

        // Welcome
        document.getElementById('welcomeHmName').textContent = currentSchoolData.hmName || '—';
        document.getElementById('welcomeSchoolName').textContent = currentSchoolData.schoolName || '—';

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
        console.error('Load dashboard error:', error);
        UI.toast('డేటా లోడ్ విఫలమైంది.', 'error');
    }
}

// =====================================================
// EVENT BINDINGS
// =====================================================
function bindEvents() {
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            if (typeof UI !== 'undefined') UI.toggleTheme();
            const t = document.body.getAttribute('data-theme');
            themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
        });
    }

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'headmaster.html';
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('లాగౌట్ చేయాలా?')) {
                Auth.logout();
            }
        });
    }

    // Section toggles
    ['toggleTeacher', 'toggleCook', 'toggleParent', 'toggleOffice'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => handleSectionToggle(el));
        }
    });
}

// =====================================================
// SECTION TOGGLE HANDLER
// =====================================================
async function handleSectionToggle(el) {
    const section = el.getAttribute('data-section');
    const isEnabled = el.checked;

    // Disable while saving
    el.disabled = true;

    try {
        await db.collection('schoolInfo').doc('main').update({
            [`sections.${section}`]: isEnabled
        });

        UI.toast(`✅ ${getSectionLabel(section)} ${isEnabled ? 'ఎనేబుల్' : 'డిసేబుల్'} అయ్యింది!`, 'success', 2000);

        // Update currentSchoolData
        if (!currentSchoolData.sections) currentSchoolData.sections = {};
        currentSchoolData.sections[section] = isEnabled;

    } catch (error) {
        console.error('Toggle error:', error);
        UI.toast('❌ మార్పు సేవ్ అవ్వలేదు.', 'error');
        el.checked = !isEnabled; // revert
    } finally {
        el.disabled = false;
    }
}

function getSectionLabel(section) {
    const labels = {
        teacher: 'Teacher',
        cook: 'Cook',
        parent: 'Parent',
        office: 'Office'
    };
    return labels[section] || section;
}

// =====================================================
// NAVIGATION
// =====================================================
function navigateTo(page) {
    window.location.href = page;
}
