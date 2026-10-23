// js/pages/teacher.js — v12.0 (Step 5.7 — Submitted tabs)
let currentScreen = 'login';
let currentTeacher = null;
let allTeacherDiaries = [];
let currentStudentsForAttendance = [];
let editingDiaryId = null;
let currentSubmittedTab = 'diary';

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('dm_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const savedSize = localStorage.getItem('dm_font_size');
    if (savedSize) document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');

    if (typeof UI !== 'undefined') UI.initLayout();

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('teacherApp');
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

    // ✅ FIX: Auto back button తీసేయి (duplicate prevent)
    const autoBack = header.querySelector('.auto-back-btn');
    if (autoBack) autoBack.remove();

    // ✅ FIX: ఇప్పటికే custom back ఉందా? → skip
    if (header.querySelector('#backBtn')) return;

    const backBtn = document.createElement('button');
    backBtn.id = 'backBtn';
    backBtn.className = 'icon-btn back-btn hidden';
    backBtn.setAttribute('aria-label', 'Back');
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
    backBtn.addEventListener('click', () => {
        if (currentScreen === 'diary' || currentScreen === 'attendance' || currentScreen === 'leave' || currentScreen === 'editDiary' || currentScreen === 'announcement') {
            showScreen('dashboard');
        } else if (currentScreen === 'login') {
            localStorage.removeItem('dm_teacher_session');
            window.location.href = 'index.html';
        }
    });
    header.insertBefore(backBtn, header.firstChild);
}
async function decideScreen() {
    try {
        if (typeof authReady !== 'undefined') await Promise.race([authReady, new Promise(r => setTimeout(r, 3000))]);
        const session = localStorage.getItem('dm_teacher_session');
        if (session) {
            const s = JSON.parse(session);
            currentTeacher = s;
            const savedName = localStorage.getItem('dm_teacher_name');
            if (!savedName) { showScreen('namePrompt'); return; }
            currentTeacher.name = savedName;
            await loadTeacherData();
            showScreen('dashboard');
            return;
        }
        const schoolDoc = await db.collection('schoolInfo').doc('main').get();
        if (!schoolDoc.exists || !schoolDoc.data().isSetupComplete) {
            UI.toast('⚠️ సెటప్ పూర్తి కాలేదు.', 'warning', 5000);
            showScreen('login'); return;
        }
        if (schoolDoc.data().sections?.teacher !== true) {
            UI.toast('⚠️ Teacher సెక్షన్ ఎనేబుల్ కాలేదు.', 'warning', 5000);
            showScreen('login'); return;
        }
        showScreen('login');
    } catch (error) {
        console.error('Screen decision:', error);
        showScreen('login');
    }
}

function showScreen(name) {
    currentScreen = name;
    ['login', 'namePrompt', 'dashboard', 'diary', 'attendance', 'leave', 'editDiary', 'announcement'].forEach(s => {
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
            login: 'Teacher Login', namePrompt: 'Welcome', dashboard: 'Teacher Dashboard',
            diary: 'Diary', attendance: 'Attendance', leave: 'Leave', editDiary: 'Edit Diary',
            announcement: 'Announcement'
        }[name] || 'Teacher';
    }
    if (name === 'diary') {
        const dateInput = document.getElementById('diaryDate');
        if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
    }
    if (name === 'announcement') loadMyAnnouncements();
    if (name === 'dashboard') {
        loadMyDiaries();
        loadMyAttendance();
        loadMyLeaves();
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
            localStorage.removeItem('dm_teacher_session');
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
    const phoneInput = document.getElementById('teacherPhone');
    if (phoneInput) phoneInput.addEventListener('input', () => {
        phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
    });
    const pinInput = document.getElementById('teacherPin');
    if (pinInput) pinInput.addEventListener('input', () => {
        pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
    });
    const loginForm = document.getElementById('teacherLoginForm');
    if (loginForm) loginForm.addEventListener('submit', e => { e.preventDefault(); handleTeacherLogin(); });
    const nameForm = document.getElementById('nameForm');
    if (nameForm) nameForm.addEventListener('submit', e => { e.preventDefault(); handleSaveName(); });
    const diaryForm = document.getElementById('diaryForm');
    if (diaryForm) diaryForm.addEventListener('submit', e => { e.preventDefault(); handleSaveDiary(); });
    const leaveForm = document.getElementById('leaveForm');
    if (leaveForm) leaveForm.addEventListener('submit', e => { e.preventDefault(); handleSaveLeave(); });
    const editDiaryForm = document.getElementById('editDiaryForm');
    if (editDiaryForm) editDiaryForm.addEventListener('submit', e => { e.preventDefault(); handleSaveEditDiary(); });
    const announcementForm = document.getElementById('announcementForm');
    if (announcementForm) announcementForm.addEventListener('submit', e => { e.preventDefault(); handleSendAnnouncement(); });
    const attendanceClassSelect = document.getElementById('attendanceClass');
    if (attendanceClassSelect) attendanceClassSelect.addEventListener('change', loadAttendanceStudents);
}

async function handleTeacherLogin() {
    const phone = document.getElementById('teacherPhone').value.trim();
    const pin = document.getElementById('teacherPin').value;
    const errorEl = document.getElementById('teacherLoginError');
    const btn = document.getElementById('teacherLoginBtn');
    if (!/^\d{10}$/.test(phone)) return showFormError(errorEl, '10 అంకెల ఫోన్ నింపండి.');
    if (!/^\d{4}$/.test(pin)) return showFormError(errorEl, 'PIN 4 అంకెలు.');
    btn.disabled = true; btn.textContent = 'లాగిన్...'; hideFormError(errorEl);
    try {
        const snapshot = await db.collection('users').where('phone', '==', phone).where('role', '==', 'teacher').limit(1).get();
        if (snapshot.empty) {
            btn.disabled = false; btn.textContent = 'లాగిన్';
            return showFormError(errorEl, '❌ ఫోన్ కనుగొనబడలేదు.');
        }
        const teacherDoc = snapshot.docs[0];
        const teacherData = teacherDoc.data();
        if (teacherData.isActive === false) {
            btn.disabled = false; btn.textContent = 'లాగిన్';
            return showFormError(errorEl, '🔒 ఖాతా నిలిపివేయబడింది.');
        }
        const last4 = parseInt(phone.slice(-4), 10);
        let expectedPin = 9999 - last4;
        if (expectedPin < 0) expectedPin = expectedPin + 10000;
        expectedPin = String(expectedPin).padStart(4, '0');
        const storedPin = String(teacherData.masterPin || '').trim();
        if (storedPin !== expectedPin || pin !== expectedPin) {
            btn.disabled = false; btn.textContent = 'లాగిన్';
            return showFormError(errorEl, '❌ తప్పు Master PIN.');
        }
        currentTeacher = {
            id: teacherDoc.id, name: teacherData.name || '',
            phone: teacherData.phone, assignments: teacherData.assignments || [], role: 'teacher'
        };
        localStorage.setItem('dm_teacher_session', JSON.stringify(currentTeacher));
        const savedName = localStorage.getItem('dm_teacher_name');
        if (!savedName) {
            UI.toast('✅ Login విజయవంతం!', 'success');
            showScreen('namePrompt');
        } else {
            currentTeacher.name = savedName;
            UI.toast(`✅ స్వాగతం ${savedName} గారు!`, 'success');
            await loadTeacherData();
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
    const name = document.getElementById('teacherNameInput').value.trim();
    const errorEl = document.getElementById('nameError');
    if (!name) return showFormError(errorEl, 'పేరు నింపండి.');
    localStorage.setItem('dm_teacher_name', name);
    currentTeacher.name = name;
    UI.toast(`✅ స్వాగతం ${name} గారు!`, 'success');
    loadTeacherData();
    showScreen('dashboard');
}

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
    renderAssignedClasses();
    await loadMyDiaries();
    await loadMyAttendance();
    await loadMyLeaves();
    await checkOnLeaveToggle();
    await loadMyAnnouncements();
}

function populateClassDropdowns() {
    const assignments = currentTeacher.assignments || [];
    const uniqueClasses = [...new Set(assignments.map(a => a.className))];
    const diaryClassSelect = document.getElementById('diaryClass');
    if (diaryClassSelect) {
        diaryClassSelect.innerHTML = '<option value="">-- Class ఎంచుకోండి --</option>';
        uniqueClasses.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            diaryClassSelect.appendChild(opt);
        });
        diaryClassSelect.addEventListener('change', populateSubjectsForDiary);
    }
    const attendanceClassSelect = document.getElementById('attendanceClass');
    if (attendanceClassSelect) {
        attendanceClassSelect.innerHTML = '<option value="">-- Class ఎంచుకోండి --</option>';
        uniqueClasses.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            attendanceClassSelect.appendChild(opt);
        });
    }
}

function renderAssignedClasses() {
    const container = document.getElementById('assignedClassesList');
    if (!container) return;
    const assignments = currentTeacher.assignments || [];
    if (assignments.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">Classes assign చేయలేదు.</p>`;
        return;
    }
    const grouped = {};
    assignments.forEach(a => {
        if (!grouped[a.className]) grouped[a.className] = [];
        grouped[a.className].push(a.subject);
    });
    container.innerHTML = Object.entries(grouped).map(([c, subs]) => `
        <div style="padding: var(--space-sm); border-bottom: 1px solid var(--border-color);">
            <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">${escapeHtml(c)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${subs.map(s => `📖 ${escapeHtml(s)}`).join(' • ')}</div>
        </div>
    `).join('');
}

async function handleOnLeaveToggle(el) {
    if (!currentTeacher) return;
    const isOn = el.checked;
    const today = new Date().toISOString().split('T')[0];
    try {
        await db.collection('users').doc(currentTeacher.id).update({ onLeaveDate: isOn ? today : null });
        UI.toast(isOn ? '✅ Leave గా మార్క్!' : '✅ Leave తీసేయబడింది.', 'success', 3000);
    } catch (err) {
        console.error('Toggle:', err);
        UI.toast('Toggle విఫలం.', 'error');
        el.checked = !isOn;
    }
}

async function checkOnLeaveToggle() {
    if (!currentTeacher) return;
    try {
        const doc = await db.collection('users').doc(currentTeacher.id).get();
        const data = doc.data() || {};
        const today = new Date().toISOString().split('T')[0];
        const toggle = document.getElementById('onLeaveToggle');
        if (toggle) toggle.checked = data.onLeaveDate === today;
    } catch (err) { console.warn('Toggle check:', err); }
}

// =====================================================
// SUBMITTED TABS (Step 5.7)
// =====================================================
function switchSubmittedTab(tab) {
    currentSubmittedTab = tab;
    const diaryList = document.getElementById('myDiariesList');
    const attendanceList = document.getElementById('myAttendanceList');
    const leavesList = document.getElementById('myLeavesList');
    const tabDiary = document.getElementById('tabMyDiary');
    const tabAttendance = document.getElementById('tabMyAttendance');
    const tabLeave = document.getElementById('tabMyLeave');

    if (tab === 'diary') {
        diaryList.style.display = 'block';
        attendanceList.style.display = 'none';
        leavesList.style.display = 'none';
        tabDiary.className = 'btn btn-primary';
        tabAttendance.className = 'btn btn-outline';
        tabLeave.className = 'btn btn-outline';
    } else if (tab === 'attendance') {
        diaryList.style.display = 'none';
        attendanceList.style.display = 'block';
        leavesList.style.display = 'none';
        tabDiary.className = 'btn btn-outline';
        tabAttendance.className = 'btn btn-primary';
        tabLeave.className = 'btn btn-outline';
        loadMyAttendance();
    } else {
        diaryList.style.display = 'none';
        attendanceList.style.display = 'none';
        leavesList.style.display = 'block';
        tabDiary.className = 'btn btn-outline';
        tabAttendance.className = 'btn btn-outline';
        tabLeave.className = 'btn btn-primary';
        loadMyLeaves();
    }
}

function populateSubjectsForDiary() {
    const classSelect = document.getElementById('diaryClass');
    const container = document.getElementById('subjectsContainer');
    if (!classSelect || !container) return;
    const selectedClass = classSelect.value;
    container.innerHTML = '';
    if (!selectedClass) return;
    const assignments = currentTeacher.assignments || [];
    const subjects = assignments.filter(a => a.className === selectedClass).map(a => a.subject);
    if (subjects.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted);">సబ్జెక్టులు లేవు.</p>`;
        return;
    }
    subjects.forEach((subject, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'background: var(--bg-color); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--border-color);';
        div.innerHTML = `
            <h4 style="color: var(--primary); margin-bottom: var(--space-sm); font-size: 1rem;">📚 ${escapeHtml(subject)}</h4>
            <div class="field"><label>Class Work</label>
                <textarea class="classwork-input" data-subject="${escapeHtml(subject)}" rows="3" style="height: auto; min-height: 70px; padding: 10px; resize: vertical;"></textarea>
            </div>
            <div class="field" style="margin-top: var(--space-sm);"><label>Home Work</label>
                <textarea class="homework-input" data-subject="${escapeHtml(subject)}" rows="2" style="height: auto; min-height: 60px; padding: 10px; resize: vertical;"></textarea>
            </div>`;
        container.appendChild(div);
    });
}

// =====================================================
// LOAD MY DIARIES
// =====================================================
async function loadMyDiaries() {
    if (!currentTeacher) return;
    const container = document.getElementById('myDiariesList');
    if (container) container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-sm);">లోడ్...</p>`;
    try {
        const snapshot = await db.collection('diary').where('teacherId', '==', currentTeacher.id).get();
        allTeacherDiaries = [];
        snapshot.forEach(doc => allTeacherDiaries.push({ id: doc.id, ...doc.data() }));
        allTeacherDiaries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        if (allTeacherDiaries.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: var(--space-md); color: var(--text-muted);"><p style="font-size: 0.85rem;">ఇంకా diary entries లేవు</p></div>`;
            return;
        }
        container.innerHTML = allTeacherDiaries.slice(0, 15).map(d => {
            let sc = 'status-pending', st = '⏳ Pending';
            if (d.isApproved) { sc = 'status-approved'; st = '✅ Approved'; }
            else if (d.isRejected) { sc = 'status-rejected'; st = '❌ Rejected'; }
            const canEdit = !d.isApproved && !d.isRejected;
            return `
            <div style="padding: var(--space-sm) 0; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 0.85rem; font-weight: 600;">${escapeHtml(d.className || '—')} • ${escapeHtml(d.subject || '')}</span>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <span class="status-badge ${sc}">${st}</span>
                        ${canEdit ? `<button class="icon-btn" onclick="openEditDiary('${d.id}')" title="Edit" style="width: 30px; height: 30px; background: var(--primary); color: #fff; font-size: 0.75rem;"><i class="fas fa-edit"></i></button>` : `<button class="icon-btn" disabled title="Locked" style="width: 30px; height: 30px; background: var(--text-muted); color: #fff; font-size: 0.75rem; opacity: 0.5;"><i class="fas fa-lock"></i></button>`}
                    </div>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-muted);">📅 ${escapeHtml(d.date || '—')}</p>
            </div>`;
        }).join('');
    } catch (error) { console.error('Load diaries:', error); }
}

// =====================================================
// LOAD MY ATTENDANCE (Step 5.7)
// =====================================================
async function loadMyAttendance() {
    if (!currentTeacher) return;
    const container = document.getElementById('myAttendanceList');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-sm);">లోడ్...</p>`;

    try {
        const assignments = currentTeacher.assignments || [];
        const uniqueClasses = [...new Set(assignments.map(a => a.className))];

        if (uniqueClasses.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">Classes assign చేయలేదు</p>`;
            return;
        }

        const now = new Date();
        const eduYear = getEduYear();
        const month = getMonthName(now);

        const allItems = [];

        for (const cls of uniqueClasses) {
            const doc = await db.collection('attendance').doc(eduYear).collection(cls).doc(month).get();
            if (doc.exists) {
                const data = doc.data();
                const days = data.days || {};
                const dates = Object.keys(days).sort().reverse();
                dates.forEach(dateStr => {
                    const dayData = days[dateStr];
                    const entries = Object.values(dayData);
                    const present = entries.filter(e => e.status === 'present').length;
                    const absent = entries.filter(e => e.status === 'absent').length;
                    const leave = entries.filter(e => e.status === 'leave').length;
                    allItems.push({
                        className: cls,
                        date: dateStr,
                        present, absent, leave,
                        approved: data.approved === true
                    });
                });
            }
        }

        allItems.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        if (allItems.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">ఈ నెల attendance ఇంకా submit చేయలేదు</p>`;
            return;
        }

        container.innerHTML = allItems.slice(0, 15).map(a => {
            const bc = a.approved ? 'status-approved' : 'status-pending';
            const st = a.approved ? '✅ Approved' : '⏳ Pending';
            return `<div style="padding: var(--space-sm) 0; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 0.85rem; font-weight: 600;">${escapeHtml(a.className)} — 📅 ${escapeHtml(a.date)}</span>
                    <span class="status-badge ${bc}">${st}</span>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-muted);">
                    ✅ ${a.present} | ❌ ${a.absent} | 📅 ${a.leave}
                </p>
            </div>`;
        }).join('');
    } catch (e) {
        console.error('Load attendance:', e);
        container.innerHTML = `<p style="color: var(--danger); text-align: center; font-size: 0.85rem;">లోడ్ విఫలం</p>`;
    }
}

// =====================================================
// LOAD MY LEAVES (Step 5.7)
// =====================================================
async function loadMyLeaves() {
    if (!currentTeacher) return;
    const container = document.getElementById('myLeavesList');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-sm);">లోడ్...</p>`;

    try {
        const snap = await db.collection('leaveLetters').where('teacherId', '==', currentTeacher.id).get();
        const items = [];
        snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
        items.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });

        if (items.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">ఇంకా leaves submit చేయలేదు</p>`;
            return;
        }

        container.innerHTML = items.slice(0, 15).map(l => {
            let bc = 'status-pending', st = '⏳ Pending';
            if (l.status === 'approved') { bc = 'status-approved'; st = '✅ Approved'; }
            else if (l.status === 'rejected') { bc = 'status-rejected'; st = '❌ Rejected'; }
            return `<div style="padding: var(--space-sm) 0; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 0.85rem; font-weight: 600;">📅 ${escapeHtml(l.fromDate || '')} → ${escapeHtml(l.toDate || '')}</span>
                    <span class="status-badge ${bc}">${st}</span>
                </div>
                <p style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(l.reason || '')}</p>
            </div>`;
        }).join('');
    } catch (e) {
        console.error('Load leaves:', e);
        container.innerHTML = `<p style="color: var(--danger); text-align: center; font-size: 0.85rem;">లోడ్ విఫలం</p>`;
    }
}

// =====================================================
// SAVE DIARY
// =====================================================
async function handleSaveDiary() {
    if (!currentTeacher) return;
    const date = document.getElementById('diaryDate').value;
    const className = document.getElementById('diaryClass').value;
    const errorEl = document.getElementById('diaryError');
    const btn = document.getElementById('diarySubmitBtn');
    if (!date) return showFormError(errorEl, 'తేదీ ఎంచుకోండి.');
    if (!className) return showFormError(errorEl, 'Class ఎంచుకోండి.');
    const cw = document.querySelectorAll('.classwork-input');
    const hw = document.querySelectorAll('.homework-input');
    if (cw.length === 0) return showFormError(errorEl, 'సబ్జెక్టులు లోడ్ కాలేదు.');
    btn.disabled = true; btn.innerHTML = 'సేవ్...'; hideFormError(errorEl);
    try {
        const batch = db.batch();
        let hasContent = false;
        cw.forEach((c, i) => {
            const subject = c.getAttribute('data-subject');
            const classWork = c.value.trim();
            const homework = hw[i] ? hw[i].value.trim() : '';
            if (classWork || homework) {
                hasContent = true;
                const ref = db.collection('diary').doc();
                batch.set(ref, {
                    teacherId: currentTeacher.id, teacherName: currentTeacher.name,
                    teacherPhone: currentTeacher.phone, date, className, subject,
                    content: classWork, classWork, homework: homework || null,
                    isApproved: false, isRejected: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });
        if (!hasContent) {
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Save & Send to HM';
            return showFormError(errorEl, 'కనీసం ఒక సబ్జెక్ట్ రాయండి.');
        }
        await batch.commit();
        UI.toast('✅ Diary HM కి పంపబడింది!', 'success');
        document.getElementById('diaryForm').reset();
        document.getElementById('subjectsContainer').innerHTML = '';
        await loadMyDiaries();
        showScreen('dashboard');
    } catch (error) {
        console.error('Save diary:', error);
        showFormError(errorEl, 'సేవ్ విఫలం.');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Save & Send to HM';
    }
}

// =====================================================
// EDIT DIARY
// =====================================================
function openEditDiary(diaryId) {
    const d = allTeacherDiaries.find(x => x.id === diaryId);
    if (!d) return;
    if (d.isApproved || d.isRejected) {
        UI.toast('🔒 HM approve/reject అయిన diary edit చేయలేరు.', 'warning', 4000);
        return;
    }
    editingDiaryId = diaryId;
    document.getElementById('editDiaryClass').value = d.className || '';
    document.getElementById('editDiarySubject').value = d.subject || '';
    document.getElementById('editDiaryDate').value = d.date || '';
    document.getElementById('editClassWork').value = d.classWork || d.content || '';
    document.getElementById('editHomework').value = d.homework || '';
    document.getElementById('editDiaryError').classList.add('hidden');
    document.getElementById('editDiaryWarning').classList.add('hidden');
    showScreen('editDiary');
}

async function handleSaveEditDiary() {
    if (!editingDiaryId) return;
    const classWork = document.getElementById('editClassWork').value.trim();
    const homework = document.getElementById('editHomework').value.trim();
    const errorEl = document.getElementById('editDiaryError');
    const btn = document.getElementById('editDiarySubmitBtn');
    if (!classWork && !homework) return showFormError(errorEl, 'కనీసం Class Work లేదా Home Work రాయండి.');
    btn.disabled = true; btn.innerHTML = 'సేవ్...'; hideFormError(errorEl);
    try {
        const doc = await db.collection('diary').doc(editingDiaryId).get();
        if (!doc.exists) {
            showFormError(errorEl, 'Diary కనుగొనబడలేదు.');
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            return;
        }
        const data = doc.data();
        if (data.isApproved || data.isRejected) {
            showFormError(errorEl, '🔒 HM approve/reject అయిన diary edit చేయలేరు.');
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            return;
        }
        await db.collection('diary').doc(editingDiaryId).update({
            content: classWork, classWork: classWork, homework: homework || null,
            editedAt: firebase.firestore.FieldValue.serverTimestamp(),
            editedBy: currentTeacher.name
        });
        UI.toast('✅ Diary update అయ్యింది!', 'success');
        editingDiaryId = null;
        await loadMyDiaries();
        showScreen('dashboard');
    } catch (error) {
        console.error('Edit diary:', error);
        showFormError(errorEl, 'సేవ్ విఫలం.');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
}

// =====================================================
// ANNOUNCEMENT
// =====================================================
async function handleSendAnnouncement() {
    if (!currentTeacher) return;
    const type = document.getElementById('announcementType').value;
    const title = document.getElementById('announcementTitle').value.trim();
    const message = document.getElementById('announcementMessage').value.trim();
    const errorEl = document.getElementById('announcementError');
    const btn = document.getElementById('announcementSubmitBtn');
    if (!title) return showFormError(errorEl, 'Title నింపండి.');
    if (!message) return showFormError(errorEl, 'Message రాయండి.');
    btn.disabled = true; btn.innerHTML = 'పంపిస్తోంది...'; hideFormError(errorEl);
    try {
        await db.collection('announcements').add({
            teacherId: currentTeacher.id, teacherName: currentTeacher.name,
            teacherPhone: currentTeacher.phone, type, title, message,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        UI.toast('✅ Announcement HM కి పంపబడింది!', 'success');
        document.getElementById('announcementForm').reset();
        await loadMyAnnouncements();
    } catch (error) {
        console.error('Send announcement:', error);
        showFormError(errorEl, 'పంపడం విఫలం.');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right: 8px;"></i> Send to HM';
    }
}

async function loadMyAnnouncements() {
    const container = document.getElementById('myAnnouncementsList');
    if (!container || !currentTeacher) return;
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">లోడ్...</p>`;
    try {
        const snap = await db.collection('announcements').where('teacherId', '==', currentTeacher.id).get();
        const items = [];
        snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
        items.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        if (items.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">ఇంకా announcements పంపలేదు</p>`;
            return;
        }
        container.innerHTML = items.slice(0, 10).map(a => {
            let bc = 'status-pending', st = '⏳ Pending';
            if (a.status === 'approved') { bc = 'status-approved'; st = '✅ Approved'; }
            else if (a.status === 'rejected') { bc = 'status-rejected'; st = '❌ Rejected'; }
            const typeIcon = a.type === 'notes' ? '📝' : '📢';
            return `<div style="padding: var(--space-sm) 0; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 0.85rem; font-weight: 600;">${typeIcon} ${escapeHtml(a.title || '—')}</span>
                    <span class="status-badge ${bc}">${st}</span>
                </div>
                <p style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml((a.message || '').substring(0, 80))}${(a.message || '').length > 80 ? '...' : ''}</p>
            </div>`;
        }).join('');
    } catch (e) {
        console.error('Load announcements:', e);
        container.innerHTML = `<p style="color: var(--danger); text-align: center; font-size: 0.85rem;">లోడ్ విఫలం</p>`;
    }
}

// =====================================================
// ATTENDANCE C2
// =====================================================
async function loadAttendanceStudents() {
    const selectedClass = document.getElementById('attendanceClass').value;
    const listContainer = document.getElementById('attendanceList');
    const saveBtn = document.getElementById('saveAttendanceBtn');
    if (!selectedClass) {
        listContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">Class ఎంచుకోండి...</p>`;
        saveBtn.style.display = 'none'; return;
    }
    listContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">లోడ్...</p>`;
    try {
        const classSnap = await db.collection('classrooms').where('className', '==', selectedClass).limit(1).get();
        if (classSnap.empty) { listContainer.innerHTML = `<p style="color: var(--danger); text-align: center;">Class కనుగొనబడలేదు.</p>`; return; }
        const studentsSnap = await db.collection('classrooms').doc(classSnap.docs[0].id).collection('students').get();
        currentStudentsForAttendance = [];
        studentsSnap.forEach(doc => {
            const s = doc.data();
            if (s.isFilled && s.name) currentStudentsForAttendance.push({ id: doc.id, ...s });
        });
        currentStudentsForAttendance.sort((a, b) => parseInt(a.rollNumber) - parseInt(b.rollNumber));
        if (currentStudentsForAttendance.length === 0) {
            listContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center;">విద్యార్థులు లేరు.</p>`; return;
        }
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const eduYear = getEduYear();
        const month = getMonthName(today);
        const attDoc = await db.collection('attendance').doc(eduYear).collection(selectedClass).doc(month).get();
        const existing = attDoc.exists ? (attDoc.data().days?.[dateStr] || {}) : {};
        const leaveSnap = await db.collection('leaveLetters')
            .where('status', '==', 'approved').where('className', '==', selectedClass).where('type', '==', 'student').get();
        const approvedLeave = new Set();
        leaveSnap.forEach(doc => {
            const l = doc.data();
            if (dateStr >= l.fromDate && dateStr <= l.toDate) approvedLeave.add(l.studentId);
        });
        listContainer.innerHTML = currentStudentsForAttendance.map(student => {
            let status = 'present';
            if (approvedLeave.has(student.id)) status = 'leave';
            else if (existing[student.id]) status = existing[student.id].status || 'present';
            const bg = status === 'present' ? '#E8F5E9' : status === 'absent' ? '#FFEBEE' : '#FFF3E0';
            const btnColor = status === 'present' ? '#388E3C' : status === 'absent' ? '#D32F2F' : '#F57C00';
            const icon = status === 'present' ? '✓' : status === 'absent' ? '✗' : '🏖️';
            const isLeaveAuto = approvedLeave.has(student.id);
            return `<div class="attendance-row" data-student-id="${student.id}" data-status="${status}" style="background: ${bg}; display: flex; justify-content: space-between; align-items: center; padding: 10px; border-radius: 8px; margin-bottom: 6px; ${isLeaveAuto ? 'opacity: 0.85;' : ''}">
                <div style="flex: 1;">
                    <span style="font-weight: 700; color: var(--primary); margin-right: 8px;">${escapeHtml(student.rollNumber)}</span>
                    <span style="font-size: 0.9rem;">${escapeHtml(student.name)}</span>
                    ${isLeaveAuto ? '<span style="font-size: 0.7rem; color: #E65100; margin-left: 6px;">📅 Leave</span>' : ''}
                </div>
                ${isLeaveAuto ? `<span style="background: ${btnColor}; color: #fff; padding: 6px 10px; border-radius: 50%; font-size: 0.8rem;">🏖️</span>` :
                `<button onclick="toggleAttendance(this)" style="width: 36px; height: 36px; border-radius: 50%; border: none; background: ${btnColor}; color: #fff; font-size: 1rem; cursor: pointer; font-weight: bold;">${icon}</button>`}
            </div>`;
        }).join('');
        saveBtn.style.display = 'block';
    } catch (error) {
        console.error('Load attendance:', error);
        listContainer.innerHTML = `<p style="color: var(--danger); text-align: center;">లోడ్ విఫలం.</p>`;
    }
}

function toggleAttendance(btn) {
    const row = btn.closest('.attendance-row');
    const current = row.dataset.status;
    const next = current === 'present' ? 'absent' : 'present';
    row.dataset.status = next;
    if (next === 'present') { row.style.background = '#E8F5E9'; btn.style.background = '#388E3C'; btn.textContent = '✓'; }
    else { row.style.background = '#FFEBEE'; btn.style.background = '#D32F2F'; btn.textContent = '✗'; }
}

async function handleSaveAttendance() {
    const selectedClass = document.getElementById('attendanceClass').value;
    const btn = document.getElementById('saveAttendanceBtn');
    if (!selectedClass) return;
    btn.disabled = true; btn.innerHTML = 'సేవ్...';
    try {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const eduYear = getEduYear();
        const month = getMonthName(today);
        const rows = document.querySelectorAll('.attendance-row');
        const daysData = {};
        let p = 0, a = 0, l = 0;
        rows.forEach(row => {
            const sid = row.dataset.studentId;
            const status = row.dataset.status;
            daysData[sid] = { status, markedBy: currentTeacher.name, markedAt: new Date().toISOString() };
            if (status === 'present') p++; else if (status === 'absent') a++; else if (status === 'leave') l++;
        });
        const ref = db.collection('attendance').doc(eduYear).collection(selectedClass).doc(month);
        const ex = await ref.get();
        const existingDays = ex.exists ? (ex.data().days || {}) : {};
        await ref.set({
            eduYear, className: selectedClass, month,
            days: { ...existingDays, [dateStr]: daysData },
            approved: false,
            lastSubmittedBy: currentTeacher.name,
            lastSubmittedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        UI.toast(`✅ Present: ${p}, Absent: ${a}, Leave: ${l}`, 'success');
        await loadMyAttendance();
        showScreen('dashboard');
    } catch (error) {
        console.error('Save attendance:', error);
        UI.toast('❌ సేవ్ విఫలం.', 'error');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Attendance';
    }
}

async function handleSaveLeave() {
    if (!currentTeacher) return;
    const fromDate = document.getElementById('leaveFrom').value;
    const toDate = document.getElementById('leaveTo').value;
    const reason = document.getElementById('leaveReason').value.trim();
    const errorEl = document.getElementById('leaveError');
    const btn = document.getElementById('leaveSubmitBtn');
    if (!fromDate || !toDate) return showFormError(errorEl, 'From/To తేదీలు.');
    if (new Date(toDate) < new Date(fromDate)) return showFormError(errorEl, 'తేదీలు చెక్ చేయండి.');
    if (!reason) return showFormError(errorEl, 'కారణం రాయండి.');
    btn.disabled = true; btn.innerHTML = 'సబ్మిట్...'; hideFormError(errorEl);
    try {
        await db.collection('leaveLetters').add({
            teacherId: currentTeacher.id, teacherName: currentTeacher.name,
            teacherPhone: currentTeacher.phone, fromDate, toDate, reason,
            status: 'pending', type: 'teacher',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        UI.toast('✅ Leave Submit!', 'success');
        document.getElementById('leaveForm').reset();
        await loadMyLeaves();
        showScreen('dashboard');
    } catch (error) {
        console.error('Leave:', error);
        showFormError(errorEl, 'సబ్మిట్ విఫలం.');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Leave Submit';
    }
}

function getEduYear() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    if (m >= 6) return `${y}-${(y + 1).toString().slice(-2)}`;
    return `${y - 1}-${y.toString().slice(-2)}`;
}

function getMonthName(date) {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return months[date.getMonth()];
}

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
