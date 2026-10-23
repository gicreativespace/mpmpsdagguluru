// js/pages/hm-leaves.js — v12.0 (Step 5.4 — Auto Leave Mark)
let currentTab = 'teacher';
let currentFilter = 'all';
let allLeaves = [];

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('dm_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const savedSize = localStorage.getItem('dm_font_size');
    if (savedSize) document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');

    const session = Auth.checkAuth('headmaster');
    if (!session) return;

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('leavesApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        addCustomBackButton();
        await loadLeaves();
    }, 1200);

    bindEvents();
});

function addCustomBackButton() {
    const header = document.querySelector('.app-header');
    if (!header) return;
    let backBtn = header.querySelector('#backBtn');
    if (backBtn) backBtn.remove();
    backBtn = document.createElement('button');
    backBtn.id = 'backBtn';
    backBtn.className = 'icon-btn back-btn';
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
    backBtn.addEventListener('click', () => window.location.href = 'hm-dashboard.html');
    header.insertBefore(backBtn, header.firstChild);
}

function bindEvents() {
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', () => {
        if (typeof UI !== 'undefined') UI.toggleTheme();
        themeBtn.textContent = document.body.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    });
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        if (typeof UI !== 'undefined' && UI.confirmLogout) UI.confirmLogout();
        else if (confirm('లాగౌట్ చేయాలా?')) Auth.logout();
    });
}

async function loadLeaves() {
    const container = document.getElementById('leavesList');
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">లోడ్...</p>`;
    try {
        if (typeof authReady !== 'undefined') await Promise.race([authReady, new Promise(r => setTimeout(r, 3000))]);
        const snap = await db.collection('leaveLetters').get();
        allLeaves = [];
        snap.forEach(doc => allLeaves.push({ id: doc.id, ...doc.data() }));
        allLeaves.sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        renderLeaves();
    } catch (e) {
        console.error('Load leaves:', e);
        container.innerHTML = `<p style="color: var(--danger); text-align: center;">లోడ్ విఫలం</p>`;
    }
}

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('tabTeacher').className = tab === 'teacher' ? 'btn btn-primary' : 'btn btn-outline';
    document.getElementById('tabStudent').className = tab === 'student' ? 'btn btn-primary' : 'btn btn-outline';
    renderLeaves();
}

function switchFilter(filter) {
    currentFilter = filter;
    document.getElementById('filterAll').className = filter === 'all' ? 'btn btn-primary' : 'btn btn-outline';
    document.getElementById('filterPending').className = filter === 'pending' ? 'btn btn-primary' : 'btn btn-outline';
    renderLeaves();
}

function renderLeaves() {
    const container = document.getElementById('leavesList');
    if (!container) return;
    const typeFilter = currentTab === 'teacher' ? 'teacher' : 'student';
    let filtered = allLeaves.filter(l => (l.type || 'teacher') === typeFilter);
    if (currentFilter === 'pending') filtered = filtered.filter(l => l.status === 'pending');

    if (filtered.length === 0) {
        container.innerHTML = `<div class="card" style="text-align: center; padding: var(--space-xl);">
            <div style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);">📅</div>
            <p style="color: var(--text-muted);">${currentTab === 'teacher' ? 'Teacher' : 'Student'} leaves లేవు</p>
        </div>`;
        return;
    }
    container.innerHTML = filtered.map(leave => renderLeaveCard(leave)).join('');
}

function renderLeaveCard(leave) {
    const name = leave.teacherName || leave.studentName || '—';
    const role = leave.type === 'student' ? `👶 ${leave.className || ''} • Roll ${leave.rollNumber || ''}` : '👨‍🏫 Teacher';
    const phone = leave.teacherPhone || '';
    const from = leave.fromDate || '—';
    const to = leave.toDate || '—';
    const reason = leave.reason || '';
    const status = leave.status || 'pending';

    let sc = 'status-pending', st = '⏳ Pending';
    if (status === 'approved') { sc = 'status-approved'; st = '✅ Approved'; }
    else if (status === 'rejected') { sc = 'status-rejected'; st = '❌ Rejected'; }

    const canAct = status === 'pending';

    return `<div class="card" style="padding: var(--space-md); margin-bottom: var(--space-sm);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-sm);">
            <div style="flex: 1;">
                <h4 style="font-size: 1rem; margin-bottom: 4px;">${escapeHtml(name)}</h4>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">${escapeHtml(role)}${phone ? ' • 📞 ' + escapeHtml(phone) : ''}</p>
                <p style="font-size: 0.85rem; font-weight: 600; color: var(--primary);">📅 ${escapeHtml(from)} → ${escapeHtml(to)}</p>
            </div>
            <span class="status-badge ${sc}">${st}</span>
        </div>
        <p style="font-size: 0.85rem; margin-bottom: var(--space-sm); padding: 8px; background: var(--bg-color); border-radius: var(--radius-sm);">📝 ${escapeHtml(reason)}</p>
        ${canAct ? `<div style="display: flex; gap: var(--space-sm);">
            <button class="btn btn-primary" onclick="approveLeave('${leave.id}')" style="flex: 1; padding: 10px; font-size: 0.85rem;"><i class="fas fa-check"></i> Approve</button>
            <button class="btn btn-danger" onclick="rejectLeave('${leave.id}')" style="flex: 1; padding: 10px; font-size: 0.85rem;"><i class="fas fa-times"></i> Reject</button>
        </div>` : `<p style="font-size: 0.7rem; color: var(--text-muted);">
            ${leave.approvedBy ? '✅ Approved by: ' + escapeHtml(leave.approvedBy) : ''}
            ${leave.rejectedBy ? '❌ Rejected by: ' + escapeHtml(leave.rejectedBy) : ''}
        </p>`}
    </div>`;
}

// =====================================================
// APPROVE — with Auto "Leave" in attendance
// =====================================================
async function approveLeave(leaveId) {
    if (!confirm('ఈ Leave ని Approve చేయాలా?')) return;
    try {
        const leaveRef = db.collection('leaveLetters').doc(leaveId);
        const leaveDoc = await leaveRef.get();
        const leave = leaveDoc.data();

        await leaveRef.update({
            status: 'approved',
            approvedBy: 'HM',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // ✅ Auto "Leave" mark in attendance (student only)
        if (leave.type === 'student' && leave.className && leave.fromDate && leave.toDate) {
            await markAttendanceLeave(leave);
        }

        UI.toast('✅ Leave Approve అయ్యింది!', 'success');
        await loadLeaves();
    } catch (error) {
        console.error('Approve error:', error);
        UI.toast('❌ Approve విఫలమైంది.', 'error');
    }
}

async function markAttendanceLeave(leave) {
    try {
        const eduYear = getEduYear();
        const start = new Date(leave.fromDate);
        const end = new Date(leave.toDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const month = getMonthName(d);
            const ref = db.collection('attendance').doc(eduYear).collection(leave.className).doc(month);
            const doc = await ref.get();
            const existing = doc.exists ? (doc.data().days || {}) : {};
            const dayData = existing[dateStr] || {};
            dayData[leave.studentId] = { status: 'leave', markedBy: 'System (auto)', markedAt: new Date().toISOString() };
            await ref.set({ days: { ...existing, [dateStr]: dayData } }, { merge: true });
        }
    } catch (e) { console.warn('Auto leave mark error:', e); }
}

async function rejectLeave(leaveId) {
    const reason = prompt('Reject కారణం (optional):');
    if (reason === null) return;
    try {
        await db.collection('leaveLetters').doc(leaveId).update({
            status: 'rejected',
            rejectedBy: 'HM',
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            rejectionReason: reason || ''
        });
        UI.toast('❌ Leave Reject అయ్యింది!', 'success');
        await loadLeaves();
    } catch (error) {
        console.error('Reject error:', error);
        UI.toast('Reject విఫలమైంది.', 'error');
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
