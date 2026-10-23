// js/pages/parent.js — Digital Manabadi v12.0 (Step 2.5)
// Changes:
//  - Add Child flow (Class → Roll → DOB verify)
//  - Multi-child session (children array)
//  - Child select screen
//  - No logout → "Go to Home"
//  - Food Menu + Leave tabs (basic)
//  - Red dot on notices
//  - UI.initLayout() + custom back button
// Poster create / Attendance C2 → Step 7

let currentScreen = 'login';
let parentSession = null; // { children: [], currentIndex: 0 }
let currentParent = null; // current child details
let currentTab = 'notices';
let allNotices = [];
let allDiaries = [];
let allAttendance = [];
let allMenu = null;
let allLeaves = [];

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

    if (typeof UI !== 'undefined') {
        UI.initLayout();
    }

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('parentApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);

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
        if (currentScreen === 'dashboard') {
            showScreen('childSelect');
        } else if (currentScreen === 'addChild') {
            showScreen('login');
        } else if (currentScreen === 'childSelect') {
            showScreen('login');
        } else if (currentScreen === 'login') {
            // Login → auto "logoff" (clear session)
            localStorage.removeItem('dm_parent_session');
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

        const session = localStorage.getItem('dm_parent_session');
        if (session) {
            try {
                const s = JSON.parse(session);
                if (s && Array.isArray(s.children) && s.children.length > 0) {
                    parentSession = s;
                    await loadClassesForAddChild();
                    showScreen('childSelect');
                    return;
                }
            } catch (e) {
                localStorage.removeItem('dm_parent_session');
            }
        }

        const schoolDoc = await db.collection('schoolInfo').doc('main').get();
        if (!schoolDoc.exists || !schoolDoc.data().isSetupComplete) {
            UI.toast('⚠️ పాఠశాల సెటప్ పూర్తి కాలేదు.', 'warning', 5000);
            showScreen('login');
            return;
        }
        if (schoolDoc.data().sections?.parent !== true) {
            UI.toast('⚠️ Parent సెక్షన్ ఇంకా ఎనేబుల్ చేయలేదు.', 'warning', 5000);
            showScreen('login');
            return;
        }

        // Check session again for "continue"
        const existingSession = localStorage.getItem('dm_parent_session');
        const continueBtn = document.getElementById('continueBtn');
        if (existingSession && continueBtn) {
            try {
                const s = JSON.parse(existingSession);
                if (s.children && s.children.length > 0) continueBtn.classList.remove('hidden');
            } catch (e) {}
        }

        await loadClassesForAddChild();
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
    ['login', 'addChild', 'childSelect', 'dashboard'].forEach(s => {
        const el = document.getElementById('screen' + capitalize(s));
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('screen' + capitalize(name));
    if (target) target.classList.remove('hidden');

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        if (name === 'login') backBtn.classList.remove('hidden');
        else backBtn.classList.remove('hidden');
    }

    const goHomeBtn = document.getElementById('goHomeBtn');
    if (goHomeBtn) {
        if (name === 'dashboard' || name === 'childSelect') goHomeBtn.classList.remove('hidden');
        else goHomeBtn.classList.add('hidden');
    }

    const title = document.getElementById('pageTitle');
    if (title) {
        title.textContent = {
            login: 'Parent',
            addChild: 'Add Child',
            childSelect: 'My Children',
            dashboard: 'Parent Dashboard'
        }[name] || 'Parent';
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

    const rollInput = document.getElementById('addChildRoll');
    if (rollInput) {
        rollInput.addEventListener('input', () => {
            rollInput.value = rollInput.value.replace(/\D/g, '').slice(0, 10);
        });
    }

    const dobInput = document.getElementById('addChildDob');
    if (dobInput) {
        dobInput.addEventListener('input', () => {
            dobInput.value = dobInput.value.replace(/\D/g, '').slice(0, 6);
        });
    }

    const addChildForm = document.getElementById('addChildForm');
    if (addChildForm) {
        addChildForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleAddChild();
        });
    }
}

// =====================================================
// LOAD CLASSES (for Add Child dropdown)
// =====================================================
async function loadClassesForAddChild() {
    const select = document.getElementById('addChildClass');
    if (!select) return;

    if (select.options.length > 1) return; // already loaded

    try {
        const snap = await db.collection('classrooms').get();
        if (snap.empty) return;

        const classes = [];
        snap.forEach(doc => {
            const data = doc.data();
            if (data.className) classes.push({ id: doc.id, className: data.className });
        });
        classes.sort((a, b) => (a.className || '').localeCompare(b.className || ''));

        select.innerHTML = '<option value="">-- Class ఎంచుకోండి --</option>';
        classes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.className;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Load classes error:', err);
    }
}

// =====================================================
// ADD CHILD
// =====================================================
async function handleAddChild() {
    const classroomId = document.getElementById('addChildClass').value;
    const rollNumber = document.getElementById('addChildRoll').value.trim();
    const dob = document.getElementById('addChildDob').value.trim();
    const errorEl = document.getElementById('addChildError');
    const btn = document.getElementById('addChildBtn');

    if (!classroomId) return showFormError(errorEl, 'Class ఎంచుకోండి.');
    if (!rollNumber) return showFormError(errorEl, 'Roll Number నింపండి.');
    if (!/^\d{6}$/.test(dob)) return showFormError(errorEl, 'DOB ddmmyy ఫార్మాట్ లో 6 అంకెలు ఉండాలి.');

    btn.disabled = true;
    btn.innerHTML = 'Verifying...';
    hideFormError(errorEl);

    try {
        const classDoc = await db.collection('classrooms').doc(classroomId).get();
        if (!classDoc.exists) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 8px;"></i> Child Confirm చేయండి';
            return showFormError(errorEl, 'Class కనుగొనబడలేదు.');
        }
        const classData = classDoc.data();

        const studentsSnap = await db.collection('classrooms')
            .doc(classroomId)
            .collection('students')
            .where('rollNumber', '==', rollNumber)
            .limit(1)
            .get();

        if (studentsSnap.empty) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 8px;"></i> Child Confirm చేయండి';
            return showFormError(errorEl, '❌ ఈ Roll Number కనుగొనబడలేదు.');
        }

        const studentDoc = studentsSnap.docs[0];
        const studentData = studentDoc.data();

        if (String(studentData.dob || '').trim() !== dob) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 8px;"></i> Child Confirm చేయండి';
            return showFormError(errorEl, '❌ DOB మ్యాచ్ అవ్వలేదు. మళ్లీ చెక్ చేయండి.');
        }

        // Session create/update
        if (!parentSession) {
            const existing = localStorage.getItem('dm_parent_session');
            parentSession = existing ? JSON.parse(existing) : { children: [], currentIndex: 0 };
            if (!parentSession.children) parentSession.children = [];
        }

        // Duplicate check
        const dup = parentSession.children.find(c => c.studentId === studentDoc.id);
        if (dup) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 8px;"></i> Child Confirm చేయండి';
            return showFormError(errorEl, '⚠️ ఈ విద్యార్థి ఇప్పటికే add అయ్యారు.');
        }

        parentSession.children.push({
            studentId: studentDoc.id,
            studentName: studentData.name || '—',
            rollNumber: studentData.rollNumber || rollNumber,
            dob: studentData.dob,
            className: classData.className,
            classroomId: classroomId
        });

        localStorage.setItem('dm_parent_session', JSON.stringify(parentSession));

        UI.toast(`✅ ${studentData.name || 'Child'} add అయ్యారు!`, 'success');
        document.getElementById('addChildForm').reset();

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 8px;"></i> Child Confirm చేయండి';

        showScreen('childSelect');
        renderChildrenList();
    } catch (err) {
        console.error('Add child error:', err);
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 8px;"></i> Child Confirm చేయండి';
        showFormError(errorEl, 'నెట్‌వర్క్ లోపం. మళ్లీ ప్రయత్నించండి.');
    }
}

// =====================================================
// CHILD SELECT
// =====================================================
function renderChildrenList() {
    const container = document.getElementById('childrenList');
    if (!container) return;

    if (!parentSession || !parentSession.children || parentSession.children.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center;">ఇంకా పిల్లలు add చేయలేదు.</p>`;
        return;
    }

    container.innerHTML = parentSession.children.map((child, index) => `
        <div class="section-card" onclick="selectChild(${index})">
            <div class="section-card-icon">👶</div>
            <div class="section-card-body">
                <div class="section-card-title">${escapeHtml(child.studentName)}</div>
                <div class="section-card-sub">🏫 ${escapeHtml(child.className)} • Roll: ${escapeHtml(child.rollNumber)}</div>
            </div>
            <div class="section-card-arrow">›</div>
        </div>
    `).join('');
}

async function selectChild(index) {
    if (!parentSession || !parentSession.children[index]) return;
    parentSession.currentIndex = index;
    localStorage.setItem('dm_parent_session', JSON.stringify(parentSession));
    currentParent = parentSession.children[index];
    await loadDashboardData();
    showScreen('dashboard');
}

// =====================================================
// DASHBOARD DATA
// =====================================================
async function loadDashboardData() {
    if (!currentParent) return;

    document.getElementById('parentWelcomeName').textContent = currentParent.studentName || '—';
    document.getElementById('parentWelcomeClass').textContent = `🏫 ${currentParent.className} • Roll: ${currentParent.rollNumber}`;

    await loadNotices();
    await loadDiaries();
    await loadAttendance();
    await loadMenu();
    await loadLeaves();

    switchTab('notices');
}

// =====================================================
// LOAD NOTICES
// =====================================================
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

        // Red dot check
        if (allNotices.length > 0 && typeof UI !== 'undefined') {
            const latest = allNotices[0];
            const latestTime = latest?.createdAt?.toDate?.() || new Date();
            if (UI.hasUnreadNotices(latestTime.toISOString())) {
                document.getElementById('tabNotices')?.classList.add('notice-badge');
            }
        }
    } catch (error) {
        console.error('Load notices error:', error);
    }
}

// =====================================================
// LOAD DIARIES
// =====================================================
async function loadDiaries() {
    try {
        const snapshot = await db.collection('diary')
            .where('className', '==', currentParent.className)
            .get();

        allDiaries = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            // Parent కి approved only చూపించు
            if (d.isApproved === true) {
                allDiaries.push({ id: doc.id, ...d });
            }
        });
        allDiaries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch (error) {
        console.error('Load diaries error:', error);
    }
}

// =====================================================
// LOAD ATTENDANCE
// =====================================================
async function loadAttendance() {
    try {
        // Old format (Step 7 లో C2 కి మారుతుంది)
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

// =====================================================
// LOAD MENU
// =====================================================
async function loadMenu() {
    try {
        const today = new Date();
        const dateStr = today.getFullYear() + '-' +
                        String(today.getMonth() + 1).padStart(2, '0') + '-' +
                        String(today.getDate()).padStart(2, '0');

        const doc = await db.collection('menu').doc(dateStr).get();
        allMenu = doc.exists ? doc.data() : null;
    } catch (error) {
        console.error('Load menu error:', error);
        allMenu = null;
    }
}

// =====================================================
// LOAD LEAVES
// =====================================================
async function loadLeaves() {
    try {
        const snapshot = await db.collection('leaveLetters')
            .where('studentId', '==', currentParent.studentId)
            .get();

        allLeaves = [];
        snapshot.forEach(doc => {
            allLeaves.push({ id: doc.id, ...doc.data() });
        });
        allLeaves.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
    } catch (error) {
        console.error('Load leaves error:', error);
        allLeaves = [];
    }
}

// =====================================================
// TABS
// =====================================================
function switchTab(tab) {
    currentTab = tab;

    ['notices', 'diary', 'attendance', 'menu', 'leave'].forEach(t => {
        const btn = document.getElementById('tab' + capitalize(t));
        if (btn) {
            btn.className = t === tab ? 'btn btn-primary' : 'btn btn-outline';
        }
    });

    if (tab === 'notices' && typeof UI !== 'undefined') {
        UI.markNoticesRead();
        document.getElementById('tabNotices')?.classList.remove('notice-badge');
    }

    renderContent();
}

function renderContent() {
    const container = document.getElementById('parentContent');
    if (!container) return;

    if (currentTab === 'notices') renderNoticesContent(container);
    else if (currentTab === 'diary') renderDiaryContent(container);
    else if (currentTab === 'attendance') renderAttendanceContent(container);
    else if (currentTab === 'menu') renderMenuContent(container);
    else if (currentTab === 'leave') renderLeaveContent(container);
}

// =====================================================
// RENDER — NOTICES
// =====================================================
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

// =====================================================
// RENDER — DIARY (Approved only)
// =====================================================
function renderDiaryContent(container) {
    if (allDiaries.length === 0) {
        container.innerHTML = emptyState('📖', 'ఇంకా Approved Diary entries లేవు');
        return;
    }

    container.innerHTML = `
        <div class="card">
            <h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">📖 ${escapeHtml(currentParent.className)} — Diary</h3>
            ${allDiaries.slice(0, 20).map(d => `
                <div style="padding: var(--space-md); margin-bottom: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <h4 style="font-size: 0.95rem;">📚 ${escapeHtml(d.subject || '—')}</h4>
                        <span class="status-badge status-approved">✅ Approved</span>
                    </div>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">📅 ${escapeHtml(d.date || '—')} • 👨‍🏫 ${escapeHtml(d.teacherName || 'Teacher')}</p>
                    <p style="font-size: 0.85rem; white-space: pre-wrap; margin-bottom: 6px;"><strong>Class Work:</strong> ${escapeHtml(d.classWork || d.content || '')}</p>
                    ${d.homework ? `<p style="font-size: 0.8rem; color: var(--primary); padding-top: 6px; border-top: 1px solid var(--border-color);"><strong>📝 Homework:</strong> ${escapeHtml(d.homework)}</p>` : ''}
                    ${d.approvedBy ? `<p style="font-size: 0.7rem; color: var(--success); margin-top: 6px;">✅ Approved by ${escapeHtml(d.approvedBy)}</p>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

// =====================================================
// RENDER — ATTENDANCE
// =====================================================
function renderAttendanceContent(container) {
    if (allAttendance.length === 0) {
        container.innerHTML = emptyState('✅', 'ఇంకా Attendance records లేవు');
        return;
    }

    const presentCount = allAttendance.filter(a => a.status === 'present').length;
    const absentCount = allAttendance.filter(a => a.status === 'absent').length;
    const leaveCount = allAttendance.filter(a => a.status === 'leave').length;
    const total = allAttendance.length;
    const percentage = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    container.innerHTML = `
        <div class="card">
            <h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">✅ Attendance</h3>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: var(--space-xs); margin-bottom: var(--space-md);">
                <div style="text-align: center; padding: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm);">
                    <p style="font-size: 1.3rem; font-weight: 700; color: var(--success);">${presentCount}</p>
                    <p style="font-size: 0.65rem; color: var(--text-muted);">Present</p>
                </div>
                <div style="text-align: center; padding: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm);">
                    <p style="font-size: 1.3rem; font-weight: 700; color: var(--danger);">${absentCount}</p>
                    <p style="font-size: 0.65rem; color: var(--text-muted);">Absent</p>
                </div>
                <div style="text-align: center; padding: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm);">
                    <p style="font-size: 1.3rem; font-weight: 700; color: #E65100;">${leaveCount}</p>
                    <p style="font-size: 0.65rem; color: var(--text-muted);">Leave</p>
                </div>
                <div style="text-align: center; padding: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm);">
                    <p style="font-size: 1.3rem; font-weight: 700; color: var(--primary);">${percentage}%</p>
                    <p style="font-size: 0.65rem; color: var(--text-muted);">%</p>
                </div>
            </div>

            ${allAttendance.slice(0, 30).map(a => {
                let badgeClass = 'status-pending', statusText = '—';
                if (a.status === 'present') { badgeClass = 'status-approved'; statusText = '✅ Present'; }
                else if (a.status === 'absent') { badgeClass = 'status-rejected'; statusText = '❌ Absent'; }
                else if (a.status === 'leave') { badgeClass = 'status-leave'; statusText = '📅 Leave'; }

                return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) 0; border-bottom: 1px solid var(--border-color);">
                    <span style="font-size: 0.85rem;">📅 ${escapeHtml(a.date || '—')}</span>
                    <span class="status-badge ${badgeClass}">${statusText}</span>
                </div>
                `;
            }).join('')}
        </div>
    `;
}

// =====================================================
// RENDER — MENU
// =====================================================
function renderMenuContent(container) {
    if (!allMenu) {
        container.innerHTML = emptyState('🍽️', 'ఈరోజు మెనూ ఇంకా సెట్ చేయలేదు');
        return;
    }

    const meals = [
        { key: 'breakfast', icon: '🌅', label: 'Breakfast' },
        { key: 'lunch', icon: '☀️', label: 'Lunch' },
        { key: 'snacks', icon: '🍪', label: 'Snacks' }
    ];

    let html = '';
    meals.forEach(meal => {
        const items = allMenu[meal.key];
        if (items && items.length > 0) {
            html += `
                <div style="background: var(--bg-color); padding: var(--space-md); border-radius: var(--radius-md); margin-bottom: var(--space-sm); border-left: 4px solid #F57C00;">
                    <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: var(--space-sm);">${meal.icon} ${meal.label}</h4>
                    <ul style="list-style: none; padding: 0; margin: 0;">
                        ${items.map(item => `<li style="padding: 4px 0; font-size: 0.9rem;">🍽️ ${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    });

    const sponsor = allMenu.sponsor;
    if (sponsor && sponsor.item) {
        html += `
            <div class="sponsor-box">
                <div class="sponsor-title">🎁 Sponsor</div>
                <p style="font-size: 0.85rem;">${escapeHtml(sponsor.donor || '—')} — ${escapeHtml(sponsor.item)}</p>
            </div>
        `;
    }

    if (!html) html = emptyState('🍽️', 'ఈరోజు మెనూ ఇంకా సెట్ చేయలేదు');

    container.innerHTML = `
        <div class="card">
            <h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">🍽️ ఈరోజు మెనూ</h3>
            ${html}
        </div>
    `;
}

// =====================================================
// RENDER — LEAVE
// =====================================================
function renderLeaveContent(container) {
    let html = `
        <div class="card">
            <h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">📅 Leave Apply</h3>
            <form id="parentLeaveForm" class="form" novalidate>
                <div class="field">
                    <label for="parentLeaveFrom">From Date</label>
                    <input type="date" id="parentLeaveFrom" required />
                </div>
                <div class="field">
                    <label for="parentLeaveTo">To Date</label>
                    <input type="date" id="parentLeaveTo" required />
                </div>
                <div class="field">
                    <label for="parentLeaveReason">కారణం</label>
                    <textarea id="parentLeaveReason" required rows="3" placeholder="సెలవు కారణం..." style="height: auto; min-height: 80px; padding: 12px 16px; resize: vertical;"></textarea>
                </div>
                <p id="parentLeaveError" class="form-error hidden" role="alert"></p>
                <button type="submit" class="btn btn-primary btn-block">
                    <i class="fas fa-paper-plane" style="margin-right: 8px;"></i> Leave Submit
                </button>
            </form>
        </div>
    `;

    if (allLeaves.length > 0) {
        html += `
            <div class="card">
                <h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">📋 My Leaves</h3>
                ${allLeaves.map(l => {
                    let badgeClass = 'status-pending', statusText = '⏳ Pending';
                    if (l.status === 'approved') { badgeClass = 'status-approved'; statusText = '✅ Approved'; }
                    else if (l.status === 'rejected') { badgeClass = 'status-rejected'; statusText = '❌ Rejected'; }

                    return `
                    <div style="padding: var(--space-md); margin-bottom: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="font-size: 0.85rem; font-weight: 600;">📅 ${escapeHtml(l.fromDate || '')} → ${escapeHtml(l.toDate || '')}</span>
                            <span class="status-badge ${badgeClass}">${statusText}</span>
                        </div>
                        <p style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(l.reason || '')}</p>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    container.innerHTML = html;

    // Bind leave form
    const form = document.getElementById('parentLeaveForm');
    if (form) {
        form.addEventListener('submit', handleParentLeaveSubmit);
    }
}

async function handleParentLeaveSubmit(e) {
    e.preventDefault();
    const fromDate = document.getElementById('parentLeaveFrom').value;
    const toDate = document.getElementById('parentLeaveTo').value;
    const reason = document.getElementById('parentLeaveReason').value.trim();
    const errorEl = document.getElementById('parentLeaveError');

    if (!fromDate || !toDate) return showFormError(errorEl, 'From/To తేదీలు ఎంచుకోండి.');
    if (new Date(toDate) < new Date(fromDate)) return showFormError(errorEl, 'To Date, From Date కన్నా తర్వాత ఉండాలి.');
    if (!reason) return showFormError(errorEl, 'కారణం రాయండి.');

    try {
        await db.collection('leaveLetters').add({
            studentId: currentParent.studentId,
            studentName: currentParent.studentName,
            rollNumber: currentParent.rollNumber,
            className: currentParent.className,
            fromDate: fromDate,
            toDate: toDate,
            reason: reason,
            status: 'pending',
            type: 'student',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        UI.toast('✅ Leave విజయవంతంగా submit అయ్యింది!', 'success');
        await loadLeaves();
        renderContent();
    } catch (err) {
        console.error('Parent leave error:', err);
        showFormError(errorEl, 'Submit విఫలమైంది. మళ్లీ ప్రయత్నించండి.');
    }
}

// =====================================================
// HELPERS
// =====================================================
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
