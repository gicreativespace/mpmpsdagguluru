// js/pages/teacher.js

let currentScreen = 'login';
let currentTeacher = null;
let allTeacherDiaries = [];

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
    ['login', 'dashboard', 'diary', 'leave'].forEach(s => {
        const el = document.getElementById('screen' + capitalize(s));
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('screen' + capitalize(name));
    if (target) target.classList.remove('hidden');

    // ✅ backBtn కంట్రోల్ తీసేయబడింది.

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        if (name === 'login') logoutBtn.classList.add('hidden');
        else logoutBtn.classList.remove('hidden');
    }

    const title = document.getElementById('pageTitle');
    if (title) {
        title.textContent = {
            login: 'Teacher Login',
            dashboard: 'Teacher Dashboard',
            diary: 'Diary రాయండి',
            leave: 'Leave మార్క్'
        }[name] || 'Teacher';
    }
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function bindEvents() {
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            if (typeof UI !== 'undefined') UI.toggleTheme();
            const t = document.body.getAttribute('data-theme');
            themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
        });
    }

    // ✅ backBtn ఈవెంట్ తీసేయబడింది.

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

    // ✅ ఫోన్ నంబర్ ఇన్‌పుట్ (teacherId బదులు)
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
// TEACHER LOGIN (Phone Number + PIN)
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
        // ✅ ఫోన్ నంబర్ తో వెతకండి
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
        
        // సేవ్ చేసిన PIN ఫార్ములాతో మ్యాచ్ అవ్వాలి, మరియు టైప్ చేసిన PIN సరిగ్గా ఉండాలి
        if (storedPin !== expectedPin || pin !== expectedPin) {
            return showFormError(errorEl, '❌ తప్పు Master PIN.');
        }

        // ✅ సెషన్ లో ఫోన్ నంబర్ సేవ్ చేయి
        currentTeacher = {
            id: teacherDoc.id,
            name: teacherData.name || 'Teacher',
            phone: teacherData.phone,
            assignments: teacherData.assignments || [],
            role: 'teacher'
        };
        localStorage.setItem('dm_teacher_session', JSON.stringify(currentTeacher));

        UI.toast('✅ Login విజయవంతమైంది!', 'success');
        await loadTeacherData();
        showScreen('dashboard');
    } catch (error) {
        console.error('Login error:', error);
        showFormError(errorEl, 'నెట్‌వర్క్ లోపం. మళ్లీ ప్రయత్నించండి.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'లాగిన్';
    }
}

async function loadTeacherData() {
    if (!currentTeacher) return;

    document.getElementById('teacherWelcomeName').textContent = currentTeacher.name || '—';
    document.getElementById('teacherWelcomeId').textContent = currentTeacher.phone || '—';

    await loadMyDiaries();
}

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
                    <p style="font-size: 0.75rem; margin-top: 4px;">"Diary రాయండి" నొక్కి మొదటి entry రాయండి</p>
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
                <p style="font-size: 0.8rem; margin-top: 4px; white-space: pre-wrap;">${escapeHtml((d.content || '').substring(0, 120))}${(d.content || '').length > 120 ? '...' : ''}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load diaries error:', error);
        if (container) {
            container.innerHTML = `<p style="color: var(--danger); text-align: center; padding: var(--space-sm);">లోడ్ విఫలమైంది</p>`;
        }
    }
}

// =====================================================
// SAVE DIARY (Class & Subject Dropdowns తో)
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
