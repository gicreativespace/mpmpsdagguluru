// js/pages/teacher.js

let currentScreen = 'login';
let currentTeacher = null;
let allTeacherDiaries = [];

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

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('teacherApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        await decideScreen();
    }, 1200);

    bindEvents();
});

async function decideScreen() {
    try {
        if (typeof authReady !== 'undefined') {
            await Promise.race([
                authReady,
                new Promise(resolve => setTimeout(resolve, 3000))
            ]);
        }

        const session = localStorage.getItem('dm_teacher_session');
        if (session) {
            const s = JSON.parse(session);
            currentTeacher = s;
            
            // ✅ పేరు లోకల్ స్టోరేజ్ లో ఉందా చెక్ చేయి
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
            UI.toast('⚠️ పాఠశాల సెటప్ పూర్తి కాలేదు. హెడ్‌మాస్టర్‌ని సంప్రదించండి.', 'warning', 5000);
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

function showScreen(name) {
    currentScreen = name;
    ['login', 'namePrompt', 'dashboard', 'diary', 'leave'].forEach(s => {
        const el = document.getElementById('screen' + capitalize(s));
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('screen' + capitalize(name));
    if (target) target.classList.remove('hidden');

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
            diary: 'Diary రాయండి',
            leave: 'Leave మార్క్'
        }[name] || 'Teacher';
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
            const t = document.body.getAttribute('data-theme');
            themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('లాగౌట్ చేయాలా?')) {
                localStorage.removeItem('dm_teacher_session');
                // ✅ పేరు లోకల్ స్టోరేజ్ లో ఉంచుతాము, తద్వారా మళ్లీ లాగిన్ అయినప్పుడు అడగక్కర్లేదు
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

    const teacherPhoneInput = document.getElementById('teacherPhone');
    if (teacherPhoneInput) {
        teacherPhoneInput.addEventListener('input', () => {
            teacherPhoneInput.value = teacherPhoneInput.value.replace(/\D/g, '').slice(0, 10);
        });
    }

    const teacherPinInput = document.getElementById('teacherPin');
    if (teacherPinInput) {
        teacherPinInput.addEventListener('input', () => {
            teacherPinInput.value = teacherPinInput.value.replace(/\D/g, '').slice(0, 4);
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

        // ✅ PIN ఫార్ములా: 9999 - ఫోన్ చివరి 4 అంకెలు
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

        // ✅ పేరు ఉందా చెక్ చేయి
        const savedName = localStorage.getItem('dm_teacher_name');
        if (!savedName) {
            UI.toast('✅ Login విజయవంతమైంది!', 'success');
            showScreen('namePrompt');
        } else {
            currentTeacher.name = savedName;
            UI.toast(`✅ స్వాగతం ${savedName}!`, 'success');
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

// =====================================================
// SAVE NAME (First time only)
// =====================================================
function handleSaveName() {
    const name = document.getElementById('teacherNameInput').value.trim();
    const errorEl = document.getElementById('nameError');

    if (!name) {
        return showFormError(errorEl, 'మీ పేరు నింపండి.');
    }

    // ✅ లోకల్ స్టోరేజ్ లో సేవ్ చేయి
    localStorage.setItem('dm_teacher_name', name);
    currentTeacher.name = name;

    UI.toast(`✅ స్వాగతం ${name}!`, 'success');
    loadTeacherData();
    showScreen('dashboard');
}

// =====================================================
// LOAD TEACHER DATA
// =====================================================
async function loadTeacherData() {
    if (!currentTeacher) return;

    // ✅ సమయాన్ని బట్టి గ్రీటింగ్
    const hour = new Date().getHours();
    let greeting = '👋 స్వాగతం';
    if (hour < 12) greeting = '🌅 శుభోదయం';
    else if (hour < 17) greeting = '☀️ శుభ మధ్యాహ్నం';
    else greeting = '🌙 శుభ సాయంత్రం';

    const greetingEl = document.getElementById('greetingText');
    if (greetingEl) greetingEl.textContent = `${greeting}, ${currentTeacher.name || ''}!`;

    document.getElementById('teacherWelcomeName').textContent = currentTeacher.name || '—';
    document.getElementById('teacherWelcomePhone').textContent = currentTeacher.phone || '—';

    populateClassDropdown();
    await loadMyDiaries();
}

// =====================================================
// CLASS & SUBJECT DROPDOWN LOGIC
// =====================================================
function populateClassDropdown() {
    const classSelect = document.getElementById('diaryClass');
    if (!classSelect) return;

    classSelect.innerHTML = '<option value="">-- Class ఎంచుకోండి --</option>';

    const assignments = currentTeacher.assignments || [];
    const uniqueClasses = [...new Set(assignments.map(a => a.className))];

    if (uniqueClasses.length === 0) {
        classSelect.innerHTML = '<option value="">ఏ క్లాస్ అసైన్ చేయలేదు</option>';
        return;
    }

    uniqueClasses.forEach(className => {
        const opt = document.createElement('option');
        opt.value = className;
        opt.textContent = className;
        classSelect.appendChild(opt);
    });

    classSelect.addEventListener('change', populateSubjectDropdown);
}

function populateSubjectDropdown() {
    const classSelect = document.getElementById('diaryClass');
    const subjectSelect = document.getElementById('diarySubject');
    if (!classSelect || !subjectSelect) return;

    const selectedClass = classSelect.value;
    subjectSelect.innerHTML = '<option value="">-- Subject ఎంచుకోండి --</option>';

    if (!selectedClass) return;

    const assignments = currentTeacher.assignments || [];
    const subjects = assignments
        .filter(a => a.className === selectedClass)
        .map(a => a.subject);

    subjects.forEach(subject => {
        const opt = document.createElement('option');
        opt.value = subject;
        opt.textContent = subject;
        subjectSelect.appendChild(opt);
    });
}

// =====================================================
// LOAD DIARIES
// =====================================================
async function loadMyDiaries() {
    if (!currentTeacher) return;

    const container = document.getElementById('myDiariesList');
    if (container) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-sm);">లోడ్ అవుతోంది...</p>`;
    }

    try {
        const snapshot = await db.collection('diary')
            .where('teacherId', '==', currentTeacher.id)
            .get();

        allTeacherDiaries = [];
        snapshot.forEach(doc => {
            allTeacherDiaries.push({ id: doc.id, ...doc.data() });
        });

        allTeacherDiaries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        if (allTeacherDiaries.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: var(--space-md); color: var(--text-muted);">
                    <p style="font-size: 0.85rem;">ఇంకా diary entries లేవు</p>
                </div>
            `;
            return;
        }

        container.innerHTML = allTeacherDiaries.slice(0, 10).map(d => `
            <div style="padding: var(--space-sm) 0; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 0.85rem; font-weight: 600;">${escapeHtml(d.className || '—')} • ${escapeHtml(d.subject || '')}</span>
                    <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: ${d.isApproved ? 'var(--success)' : '#F9A825'}; color: #fff; font-weight: 600;">
                        ${d.isApproved ? '✅ Approved' : '⏳ Pending'}
                    </span>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-muted);">📅 ${escapeHtml(d.date || '—')}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load diaries error:', error);
    }
}

// =====================================================
// SAVE DIARY
// =====================================================
async function handleSaveDiary() {
    if (!currentTeacher) {
        showFormError(document.getElementById('diaryError'), 'Session expire అయ్యింది. మళ్లీ login చేయండి.');
        return;
    }

    const date = document.getElementById('diaryDate').value;
    const className = document.getElementById('diaryClass').value;
    const subject = document.getElementById('diarySubject').value;
    const content = document.getElementById('diaryContent').value.trim();
    const homework = document.getElementById('diaryHomework').value.trim();
    const errorEl = document.getElementById('diaryError');
    const btn = document.getElementById('diarySubmitBtn');

    if (!date) return showFormError(errorEl, 'తేదీ ఎంచుకోండి.');
    if (!className) return showFormError(errorEl, 'Class ఎంచుకోండి.');
    if (!subject) return showFormError(errorEl, 'Subject ఎంచుకోండి.');
    if (!content) return showFormError(errorEl, 'ఏమి చెప్పారో రాయండి.');

    btn.disabled = true;
    btn.innerHTML = 'సేవ్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        await db.collection('diary').add({
            teacherId: currentTeacher.id,
            teacherName: currentTeacher.name,
            teacherPhone: currentTeacher.phone,
            date: date,
            className: className,
            subject: subject,
            content: content,
            homework: homework || null,
            isApproved: false,
            approvedAt: null,
            approvedBy: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        UI.toast('✅ Diary విజయవంతంగా సేవ్ అయ్యింది!', 'success');
        document.getElementById('diaryForm').reset();
        document.getElementById('diarySubject').innerHTML = '<option value="">-- Subject ఎంచుకోండి --</option>';
        await loadMyDiaries();
        showScreen('dashboard');
    } catch (error) {
        console.error('Save diary error:', error);
        showFormError(errorEl, 'సేవ్ విఫలమైంది. మళ్లీ ప్రయత్నించండి.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save" style="margin-right: 8px;"></i> Diary Save చేయండి';
    }
}

// =====================================================
// SAVE LEAVE
// =====================================================
async function handleSaveLeave() {
    if (!currentTeacher) return;

    const fromDate = document.getElementById('leaveFrom').value;
    const toDate = document.getElementById('leaveTo').value;
    const reason = document.getElementById('leaveReason').value.trim();
    const errorEl = document.getElementById('leaveError');
    const btn = document.getElementById('leaveSubmitBtn');

    if (!fromDate || !toDate) return showFormError(errorEl, 'From/To తేదీలు ఎంచుకోండి.');
    if (new Date(toDate) < new Date(fromDate)) return showFormError(errorEl, 'To Date, From Date కన్నా తర్వాత ఉండాలి.');
    if (!reason) return showFormError(errorEl, 'కారణం రాయండి.');

    btn.disabled = true;
    btn.innerHTML = 'సబ్మిట్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        await db.collection('leaveLetters').add({
            teacherId: currentTeacher.id,
            teacherName: currentTeacher.name,
            teacherPhone: currentTeacher.phone,
            fromDate: fromDate,
            toDate: toDate,
            reason: reason,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        UI.toast('✅ Leave విజయవంతంగా సబ్మిట్ అయ్యింది!', 'success');
        document.getElementById('leaveForm').reset();
        showScreen('dashboard');
    } catch (error) {
        console.error('Leave error:', error);
        showFormError(errorEl, 'సబ్మిట్ విఫలమైంది. మళ్లీ ప్రయత్నించండి.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right: 8px;"></i> Leave Submit చేయండి';
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
    if (el) {
        el.textContent = message;
        el.classList.remove('hidden');
    } else if (typeof UI !== 'undefined') {
        UI.toast(message, 'error');
    }
}

function hideFormError(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
}
