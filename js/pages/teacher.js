// js/pages/teacher.js — Digital Manabadi v12.0 (Step 2.4)
// Changes:
//  - UI.initLayout() + custom back button
//  - Welcome "గారు"
//  - Assigned classes dashboard
//  - I am on Leave toggle
//  - Attendance C2 → Step 5.4 (kept old for now, will change)
//  - Diary edit / announcement → Step 5.5/5.6

let currentScreen = 'login';
let currentTeacher = null;
let allTeacherDiaries = [];
let currentStudentsForAttendance = [];

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

    // ✅ UI init (footer, red dot, valiass popup)
    if (typeof UI !== 'undefined') {
        UI.initLayout();
    }

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('teacherApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);

        // ✅ Custom back button (multi-screen)
        addCustomBackButton();

        await decideScreen();
    }, 1200);

    bindEvents();
});

// =====================================================
// CUSTOM BACK BUTTON
// =====================================================
function addCustomBackButton() {
    const header = document.querySelector('.app-header');
    if (!header) return;

    let backBtn = header.querySelector('#backBtn');
    if (backBtn) backBtn.remove();

    backBtn = document.createElement('button');
    backBtn.id = 'backBtn';
    backBtn.className = 'icon-btn back-btn hidden';
    backBtn.setAttribute('aria-label', 'Back');
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';

    backBtn.addEventListener('click', () => {
        if (currentScreen === 'diary' || currentScreen === 'attendance' || currentScreen === 'leave') {
            showScreen('dashboard');
        } else if (currentScreen === 'login') {
            // Login లో back → auto logoff
            localStorage.removeItem('dm_teacher_session');
            window.location.href = 'index.html';
        }
    });

    header.insertBefore(backBtn, header.firstChild);
}

// =====================================================
// SCREEN DECISION
// =====================================================
async function decideScreen() {
    try {
        if (typeof authReady !== 'undefined') {
            await Promise.race([authReady, new Promise(r => setTimeout(r, 3000))]);
        }

        const session = localStorage.getItem('dm_teacher_session');
        if (session) {
            const s = JSON.parse(session);
            currentTeacher = s;

            const savedName = localStorage.getItem('dm_teacher_name');
            if (!savedName) {
                showScreen('namePrompt');
                return;
            }

            currentTeacher.name = savedName;
            await loadTeacherData();
            showScreen('dashboard');
            return;
        }

        const schoolDoc = await db.collection('schoolInfo').doc('main').get();
        if (!schoolDoc.exists || !schoolDoc.data().isSetupComplete) {
            UI.toast('⚠️ పాఠశాల సెటప్ పూర్తి కాలేదు.', 'warning', 5000);
            showScreen('login');
            return;
        }

        if (schoolDoc.data().sections?.teacher !== true) {
            UI.toast('⚠️ Teacher సెక్షన్ ఇంకా ఎనేబుల్ చేయలేదు.', 'warning', 5000);
            showScreen('login');
            return;
        }

        showScreen('login');
    } catch (error) {
        console.error('Screen decision error:', error);
        showScreen('login');
    }
}

// =====================================================
// SCREEN SWITCHER
// =====================================================
function showScreen(name) {
    currentScreen = name;
    ['login', 'namePrompt', 'dashboard', 'diary', 'attendance', 'leave'].forEach(s => {
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
        title.textContent = {
            login: 'Teacher Login',
            namePrompt: 'Welcome',
            dashboard: 'Teacher Dashboard',
            diary: 'Diary',
            attendance: 'Attendance',
            leave: 'Leave'
        }[name] || 'Teacher';
    }

    if (name === 'diary') {
        const dateInput = document.getElementById('diaryDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// =====================================================
// EVENT BINDINGS
// =====================================================
function bindEvents() {
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            if (typeof UI !== 'undefined') UI.toggleTheme();
            themeBtn.textContent = document.body.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('లాగౌట్ చేయాలా?')) {
                localStorage.removeItem('dm_teacher_session');
                window.location.href = 'index.html';
            }
        });
    }

    document.querySelectorAll('.pin-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;
            const isPwd = input.type === 'password';
            input.type = isPwd ? 'text' : 'password';
            btn.textContent = isPwd ? '🙈' : '👁';
        });
    });

    const phoneInput = document.getElementById('teacherPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', () => {
            phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
        });
    }

    const pinInput = document.getElementById('teacherPin');
    if (pinInput) {
        pinInput.addEventListener('input', () => {
            pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
        });
    }

    const loginForm = document.getElementById('teacherLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleTeacherLogin();
        });
    }

    const nameForm = document.getElementById('nameForm');
    if (nameForm) {
        nameForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSaveName();
        });
    }

    const diaryForm = document.getElementById('diaryForm');
    if (diaryForm) {
        diaryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSaveDiary();
        });
    }

    const leaveForm = document.getElementById('leaveForm');
    if (leaveForm) {
        leaveForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSaveLeave();
        });
    }

    const attendanceClassSelect = document.getElementById('attendanceClass');
    if (attendanceClassSelect) {
        attendanceClassSelect.addEventListener('change', loadAttendanceStudents);
    }
}

// =====================================================
// TEACHER LOGIN
// =====================================================
async function handleTeacherLogin() {
    const phone = document.getElementById('teacherPhone').value.trim();
    const pin = document.getElementById('teacherPin').value;
    const errorEl = document.getElementById('teacherLoginError');
    const btn = document.getElementById('teacherLoginBtn');

    if (!/^\d{10}$/.test(phone)) return showFormError(errorEl, '10 అంకెల ఫోన్ నంబర్ నింపండి.');
    if (!/^\d{4}$/.test(pin)) return showFormError(errorEl, 'Master PIN 4 అంకెలు ఉండాలి.');

    btn.disabled = true;
    btn.textContent = 'లాగిన్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        const snapshot = await db.collection('users')
            .where('phone', '==', phone)
            .where('role', '==', 'teacher')
            .limit(1)
            .get();

        if (snapshot.empty) {
            return showFormError(errorEl, '❌ ఈ ఫోన్ నంబర్ కనుగొనబడలేదు. HM ని సంప్రదించండి.');
        }

        const teacherDoc = snapshot.docs[0];
        const teacherData = teacherDoc.data();

        if (teacherData.isActive === false) {
            return showFormError(errorEl, '🔒 మీ ఖాతా నిలిపివేయబడింది. HM ని సంప్రదించండి.');
        }

        // Master PIN formula
        const last4 = parseInt(phone.slice(-4), 10);
        let expectedPin = 9999 - last4;
        if (expectedPin < 0) expectedPin = expectedPin + 10000;
        expectedPin = String(expectedPin).padStart(4, '0');

        const storedPin = String(teacherData.masterPin || '').trim();
        if (storedPin !== expectedPin || pin !== expectedPin) {
            return showFormError(errorEl, '❌ తప్పు Master PIN.');
        }

        currentTeacher = {
            id: teacherDoc.id,
            name: teacherData.name || '',
            phone: teacherData.phone,
            assignments: teacherData.assignments || [],
            role: 'teacher'
        };
        localStorage.setItem('dm_teacher_session', JSON.stringify(currentTeacher));

        const savedName = localStorage.getItem('dm_teacher_name');
        if (!savedName) {
            UI.toast('✅ Login విజయవంతమైంది!', 'success');
            showScreen('namePrompt');
        } else {
            currentTeacher.name = savedName;
            UI.toast(`✅ స్వాగతం ${savedName} గారు!`, 'success');
            await loadTeacherData();
            showScreen('dashboard');
        }
    } catch (error) {
        console.error('Login error:', error);
        showFormError(errorEl, 'నెట్‌వర్క్ లోపం. మళ్లీ ప్రయత్నించండి.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'లాగిన్';
    }
}

function handleSaveName() {
    const name = document.getElementById('teacherNameInput').value.trim();
    const errorEl = document.getElementById('nameError');

    if (!name) return showFormError(errorEl, 'మీ పేరు నింపండి.');

    localStorage.setItem('dm_teacher_name', name);
    currentTeacher.name = name;

    UI.toast(`✅ స్వాగతం ${name} గారు!`, 'success');
    loadTeacherData();
    showScreen('dashboard');
}

// =====================================================
// LOAD DATA
// =====================================================
async function loadTeacherData() {
    if (!currentTeacher) return;

    const hour = new Date().getHours();
    let greeting = '👋 స్వాగతం';
    if (hour < 12) greeting = '🌅 శుభోదయం';
    else if (hour < 17) greeting = '☀️ శుభ మధ్యాహ్నం';
    else greeting = '🌙 శుభ సాయంత్రం';

    const greetingEl = document.getElementById('greetingText');
    if (greetingEl) greetingEl.textContent = greeting;

    const nameEl = document.getElementById('teacherWelcomeName');
    if (nameEl) nameEl.textContent = `${currentTeacher.name || '—'} గారు`;

    const phoneEl = document.getElementById('teacherWelcomePhone');
    if (phoneEl) phoneEl.textContent = currentTeacher.phone || '—';

    populateClassDropdowns();
