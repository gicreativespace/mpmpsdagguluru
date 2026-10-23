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
    renderAssignedClasses();
    await loadMyDiaries();
    await checkOnLeaveToggle();
}

function populateClassDropdowns() {
    const assignments = currentTeacher.assignments || [];
    const uniqueClasses = [...new Set(assignments.map(a => a.className))];

    const diaryClassSelect = document.getElementById('diaryClass');
    if (diaryClassSelect) {
        diaryClassSelect.innerHTML = '<option value="">-- Class ఎంచుకోండి --</option>';
        uniqueClasses.forEach(className => {
            const opt = document.createElement('option');
            opt.value = className;
            opt.textContent = className;
            diaryClassSelect.appendChild(opt);
        });
        diaryClassSelect.addEventListener('change', populateSubjectsForDiary);
    }

    const attendanceClassSelect = document.getElementById('attendanceClass');
    if (attendanceClassSelect) {
        attendanceClassSelect.innerHTML = '<option value="">-- Class ఎంచుకోండి --</option>';
        uniqueClasses.forEach(className => {
            const opt = document.createElement('option');
            opt.value = className;
            opt.textContent = className;
            attendanceClassSelect.appendChild(opt);
        });
    }
}

// =====================================================
// ASSIGNED CLASSES (NEW)
// =====================================================
function renderAssignedClasses() {
    const container = document.getElementById('assignedClassesList');
    if (!container) return;

    const assignments = currentTeacher.assignments || [];
    if (assignments.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 0.85rem;">Classes assign చేయలేదు. HM ని సంప్రదించండి.</p>`;
        return;
    }

    const grouped = {};
    assignments.forEach(a => {
        if (!grouped[a.className]) grouped[a.className] = [];
        grouped[a.className].push(a.subject);
    });

    container.innerHTML = Object.entries(grouped).map(([className, subjects]) => `
        <div style="padding: var(--space-sm); border-bottom: 1px solid var(--border-color);">
            <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">${escapeHtml(className)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
                ${subjects.map(s => `📖 ${escapeHtml(s)}`).join(' • ')}
            </div>
        </div>
    `).join('');
}

// =====================================================
// "I AM ON LEAVE" TOGGLE (NEW)
// =====================================================
async function handleOnLeaveToggle(el) {
    if (!currentTeacher) return;

    const isOn = el.checked;
    const today = new Date().toISOString().split('T')[0];

    try {
        await db.collection('users').doc(currentTeacher.id).update({
            onLeaveDate: isOn ? today : null
        });

        if (isOn) {
            UI.toast('✅ ఈరోజు Leave గా మార్క్ అయింది.', 'success', 4000);
        } else {
            UI.toast('✅ Leave మార్క్ తీసేయబడింది.', 'info');
        }
    } catch (err) {
        console.error('Leave toggle error:', err);
        UI.toast('Leave toggle విఫలమైంది.', 'error');
        el.checked = !isOn;
    }
}

async function checkOnLeaveToggle() {
    if (!currentTeacher) return;
    try {
        const doc = await db.collection('users').doc(currentTeacher.id).get();
        const data = doc.data() || {};
        const today = new Date().toISOString().split('T')[0];
        const isOnLeaveToday = data.onLeaveDate === today;

        const toggle = document.getElementById('onLeaveToggle');
        if (toggle) toggle.checked = isOnLeaveToday;
    } catch (err) {
        console.warn('Toggle check error:', err);
    }
}

// =====================================================
// DIARY — MULTI SUBJECT
// =====================================================
function populateSubjectsForDiary() {
    const classSelect = document.getElementById('diaryClass');
    const container = document.getElementById('subjectsContainer');
    if (!classSelect || !container) return;

    const selectedClass = classSelect.value;
    container.innerHTML = '';

    if (!selectedClass) return;

    const assignments = currentTeacher.assignments || [];
    const subjects = assignments
        .filter(a => a.className === selectedClass)
        .map(a => a.subject);

    if (subjects.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted);">ఈ క్లాస్ కి సబ్జెక్టులు లేవు.</p>`;
        return;
    }

    subjects.forEach((subject, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'background: var(--bg-color); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--border-color);';
        div.innerHTML = `
            <h4 style="color: var(--primary); margin-bottom: var(--space-sm); font-size: 1rem;">📚 ${escapeHtml(subject)}</h4>
            <div class="field">
                <label for="classwork_${index}">Class Work</label>
                <textarea id="classwork_${index}" data-subject="${escapeHtml(subject)}" class="classwork-input" rows="3" placeholder="ఏమి చెప్పారు?" style="height: auto; min-height: 70px; padding: 10px; resize: vertical;"></textarea>
            </div>
            <div class="field" style="margin-top: var(--space-sm);">
                <label for="homework_${index}">Home Work</label>
                <textarea id="homework_${index}" data-subject="${escapeHtml(subject)}" class="homework-input" rows="2" placeholder="Homework (ఐచ్ఛికం)" style="height: auto; min-height: 60px; padding: 10px; resize: vertical;"></textarea>
            </div>
        `;
        container.appendChild(div);
    });
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
                </div>
            `;
            return;
        }

        container.innerHTML = allTeacherDiaries.slice(0, 10).map(d => {
            let statusClass = 'status-pending', statusText = '⏳ Pending';
            if (d.isApproved) { statusClass = 'status-approved'; statusText = '✅ Approved'; }
            else if (d.isRejected) { statusClass = 'status-rejected'; statusText = '❌ Rejected'; }

            return `
            <div style="padding: var(--space-sm) 0; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 0.85rem; font-weight: 600;">${escapeHtml(d.className || '—')} • ${escapeHtml(d.subject || '')}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-muted);">📅 ${escapeHtml(d.date || '—')}</p>
            </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Load diaries error:', error);
    }
}

async function handleSaveDiary() {
    if (!currentTeacher) return;

    const date = document.getElementById('diaryDate').value;
    const className = document.getElementById('diaryClass').value;
    const errorEl = document.getElementById('diaryError');
    const btn = document.getElementById('diarySubmitBtn');

    if (!date) return showFormError(errorEl, 'తేదీ ఎంచుకోండి.');
    if (!className) return showFormError(errorEl, 'Class ఎంచుకోండి.');

    const classworkInputs = document.querySelectorAll('.classwork-input');
    const homeworkInputs = document.querySelectorAll('.homework-input');

    if (classworkInputs.length === 0) {
        return showFormError(errorEl, 'సబ్జెక్టులు లోడ్ అవ్వలేదు. Class మళ్లీ ఎంచుకోండి.');
    }

    btn.disabled = true;
    btn.innerHTML = 'సేవ్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        const batch = db.batch();
        let hasContent = false;

        classworkInputs.forEach((cwInput, index) => {
            const subject = cwInput.getAttribute('data-subject');
            const classWork = cwInput.value.trim();
            const homework = homeworkInputs[index] ? homeworkInputs[index].value.trim() : '';

            if (classWork || homework) {
                hasContent = true;
                const diaryRef = db.collection('diary').doc();
                batch.set(diaryRef, {
                    teacherId: currentTeacher.id,
                    teacherName: currentTeacher.name,
                    teacherPhone: currentTeacher.phone,
                    date: date,
                    className: className,
                    subject: subject,
                    content: classWork,
                    classWork: classWork,
                    homework: homework || null,
                    isApproved: false,
                    isRejected: false,
                    approvedAt: null,
                    approvedBy: null,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        if (!hasContent) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right: 8px;"></i> Save & Send to HM';
            return showFormError(errorEl, 'కనీసం ఒక సబ్జెక్ట్ కి Class Work లేదా Home Work రాయండి.');
        }

        await batch.commit();

        UI.toast('✅ Diary విజయవంతంగా HM కి పంపబడింది!', 'success');
        document.getElementById('diaryForm').reset();
        document.getElementById('subjectsContainer').innerHTML = '';
        await loadMyDiaries();
        showScreen('dashboard');
    } catch (error) {
        console.error('Save diary error:', error);
        showFormError(errorEl, 'సేవ్ విఫలమైంది. మళ్లీ ప్రయత్నించండి.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right: 8px;"></i> Save & Send to HM';
    }
}

// =====================================================
// ATTENDANCE (Old format — C2 in Step 5.4)
// =====================================================
async function loadAttendanceStudents() {
    const classSelect = document.getElementById('attendanceClass');
    const selectedClass = classSelect.value;
    const listContainer = document.getElementById('attendanceList');
    const saveBtn = document.getElementById('saveAttendanceBtn');

    if (!selectedClass) {
        listContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">Class ఎంచుకోండి...</p>`;
        saveBtn.style.display = 'none';
        return;
    }

    listContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">లోడ్ అవుతోంది...</p>`;

    try {
        const classSnap = await db.collection('classrooms').where('className', '==', selectedClass).limit(1).get();
        if (classSnap.empty) {
            listContainer.innerHTML = `<p style="color: var(--danger); text-align: center;">Class కనుగొనబడలేదు.</p>`;
            return;
        }
        const classId = classSnap.docs[0].id;

        const studentsSnap = await db.collection('classrooms').doc(classId).collection('students').get();

        currentStudentsForAttendance = [];
        studentsSnap.forEach(doc => {
            currentStudentsForAttendance.push({ id: doc.id, ...doc.data() });
        });

        currentStudentsForAttendance.sort((a, b) => parseInt(a.rollNumber) - parseInt(b.rollNumber));

        if (currentStudentsForAttendance.length === 0) {
            listContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center;">ఈ Class లో విద్యార్థులు లేరు.</p>`;
            return;
        }

        listContainer.innerHTML = currentStudentsForAttendance.map(student => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm); border-bottom: 1px solid var(--border-color);">
                <div>
                    <span style="font-weight: 700; color: var(--primary); margin-right: 8px;">${escapeHtml(student.rollNumber)}</span>
                    <span>${escapeHtml(student.name || 'Name Not Filled')}</span>
                </div>
                <label class="switch">
                    <input type="checkbox" class="attendance-checkbox" data-student-id="${student.id}" checked />
                    <span class="slider round"></span>
                </label>
            </div>
        `).join('');

        saveBtn.style.display = 'block';
    } catch (error) {
        console.error('Load attendance error:', error);
        listContainer.innerHTML = `<p style="color: var(--danger); text-align: center;">లోడ్ విఫలమైంది.</p>`;
    }
}

async function handleSaveAttendance() {
    const selectedClass = document.getElementById('attendanceClass').value;
    const btn = document.getElementById('saveAttendanceBtn');
    if (!selectedClass) return;

    btn.disabled = true;
    btn.innerHTML = 'సేవ్ అవుతోంది...';

    try {
        const today = new Date().toISOString().split('T')[0];
        const checkboxes = document.querySelectorAll('.attendance-checkbox');
        const batch = db.batch();
        let presentCount = 0, absentCount = 0;

        checkboxes.forEach(cb => {
            const studentId = cb.getAttribute('data-student-id');
            const isPresent = cb.checked;
            if (isPresent) presentCount++; else absentCount++;

            const attendanceRef = db.collection('attendance').doc(`${today}_${studentId}`);
            batch.set(attendanceRef, {
                date: today,
                studentId: studentId,
                className: selectedClass,
                status: isPresent ? 'present' : 'absent',
                markedBy: currentTeacher.name,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
        UI.toast(`✅ Attendance సేవ్! Present: ${presentCount}, Absent: ${absentCount}`, 'success');
        showScreen('dashboard');
    } catch (error) {
        console.error('Save attendance error:', error);
        UI.toast('❌ సేవ్ విఫలమైంది.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save" style="margin-right: 8px;"></i> Save Attendance';
    }
}

// =====================================================
// LEAVE
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
            type: 'teacher',
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
