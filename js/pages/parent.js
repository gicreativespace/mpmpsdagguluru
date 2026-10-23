// js/pages/parent.js — v12.0 (Step 7.2 — Poster)
let currentScreen = 'login';
let parentSession = null;
let currentParent = null;
let currentTab = 'notices';
let allNotices = [];
let allDiaries = [];
let allAttendance = [];
let allMenu = null;
let allLeaves = [];
let currentSchoolData = null;
let posterDataUrl = '';
let currentPosterDiary = null;

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('dm_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const savedSize = localStorage.getItem('dm_font_size');
    if (savedSize) document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');

    if (typeof UI !== 'undefined') UI.initLayout();

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
        if (currentScreen === 'dashboard') showScreen('childSelect');
        else if (currentScreen === 'addChild') showScreen('login');
        else if (currentScreen === 'childSelect') showScreen('login');
        else if (currentScreen === 'login') {
            localStorage.removeItem('dm_parent_session');
            window.location.href = 'index.html';
        }
    });
    header.insertBefore(backBtn, header.firstChild);
}
async function decideScreen() {
    try {
        if (typeof authReady !== 'undefined') await Promise.race([authReady, new Promise(r => setTimeout(r, 3000))]);

        // Load school data (for poster)
        try {
            const sd = await db.collection('schoolInfo').doc('main').get();
            if (sd.exists) currentSchoolData = sd.data();
        } catch (e) { console.warn('School data:', e); }

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
            } catch (e) { localStorage.removeItem('dm_parent_session'); }
        }

        const schoolDoc = await db.collection('schoolInfo').doc('main').get();
        if (!schoolDoc.exists || !schoolDoc.data().isSetupComplete) {
            UI.toast('⚠️ సెటప్ పూర్తి కాలేదు.', 'warning', 5000);
            showScreen('login'); return;
        }
        if (schoolDoc.data().sections?.parent !== true) {
            UI.toast('⚠️ Parent సెక్షన్ ఎనేబుల్ కాలేదు.', 'warning', 5000);
            showScreen('login'); return;
        }

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
        console.error('Screen decision:', error);
        showScreen('login');
    }
}

function showScreen(name) {
    currentScreen = name;
    ['login', 'addChild', 'childSelect', 'dashboard'].forEach(s => {
        const el = document.getElementById('screen' + capitalize(s));
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('screen' + capitalize(name));
    if (target) target.classList.remove('hidden');

    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.classList.remove('hidden');

    const goHomeBtn = document.getElementById('goHomeBtn');
    if (goHomeBtn) {
        if (name === 'dashboard' || name === 'childSelect') goHomeBtn.classList.remove('hidden');
        else goHomeBtn.classList.add('hidden');
    }

    const title = document.getElementById('pageTitle');
    if (title) {
        title.textContent = {
            login: 'Parent', addChild: 'Add Child',
            childSelect: 'My Children', dashboard: 'Parent Dashboard'
        }[name] || 'Parent';
    }
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function bindEvents() {
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', () => {
        if (typeof UI !== 'undefined') UI.toggleTheme();
        themeBtn.textContent = document.body.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    });
    const rollInput = document.getElementById('addChildRoll');
    if (rollInput) rollInput.addEventListener('input', () => {
        rollInput.value = rollInput.value.replace(/\D/g, '').slice(0, 10);
    });
    const dobInput = document.getElementById('addChildDob');
    if (dobInput) dobInput.addEventListener('input', () => {
        dobInput.value = dobInput.value.replace(/\D/g, '').slice(0, 6);
    });
    const addChildForm = document.getElementById('addChildForm');
    if (addChildForm) addChildForm.addEventListener('submit', e => {
        e.preventDefault(); handleAddChild();
    });
}

async function loadClassesForAddChild() {
    const select = document.getElementById('addChildClass');
    if (!select || select.options.length > 1) return;
    try {
        const snap = await db.collection('classrooms').get();
        if (snap.empty) return;
        const classes = [];
        snap.forEach(doc => {
            const d = doc.data();
            if (d.className) classes.push({ id: doc.id, className: d.className });
        });
        classes.sort((a, b) => (a.className || '').localeCompare(b.className || ''));
        select.innerHTML = '<option value="">-- Class ఎంచుకోండి --</option>';
        classes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id; opt.textContent = c.className;
            select.appendChild(opt);
        });
    } catch (err) { console.error('Load classes:', err); }
}

async function handleAddChild() {
    const classroomId = document.getElementById('addChildClass').value;
    const rollNumber = document.getElementById('addChildRoll').value.trim();
    const dob = document.getElementById('addChildDob').value.trim();
    const errorEl = document.getElementById('addChildError');
    const btn = document.getElementById('addChildBtn');

    if (!classroomId) return showFormError(errorEl, 'Class ఎంచుకోండి.');
    if (!rollNumber) return showFormError(errorEl, 'Roll Number నింపండి.');
    if (!/^\d{6}$/.test(dob)) return showFormError(errorEl, 'DOB 6 అంకెలు.');

    btn.disabled = true; btn.innerHTML = 'Verifying...'; hideFormError(errorEl);

    try {
        const classDoc = await db.collection('classrooms').doc(classroomId).get();
        if (!classDoc.exists) {
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Child Confirm';
            return showFormError(errorEl, 'Class కనుగొనబడలేదు.');
        }
        const classData = classDoc.data();

        const studentsSnap = await db.collection('classrooms').doc(classroomId).collection('students')
            .where('rollNumber', '==', rollNumber).limit(1).get();
        if (studentsSnap.empty) {
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Child Confirm';
            return showFormError(errorEl, '❌ Roll Number కనుగొనబడలేదు.');
        }

        const studentDoc = studentsSnap.docs[0];
        const studentData = studentDoc.data();
        if (String(studentData.dob || '').trim() !== dob) {
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Child Confirm';
            return showFormError(errorEl, '❌ DOB మ్యాచ్ కాలేదు.');
        }

        if (!parentSession) {
            const existing = localStorage.getItem('dm_parent_session');
            parentSession = existing ? JSON.parse(existing) : { children: [], currentIndex: 0 };
            if (!parentSession.children) parentSession.children = [];
        }

        const dup = parentSession.children.find(c => c.studentId === studentDoc.id);
        if (dup) {
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Child Confirm';
            return showFormError(errorEl, '⚠️ విద్యార్థి ఇప్పటికే add అయ్యారు.');
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
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Child Confirm';
        showScreen('childSelect');
        renderChildrenList();
    } catch (err) {
        console.error('Add child:', err);
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Child Confirm';
        showFormError(errorEl, 'నెట్‌వర్క్ లోపం.');
    }
}

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

async function loadNotices() {
    try {
        const snap = await db.collection('noticeBoard').get();
        allNotices = [];
        snap.forEach(doc => allNotices.push({ id: doc.id, ...doc.data() }));
        allNotices.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        if (allNotices.length > 0 && typeof UI !== 'undefined') {
            const latest = allNotices[0];
            const latestTime = latest?.createdAt?.toDate?.() || new Date();
            if (UI.hasUnreadNotices(latestTime.toISOString())) {
                document.getElementById('tabNotices')?.classList.add('notice-badge');
            }
        }
    } catch (e) { console.error('Load notices:', e); }
}

async function loadDiaries() {
    try {
        const snap = await db.collection('diary').where('className', '==', currentParent.className).get();
        allDiaries = [];
        snap.forEach(doc => {
            const d = doc.data();
            if (d.isApproved === true) allDiaries.push({ id: doc.id, ...d });
        });
        allDiaries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch (e) { console.error('Load diaries:', e); }
}

async function loadAttendance() {
    try {
        if (!currentParent) return;
        const now = new Date();
        const eduYear = getEduYear();
        const month = getMonthName(now);
        const doc = await db.collection('attendance').doc(eduYear).collection(currentParent.className).doc(month).get();
        allAttendance = [];
        if (doc.exists && doc.data().approved === true) {
            const days = doc.data().days || {};
            Object.keys(days).sort().reverse().forEach(dateStr => {
                const day = days[dateStr];
                if (day[currentParent.studentId]) {
                    allAttendance.push({ date: dateStr, status: day[currentParent.studentId].status });
                }
            });
        }
    } catch (error) {
        console.error('Load attendance:', error);
        allAttendance = [];
    }
}

async function loadMenu() {
    try {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const doc = await db.collection('menu').doc(dateStr).get();
        allMenu = doc.exists ? doc.data() : null;
    } catch (e) { console.error('Load menu:', e); allMenu = null; }
}

async function loadLeaves() {
    try {
        const snap = await db.collection('leaveLetters').where('studentId', '==', currentParent.studentId).get();
        allLeaves = [];
        snap.forEach(doc => allLeaves.push({ id: doc.id, ...doc.data() }));
        allLeaves.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
    } catch (e) { console.error('Load leaves:', e); allLeaves = []; }
}

function switchTab(tab) {
    currentTab = tab;
    ['notices', 'diary', 'attendance', 'menu', 'leave'].forEach(t => {
        const btn = document.getElementById('tab' + capitalize(t));
        if (btn) btn.className = t === tab ? 'btn btn-primary' : 'btn btn-outline';
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

function renderNoticesContent(container) {
    if (allNotices.length === 0) { container.innerHTML = emptyState('📢', 'ఇంకా నోటీసులు లేవు'); return; }
    container.innerHTML = `<div class="card">
        <h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">📢 Notices</h3>
        ${allNotices.map(n => {
            const pc = n.priority === 'urgent' ? 'var(--danger)' : n.priority === 'important' ? '#F9A825' : 'var(--success)';
            return `<div style="padding: var(--space-md); margin-bottom: var(--space-sm); border-left: 4px solid ${pc}; background: var(--bg-color); border-radius: var(--radius-sm);">
                <h4 style="font-size: 0.95rem; margin-bottom: 4px;">${escapeHtml(n.title || '—')}</h4>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px; white-space: pre-wrap;">${escapeHtml(n.content || '')}</p>
                <p style="font-size: 0.7rem; color: var(--text-muted);">📅 ${formatDate(n.createdAt)}</p>
            </div>`;
        }).join('')}
    </div>`;
}

function renderDiaryContent(container) {
    if (allDiaries.length === 0) { container.innerHTML = emptyState('📖', 'ఇంకా Approved Diary లేవు'); return; }
    container.innerHTML = `<div class="card">
        <h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">📖 ${escapeHtml(currentParent.className)} — Diary</h3>
        ${allDiaries.slice(0, 20).map(d => `
            <div style="padding: var(--space-md); margin-bottom: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <h4 style="font-size: 0.95rem;">📚 ${escapeHtml(d.subject || '—')}</h4>
                    <span class="status-badge status-approved">✅ Approved</span>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">📅 ${escapeHtml(d.date || '—')} • 👨‍🏫 ${escapeHtml(d.teacherName || 'Teacher')}</p>
                <p style="font-size: 0.85rem; white-space: pre-wrap; margin-bottom: 6px;"><strong>Class Work:</strong> ${escapeHtml(d.classWork || d.content || '')}</p>
                ${d.homework ? `<p style="font-size: 0.8rem; color: var(--primary); padding-top: 6px; border-top: 1px solid var(--border-color); margin-bottom: 8px;"><strong>📝 Homework:</strong> ${escapeHtml(d.homework)}</p>` : ''}
                <button class="btn btn-secondary btn-block" onclick="showPosterModal('${d.id}')" style="padding: 10px; font-size: 0.85rem;">
                    <i class="fas fa-image" style="margin-right: 6px;"></i> 🎨 Poster Create
                </button>
            </div>
        `).join('')}
    </div>`;
}

function renderAttendanceContent(container) {
    if (allAttendance.length === 0) { container.innerHTML = emptyState('✅', 'ఇంకా Attendance records లేవు (HM approve చేయాలి)'); return; }
    const presentCount = allAttendance.filter(a => a.status === 'present').length;
    const absentCount = allAttendance.filter(a => a.status === 'absent').length;
    const leaveCount = allAttendance.filter(a => a.status === 'leave').length;
    const total = allAttendance.length;
    const percentage = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    container.innerHTML = `<div class="card">
        <h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">✅ Attendance</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: var(--space-xs); margin-bottom: var(--space-md);">
            <div style="text-align: center; padding: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm);"><p style="font-size: 1.3rem; font-weight: 700; color: var(--success);">${presentCount}</p><p style="font-size: 0.65rem; color: var(--text-muted);">Present</p></div>
            <div style="text-align: center; padding: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm);"><p style="font-size: 1.3rem; font-weight: 700; color: var(--danger);">${absentCount}</p><p style="font-size: 0.65rem; color: var(--text-muted);">Absent</p></div>
            <div style="text-align: center; padding: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm);"><p style="font-size: 1.3rem; font-weight: 700; color: #E65100;">${leaveCount}</p><p style="font-size: 0.65rem; color: var(--text-muted);">Leave</p></div>
            <div style="text-align: center; padding: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm);"><p style="font-size: 1.3rem; font-weight: 700; color: var(--primary);">${percentage}%</p><p style="font-size: 0.65rem; color: var(--text-muted);">%</p></div>
        </div>
        ${allAttendance.slice(0, 30).map(a => {
            let bc = 'status-pending', st = '—';
            if (a.status === 'present') { bc = 'status-approved'; st = '✅ Present'; }
            else if (a.status === 'absent') { bc = 'status-rejected'; st = '❌ Absent'; }
            else if (a.status === 'leave') { bc = 'status-leave'; st = '📅 Leave'; }
            return `<div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) 0; border-bottom: 1px solid var(--border-color);">
                <span style="font-size: 0.85rem;">📅 ${escapeHtml(a.date || '—')}</span>
                <span class="status-badge ${bc}">${st}</span>
            </div>`;
        }).join('')}
    </div>`;
}

function renderMenuContent(container) {
    if (!allMenu) { container.innerHTML = emptyState('🍽️', 'ఈరోజు మెనూ ఇంకా సెట్ కాలేదు'); return; }
    const meals = [
        { key: 'breakfast', icon: '🌅', label: 'Breakfast' },
        { key: 'lunch', icon: '☀️', label: 'Lunch' },
        { key: 'snacks', icon: '🍪', label: 'Snacks' }
    ];
    let html = '';
    meals.forEach(meal => {
        const items = allMenu[meal.key];
        if (items && items.length > 0) {
            html += `<div style="background: var(--bg-color); padding: var(--space-md); border-radius: var(--radius-md); margin-bottom: var(--space-sm); border-left: 4px solid #F57C00;">
                <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: var(--space-sm);">${meal.icon} ${meal.label}</h4>
                <ul style="list-style: none; padding: 0; margin: 0;">${items.map(item => `<li style="padding: 4px 0; font-size: 0.9rem;">🍽️ ${escapeHtml(item)}</li>`).join('')}</ul>
            </div>`;
        }
    });
    const sponsor = allMenu.sponsor;
    if (sponsor && sponsor.item) {
        html += `<div class="sponsor-box"><div class="sponsor-title">🎁 Sponsor</div><p style="font-size: 0.85rem;">${escapeHtml(sponsor.donor || '—')} — ${escapeHtml(sponsor.item)}</p></div>`;
    }
    if (!html) html = emptyState('🍽️', 'ఈరోజు మెనూ ఇంకా సెట్ కాలేదు');
    container.innerHTML = `<div class="card"><h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">🍽️ ఈరోజు మెనూ</h3>${html}</div>`;
}

function renderLeaveContent(container) {
    let html = `<div class="card">
        <h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">📅 Leave Apply</h3>
        <form id="parentLeaveForm" class="form" novalidate>
            <div class="field"><label for="parentLeaveFrom">From Date</label><input type="date" id="parentLeaveFrom" required /></div>
            <div class="field"><label for="parentLeaveTo">To Date</label><input type="date" id="parentLeaveTo" required /></div>
            <div class="field"><label for="parentLeaveReason">కారణం</label><textarea id="parentLeaveReason" required rows="3" style="height: auto; min-height: 80px; padding: 12px 16px; resize: vertical;"></textarea></div>
            <p id="parentLeaveError" class="form-error hidden" role="alert"></p>
            <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-paper-plane"></i> Leave Submit</button>
        </form>
    </div>`;
    if (allLeaves.length > 0) {
        html += `<div class="card"><h3 class="card-title" style="font-size: 1.1rem; text-align: left; margin-bottom: var(--space-md);">📋 My Leaves</h3>${allLeaves.map(l => {
            let bc = 'status-pending', st = '⏳ Pending';
            if (l.status === 'approved') { bc = 'status-approved'; st = '✅ Approved'; }
            else if (l.status === 'rejected') { bc = 'status-rejected'; st = '❌ Rejected'; }
            return `<div style="padding: var(--space-md); margin-bottom: var(--space-sm); background: var(--bg-color); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 0.85rem; font-weight: 600;">📅 ${escapeHtml(l.fromDate || '')} → ${escapeHtml(l.toDate || '')}</span>
                    <span class="status-badge ${bc}">${st}</span>
                </div>
                <p style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(l.reason || '')}</p>
            </div>`;
        }).join('')}</div>`;
    }
    container.innerHTML = html;
    const form = document.getElementById('parentLeaveForm');
    if (form) form.addEventListener('submit', handleParentLeaveSubmit);
}

async function handleParentLeaveSubmit(e) {
    e.preventDefault();
    const fromDate = document.getElementById('parentLeaveFrom').value;
    const toDate = document.getElementById('parentLeaveTo').value;
    const reason = document.getElementById('parentLeaveReason').value.trim();
    const errorEl = document.getElementById('parentLeaveError');
    if (!fromDate || !toDate) return showFormError(errorEl, 'From/To తేదీలు.');
    if (new Date(toDate) < new Date(fromDate)) return showFormError(errorEl, 'తేదీలు చెక్ చేయండి.');
    if (!reason) return showFormError(errorEl, 'కారణం రాయండి.');
    try {
        await db.collection('leaveLetters').add({
            studentId: currentParent.studentId, studentName: currentParent.studentName,
            rollNumber: currentParent.rollNumber, className: currentParent.className,
            fromDate, toDate, reason, status: 'pending', type: 'student',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        UI.toast('✅ Leave Submit!', 'success');
        await loadLeaves();
        renderContent();
    } catch (err) {
        console.error('Leave:', err);
        showFormError(errorEl, 'Submit విఫలం.');
    }
}

// =====================================================
// POSTER (Step 7.2 — Canvas)
// =====================================================
function showPosterModal(diaryId) {
    const d = allDiaries.find(x => x.id === diaryId);
    if (!d) return;
    currentPosterDiary = d;

    const canvas = document.getElementById('posterCanvas');
    drawPoster(canvas, d);
    document.getElementById('posterModal').classList.add('active');
}

function closePosterModal() {
    document.getElementById('posterModal').classList.remove('active');
}

function drawPoster(canvas, d) {
    const W = 1080, H = 1350;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const schoolName = currentSchoolData?.schoolName || 'MPMP School';
    const village = currentSchoolData?.village || '';
    const mandal = currentSchoolData?.mandal || '';
    const district = currentSchoolData?.district || '';
    const hmName = currentSchoolData?.hmName || 'HM';

    // White BG
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Green header
    ctx.fillStyle = '#1B5E20';
    ctx.fillRect(0, 0, W, 220);

    // School name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 52px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(schoolName, W / 2, 90);

    // Address
    ctx.font = '28px Inter, sans-serif';
    ctx.fillText(`${village} • ${mandal} • ${district}`, W / 2, 140);

    // Gold accent
    ctx.fillStyle = '#FFC107';
    ctx.fillRect(0, 215, W, 10);

    // Class
    ctx.fillStyle = '#1B5E20';
    ctx.font = 'bold 42px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${d.className}`, 60, 300);

    // Subject + Date
    ctx.font = '32px Inter, sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText(`${d.subject} • ${d.date}`, 60, 350);

    // Gold underline
    ctx.fillStyle = '#FFC107';
    ctx.fillRect(60, 370, W - 120, 4);

    // Class Work
    let y = 430;
    ctx.fillStyle = '#1B5E20';
    ctx.font = 'bold 30px Inter, sans-serif';
    ctx.fillText('✍️ CLASS WORK', 60, y);
    y += 50;

    ctx.fillStyle = '#212121';
    ctx.font = '28px Inter, sans-serif';
    y = wrapText(ctx, d.classWork || d.content || '—', 60, y, W - 120, 38);
    y += 40;

    // Home Work
    if (d.homework) {
        ctx.fillStyle = '#1B5E20';
        ctx.font = 'bold 30px Inter, sans-serif';
        ctx.fillText('🏠 HOME WORK', 60, y);
        y += 50;

        ctx.fillStyle = '#212121';
        ctx.font = '28px Inter, sans-serif';
        y = wrapText(ctx, d.homework, 60, y, W - 120, 38);
    }

    // Teacher name
    ctx.fillStyle = '#555';
    ctx.font = '26px Inter, sans-serif';
    ctx.fillText(`👨‍🏫 ${d.teacherName || '—'}`, 60, H - 180);

    // Footer
    ctx.fillStyle = '#1B5E20';
    ctx.fillRect(0, H - 100, W, 100);
    ctx.fillStyle = '#FFC107';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Digital Manabadi — @valiass', W / 2, H - 50);

    // HM Seal
    drawSeal(ctx, W - 220, H - 280, hmName);

    posterDataUrl = canvas.toDataURL('image/png');
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
    return y + lineHeight;
}

function drawSeal(ctx, cx, cy, hmName) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-8 * Math.PI / 180);
    const R = 110;

    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(198, 40, 40, 0.85)';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, R - 14, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(198, 40, 40, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(198, 40, 40, 0.9)';
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText('HM', 0, -40);

    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText((hmName || 'HM').substring(0, 12), 0, -10);

    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText('APPROVED', 0, 25);

    ctx.font = '16px Inter, sans-serif';
    const today = new Date();
    const dstr = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
    ctx.fillText(dstr, 0, 55);

    ctx.restore();
}

function downloadPoster() {
    if (!posterDataUrl) {
        UI.toast('Poster generate కాలేదు.', 'warning');
        return;
    }
    const a = document.createElement('a');
    a.href = posterDataUrl;
    a.download = `diary-poster-${Date.now()}.png`;
    a.click();
    UI.toast('✅ Poster download అవుతోంది!', 'success');
}

function sharePosterWhatsApp() {
    if (!currentPosterDiary) return;
    const d = currentPosterDiary;
    const schoolName = currentSchoolData?.schoolName || 'MPMP School';
    const hmName = currentSchoolData?.hmName || 'HM';

    const text = `🏫 *${schoolName}*

📚 *${d.className} | ${d.subject}*
📅 Date: ${d.date}

✍️ *Class Work:*
${d.classWork || d.content || '—'}

🏠 *Home Work:*
${d.homework || '—'}

👨‍🏫 Teacher: ${d.teacherName || '—'}
✅ Approved by: HM ${hmName}

_— Digital Manabadi_`;

    const url = 'https://wa.me/?text=' + encodeURIComponent(text);
    window.open(url, '_blank');

    UI.toast('💡 Poster image download చేసి WhatsApp లో attach చేయండి.', 'info', 5000);
}

// =====================================================
// HELPERS
// =====================================================
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

function emptyState(icon, message) {
    return `<div class="card" style="text-align: center; padding: var(--space-xl);">
        <div style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);">${icon}</div>
        <p style="color: var(--text-muted);">${message}</p>
    </div>`;
}

function formatDate(timestamp) {
    if (!timestamp) return '—';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    } catch (e) { return '—'; }
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
