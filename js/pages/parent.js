// js/pages/parent.js

let currentScreen = 'login';
let currentParent = null;
let currentTab = 'notices';
let allNotices = [];
let allDiaries = [];
let allAttendance = [];

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('dm_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);

    const savedSize = localStorage.getItem('dm_font_size');
    if (savedSize) {
        document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');
    }

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('parentApp');
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

        const session = localStorage.getItem('dm_parent_session');
        if (session) {
            const s = JSON.parse(session);
            currentParent = s;
            await loadDashboardData();
            showScreen('dashboard');
            return;
        }

        const schoolDoc = await db.collection('schoolInfo').doc('main').get();
        if (!schoolDoc.exists || !schoolDoc.data().isSetupComplete) {
            UI.toast('⚠️ పాఠశాల సెటప్ పూర్తి కాలేదు. హెడ్‌మాస్టర్‌ని సంప్రదించండి.', 'warning', 5000);
            showScreen('login');
            return;
        }

        if (schoolDoc.data().sections?.parent !== true) {
            UI.toast('⚠️ Parent సెక్షన్ ఇంకా ఎనేబుల్ చేయలేదు.', 'warning', 5000);
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
    ['login', 'dashboard'].forEach(s => {
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
        title.textContent = name === 'login' ? 'Parent Login' : 'Parent Dashboard';
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
                localStorage.removeItem('dm_parent_session');
                window.location.href = 'index.html';
            }
        });
    }

    const rollInput = document.getElementById('parentRollNumber');
    if (rollInput) {
        rollInput.addEventListener('input', () => {
            rollInput.value = rollInput.value.replace(/\D/g, '').slice(0, 10);
        });
    }

    const dobInput = document.getElementById('parentDob');
    if (dobInput) {
        dobInput.addEventListener('input', () => {
            dobInput.value = dobInput.value.replace(/\D/g, '').slice(0, 6);
        });
    }

    const loginForm = document.getElementById('parentLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleParentLogin();
        });
    }
}

async function handleParentLogin() {
    const rollNumber = document.getElementById('parentRollNumber').value.trim();
    const dob = document.getElementById('parentDob').value.trim();
    const errorEl = document.getElementById('parentLoginError');
    const btn = document.getElementById('parentLoginBtn');

    if (!rollNumber) return showFormError(errorEl, 'Roll Number నింపండి.');
    if (!/^\d{6}$/.test(dob)) return showFormError(errorEl, 'పుట్టిన తేదీ ddmmyy ఫార్మాట్ లో 6 అంకెలు ఉండాలి.');

    btn.disabled = true;
    btn.textContent = 'లాగిన్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        const classroomsSnap = await db.collection('classrooms').get();

        let foundStudent = null;
        let foundClassroom = null;

        for (const classDoc of classroomsSnap.docs) {
            const classData = classDoc.data();
            const studentsSnap = await db.collection('classrooms')
                .doc(classDoc.id)
                .collection('students')
                .where('rollNumber', '==', rollNumber)
                .get();

            for (const studentDoc of studentsSnap.docs) {
                const studentData = studentDoc.data();
                if (String(studentData.dob || '').trim() === dob) {
                    foundStudent = { id: studentDoc.id, ...studentData };
                    foundClassroom = { id: classDoc.id, ...classData };
                    break;
                }
            }
            if (foundStudent) break;
        }

        if (!foundStudent) {
            return showFormError(errorEl, '❌ విద్యార్థి వివరాలు కనుగొనబడలేదు. Roll Number మరియు DOB చెక్ చేయండి.');
        }

        currentParent = {
            studentId: foundStudent.id,
            studentName: foundStudent.name || '—',
            rollNumber: foundStudent.rollNumber || '—',
            dob: foundStudent.dob || '—',
            className: foundClassroom.className || '—',
            classroomId: foundClassroom.id
        };
        localStorage.setItem('dm_parent_session', JSON.stringify(currentParent));

        UI.toast('✅ Login విజయవంతమైంది!', 'success');
        await loadDashboardData();
        showScreen('dashboard');
    } catch (error) {
        console.error('Login error:', error);
        showFormError(errorEl, 'నెట్‌వర్క్ లోపం. మళ్లీ ప్రయత్నించండి.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'లాగిన్';
    }
}

async function loadDashboardData() {
    if (!currentParent) return;

    document.getElementById('parentWelcomeName').textContent = currentParent.studentName || '—';
    document.getElementById('parentWelcomeClass').textContent = `🏫 ${currentParent.className} • Roll No: ${currentParent.rollNumber}`;

    await loadNotices();
    await loadDiaries();
    await loadAttendance();

    switchTab('notices');
}

async function loadNotices() {
    try {
        const snapshot = await db.collection('noticeBoard').get();
        allNotices = [];
        snapshot.forEach(doc => {
            allNotices.push({ id: doc.id, ...doc.data() });
        });
        allNotices.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
    } catch (error) {
        console.error('Load notices error:', error);
    }
}

async function loadDiaries() {
    try {
        const snapshot = await db.collection('diary')
            .where('className', '==', currentParent.className)
            .get();

        allDiaries = [];
        snapshot.forEach(doc => {
            allDiaries.push({ id: doc.id, ...doc.data() });
        });
        allDiaries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch (error) {
        console.error('Load diaries error:', error);
    }
}

async function loadAttendance() {
    try {
        const snapshot = await db.collection('attendance')
            .where('studentId', '==', currentParent.studentId)
            .get();

        allAttendance = [];
        snapshot.forEach(doc => {
            allAttendance.push({ id: doc.id, ...doc.data() });
        });
        allAttendance.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch (error) {
        console.error('Load attendance error:', error);
        allAttendance = [];
    }
}

function switchTab(tab) {
    currentTab = tab;

    ['notices', 'diary', 'attendance'].forEach(t => {
        const btn = document.getElementById('tab' + capitalize(t));
        if (btn) {
            btn.className = t === tab ? 'btn btn-primary' : 'btn btn-outline';
        }
    });

    renderContent();
}

function renderContent() {
    const container = document.getElementById('parentContent');
    if (!container) return;

    if (currentTab === 'notices') {
        renderNoticesContent(container);
    } else if (currentTab === 'diary') {
        renderDiaryContent(container);
    } else if (currentTab === 'attendance') {
        renderAttendanceContent(container);
    }
}

function renderNoticesContent(container) {
    if (allNotices.length === 0) {
        container.innerHTML = emptyState('📢', 'ఇంకా నోటీసులు లేవు');
        return;
    }

    container.innerHTML = `
        <div class="card">
            <h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">📢 Notices</h3>
            ${allNotices.map(n => {
                const priorityColor = n.priority === 'urgent' ? 'var(--danger)' : n.priority === 'important' ? '#F9A825' : 'var(--success)';
                return `
                    <div style="padding: var(--space-md); margin-bottom: var(--space-sm); border-left: 4px solid ${priorityColor}; background: var(--bg-color); border-radius: var(--radius-sm);">
                        <h4 style="font-size: 0.95rem; margin-bottom: 4px;">${escapeHtml(n.title || '—')}</h4>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px; white-space: pre-wrap;">${escapeHtml(n.content || '')}</p>
                        <p style="font-size: 0.7rem; color: var(--text-muted);">📅 ${formatDate(n.createdAt)}</p>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderDiaryContent(container) {
    if (allDiaries.length === 0) {
        container.innerHTML = emptyState('📖', 'ఇంకా Diary entries లేవు');
        return;
    }

    container.innerHTML = `
        <div class="card">
            <h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">📖 ${escapeHtml(currentParent.className)} — Diary</h3>
            ${allDiaries.slice(0, 20).map(d => `
                <div style="padding: var(--space-md); margin-bottom: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <h4 style="font-size: 0.95rem;">📚 ${escapeHtml(d.subject || '—')}</h4>
                        <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: ${d.isApproved ? 'var(--success)' : '#F9A825'}; color: #fff; font-weight: 600;">
                            ${d.isApproved ? '✅' : '⏳'}
                        </span>
                    </div>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">📅 ${escapeHtml(d.date || '—')} • 👨‍🏫 ${escapeHtml(d.teacherName || 'Teacher')}</p>
                    <p style="font-size: 0.85rem; white-space: pre-wrap; margin-bottom: 6px;">${escapeHtml(d.content || '')}</p>
                    ${d.homework ? `<p style="font-size: 0.8rem; color: var(--primary); padding-top: 6px; border-top: 1px solid var(--border-color);"><strong>📝 Homework:</strong> ${escapeHtml(d.homework)}</p>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function renderAttendanceContent(container) {
    if (allAttendance.length === 0) {
        container.innerHTML = emptyState('✅', 'ఇంకా Attendance records లేవు');
        return;
    }

    const presentCount = allAttendance.filter(a => a.status === 'present').length;
    const absentCount = allAttendance.filter(a => a.status === 'absent').length;
    const total = allAttendance.length;
    const percentage = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    container.innerHTML = `
        <div class="card">
            <h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">✅ Attendance</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-sm); margin-bottom: var(--space-md);">
                <div style="text-align: center; padding: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm);">
                    <p style="font-size: 1.5rem; font-weight: 700; color: var(--success);">${presentCount}</p>
                    <p style="font-size: 0.7rem; color: var(--text-muted);">Present</p>
                </div>
                <div style="text-align: center; padding: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm);">
                    <p style="font-size: 1.5rem; font-weight: 700; color: var(--danger);">${absentCount}</p>
                    <p style="font-size: 0.7rem; color: var(--text-muted);">Absent</p>
                </div>
                <div style="text-align: center; padding: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm);">
                    <p style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">${percentage}%</p>
                    <p style="font-size: 0.7rem; color: var(--text-muted);">Percentage</p>
                </div>
            </div>

            ${allAttendance.slice(0, 30).map(a => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) 0; border-bottom: 1px solid var(--border-color);">
                    <span style="font-size: 0.85rem;">📅 ${escapeHtml(a.date || '—')}</span>
                    <span style="font-size: 0.75rem; padding: 2px 10px; border-radius: 12px; font-weight: 600; background: ${a.status === 'present' ? 'var(--success)' : 'var(--danger)'}; color: #fff;">
                        ${a.status === 'present' ? '✅ Present' : '❌ Absent'}
                    </span>
                </div>
            `).join('')}
        </div>
    `;
}

function emptyState(icon, message) {
    return `
        <div class="card" style="text-align: center; padding: var(--space-xl);">
            <div style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);">${icon}</div>
            <p style="color: var(--text-muted);">${message}</p>
        </div>
    `;
}

function formatDate(timestamp) {
    if (!timestamp) return '—';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    } catch (e) {
        return '—';
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
