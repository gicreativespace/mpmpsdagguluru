// js/pages/hm-notice.js — v12.0 (Step 5.6 — Approve Teacher Announcements)
let currentScreen = 'list';
let editingNoticeId = null;
let allNotices = [];
let currentTab = 'notices';
let pendingAnnouncements = [];

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('dm_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const savedSize = localStorage.getItem('dm_font_size');
    if (savedSize) document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');

    const session = Auth.checkAuth('headmaster');
    if (!session) return;

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('noticeApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        addCustomBackButton();
        await loadNotices();
        await loadPendingAnnouncements();
        showScreen('list');
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
    backBtn.addEventListener('click', () => {
        if (currentScreen === 'form') showScreen('list');
        else window.location.href = 'hm-dashboard.html';
    });
    header.insertBefore(backBtn, header.firstChild);
}

function showScreen(name) {
    currentScreen = name;
    ['list', 'form'].forEach(s => {
        const el = document.getElementById('screen' + capitalize(s));
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('screen' + capitalize(name));
    if (target) target.classList.remove('hidden');

    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) {
        if (name === 'list') homeBtn.classList.remove('hidden');
        else homeBtn.classList.add('hidden');
    }

    const title = document.getElementById('pageTitle');
    if (title) title.textContent = name === 'list' ? 'Notice Board' : 'Add Notice';
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
        else if (confirm('లాగౌట్ చేయాలా?')) Auth.logout();
    });
    const noticeForm = document.getElementById('noticeForm');
    if (noticeForm) noticeForm.addEventListener('submit', e => { e.preventDefault(); handleSaveNotice(); });
}

// =====================================================
// TAB SWITCH (NEW)
// =====================================================
function switchNoticeTab(tab) {
    currentTab = tab;
    const noticesContent = document.getElementById('noticesTabContent');
    const pendingContent = document.getElementById('pendingTabContent');
    const tabNotices = document.getElementById('tabNotices');
    const tabPending = document.getElementById('tabPending');

    if (tab === 'notices') {
        noticesContent.style.display = 'block';
        pendingContent.style.display = 'none';
        tabNotices.className = 'btn btn-primary';
        tabPending.className = 'btn btn-outline';
    } else {
        noticesContent.style.display = 'none';
        pendingContent.style.display = 'block';
        tabNotices.className = 'btn btn-outline';
        tabPending.className = 'btn btn-primary';
    }
}

// =====================================================
// LOAD NOTICES (existing)
// =====================================================
async function loadNotices() {
    try {
        if (typeof authReady !== 'undefined') {
            await Promise.race([authReady, new Promise(r => setTimeout(r, 3000))]);
        }
        const snapshot = await db.collection('noticeBoard').orderBy('createdAt', 'desc').get();
        allNotices = [];
        snapshot.forEach(doc => allNotices.push({ id: doc.id, ...doc.data() }));
        renderNotices();
    } catch (error) {
        console.error('Load notices:', error);
        try {
            const snapshot = await db.collection('noticeBoard').get();
            allNotices = [];
            snapshot.forEach(doc => allNotices.push({ id: doc.id, ...doc.data() }));
            renderNotices();
        } catch (e2) {
            console.error('Retry:', e2);
            UI.toast('నోటీసులు లోడ్ అవ్వలేదు.', 'error');
        }
    }
}

function renderNotices() {
    const container = document.getElementById('noticesList');
    if (!container) return;

    if (allNotices.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
            <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);"></i>
            <p>ఇంకా నోటీసులు లేవు</p>
        </div>`;
        return;
    }

    container.innerHTML = allNotices.map(notice => {
        const categoryInfo = getCategoryInfo(notice.category);
        const priorityInfo = getPriorityInfo(notice.priority);
        const dateStr = formatDate(notice.createdAt);
        return `
            <div class="card" style="padding: var(--space-md); margin-bottom: var(--space-sm); border-left: 4px solid ${priorityInfo.color};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-sm);">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: var(--space-xs); margin-bottom: 4px; flex-wrap: wrap;">
                            <span style="font-size: 1rem;">${categoryInfo.icon}</span>
                            <span style="font-size: 0.7rem; background: ${categoryInfo.color}; color: #fff; padding: 2px 8px; border-radius: 12px; font-weight: 600;">${categoryInfo.label}</span>
                            ${notice.priority === 'urgent' ? '<span style="font-size: 0.7rem; color: var(--danger); font-weight: 700;">🔴 URGENT</span>' : ''}
                            ${notice.priority === 'important' ? '<span style="font-size: 0.7rem; color: #F9A825; font-weight: 700;">🟡 IMPORTANT</span>' : ''}
                            ${notice.postedBy === 'Teacher' || notice.source === 'teacher' ? '<span style="font-size: 0.7rem; background: var(--secondary); color: #212121; padding: 2px 8px; border-radius: 12px; font-weight: 600;">👨‍🏫 Teacher</span>' : ''}
                        </div>
                        <h4 style="font-size: 1rem; margin-bottom: 4px;">${escapeHtml(notice.title || '—')}</h4>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="icon-btn" onclick="editNotice('${notice.id}')" title="Edit" style="width: 32px; height: 32px; background: var(--primary); color: #fff;">
                            <i class="fas fa-edit" style="font-size: 0.8rem;"></i>
                        </button>
                        <button class="icon-btn" onclick="deleteNotice('${notice.id}', '${escapeHtml(notice.title || '')}')" title="Delete" style="width: 32px; height: 32px; background: var(--danger); color: #fff;">
                            <i class="fas fa-trash" style="font-size: 0.8rem;"></i>
                        </button>
                    </div>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: var(--space-sm); white-space: pre-wrap;">${escapeHtml(notice.content || '')}</p>
                <p style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.7;"><i class="fas fa-clock"></i> ${dateStr}</p>
            </div>`;
    }).join('');
}

// =====================================================
// PENDING ANNOUNCEMENTS (NEW — Step 5.6)
// =====================================================
async function loadPendingAnnouncements() {
    const container = document.getElementById('pendingAnnouncementsList');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">లోడ్...</p>`;

    try {
        const snap = await db.collection('announcements').where('status', '==', 'pending').get();
        pendingAnnouncements = [];
        snap.forEach(doc => pendingAnnouncements.push({ id: doc.id, ...doc.data() }));
        pendingAnnouncements.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });

        // Badge update
        const badge = document.getElementById('pendingBadge');
        if (badge) {
            if (pendingAnnouncements.length > 0) {
                badge.textContent = pendingAnnouncements.length;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }

        renderPendingAnnouncements();
    } catch (e) {
        console.error('Load pending:', e);
        container.innerHTML = `<p style="color: var(--danger); text-align: center;">లోడ్ విఫలం</p>`;
    }
}

function renderPendingAnnouncements() {
    const container = document.getElementById('pendingAnnouncementsList');
    if (!container) return;

    if (pendingAnnouncements.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
            <div style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);">✅</div>
            <p>Pending announcements లేవు</p>
        </div>`;
        return;
    }

    container.innerHTML = pendingAnnouncements.map(a => {
        const typeIcon = a.type === 'notes' ? '📝' : '📢';
        const typeLabel = a.type === 'notes' ? 'Notes' : 'Announcement';
        const dateStr = formatDate(a.createdAt);

        return `
        <div class="card" style="padding: var(--space-md); margin-bottom: var(--space-sm); border-left: 4px solid #F9A825;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-sm);">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: var(--space-xs); margin-bottom: 4px; flex-wrap: wrap;">
                        <span style="font-size: 0.7rem; background: var(--secondary); color: #212121; padding: 2px 8px; border-radius: 12px; font-weight: 600;">${typeIcon} ${typeLabel}</span>
                        <span class="status-badge status-pending">⏳ Pending</span>
                    </div>
                    <h4 style="font-size: 0.95rem; margin-bottom: 4px;">${escapeHtml(a.title || '—')}</h4>
                    <p style="font-size: 0.75rem; color: var(--text-muted);">👨‍🏫 ${escapeHtml(a.teacherName || 'Teacher')} • 📅 ${dateStr}</p>
                </div>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-main); line-height: 1.5; padding: 8px; background: var(--bg-color); border-radius: var(--radius-sm); margin-bottom: var(--space-sm); white-space: pre-wrap;">${escapeHtml(a.message || '')}</p>
            <div style="display: flex; gap: var(--space-sm);">
                <button class="btn btn-primary" onclick="approveAnnouncement('${a.id}')" style="flex: 1; padding: 10px; font-size: 0.85rem;">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn btn-danger" onclick="rejectAnnouncement('${a.id}')" style="flex: 1; padding: 10px; font-size: 0.85rem;">
                    <i class="fas fa-times"></i> Reject
                </button>
            </div>
        </div>`;
    }).join('');
}

async function approveAnnouncement(id) {
    if (!confirm('Approve చేసి Notice Board లో add చేయాలా?')) return;

    try {
        const aDoc = await db.collection('announcements').doc(id).get();
        if (!aDoc.exists) { UI.toast('Announcement కనుగొనబడలేదు.', 'error'); return; }
        const a = aDoc.data();

        // Add to noticeBoard
        await db.collection('noticeBoard').add({
            title: a.title || '',
            content: a.message || '',
            category: 'general',
            priority: 'normal',
            postedBy: 'Teacher',
            source: 'teacher',
            teacherName: a.teacherName || '',
            teacherId: a.teacherId || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update status
        await db.collection('announcements').doc(id).update({
            status: 'approved',
            approvedBy: 'HM',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        UI.toast('✅ Approved & Notice Board లో add అయ్యింది!', 'success');
        await loadNotices();
        await loadPendingAnnouncements();
    } catch (e) {
        console.error('Approve:', e);
        UI.toast('❌ Approve విఫలం.', 'error');
    }
}

async function rejectAnnouncement(id) {
    const reason = prompt('Reject కారణం (optional):');
    if (reason === null) return;

    try {
        await db.collection('announcements').doc(id).update({
            status: 'rejected',
            rejectedBy: 'HM',
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            rejectionReason: reason || ''
        });
        UI.toast('❌ Reject అయ్యింది.', 'success');
        await loadPendingAnnouncements();
    } catch (e) {
        console.error('Reject:', e);
        UI.toast('Reject విఫలం.', 'error');
    }
}

// =====================================================
// NOTICE CRUD (existing)
// =====================================================
function showAddScreen() {
    editingNoticeId = null;
    document.getElementById('formTitle').textContent = '➕ కొత్త నోటీస్';
    document.getElementById('formDesc').textContent = 'నోటీస్ వివరాలు నింపండి';
    document.getElementById('noticeForm').reset();
    document.getElementById('noticeError').classList.add('hidden');
    showScreen('form');
}

function editNotice(noticeId) {
    const notice = allNotices.find(n => n.id === noticeId);
    if (!notice) return;
    editingNoticeId = noticeId;
    document.getElementById('formTitle').textContent = '✏️ నోటీస్ ఎడిట్';
    document.getElementById('formDesc').textContent = 'వివరాలు మార్చండి';
    document.getElementById('noticeTitle').value = notice.title || '';
    document.getElementById('noticeContent').value = notice.content || '';
    document.getElementById('noticeCategory').value = notice.category || 'general';
    document.getElementById('noticePriority').value = notice.priority || 'normal';
    document.getElementById('noticeError').classList.add('hidden');
    showScreen('form');
}

async function handleSaveNotice() {
    const title = document.getElementById('noticeTitle').value.trim();
    const content = document.getElementById('noticeContent').value.trim();
    const category = document.getElementById('noticeCategory').value;
    const priority = document.getElementById('noticePriority').value;
    const errorEl = document.getElementById('noticeError');
    const btn = document.getElementById('noticeSubmitBtn');

    if (!title) return showFormError(errorEl, 'శీర్షిక నింపండి.');
    if (!content) return showFormError(errorEl, 'వివరాలు నింపండి.');

    btn.disabled = true; btn.innerHTML = 'సేవ్...'; hideFormError(errorEl);

    try {
        const noticeData = {
            title, content, category, priority,
            postedBy: 'HM',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (editingNoticeId) {
            await db.collection('noticeBoard').doc(editingNoticeId).update(noticeData);
            UI.toast('✅ నోటీస్ అప్‌డేట్!', 'success');
        } else {
            noticeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('noticeBoard').add(noticeData);
            UI.toast('✅ నోటీస్ పోస్ట్!', 'success');
        }
        await loadNotices();
        showScreen('list');
    } catch (error) {
        console.error('Save notice:', error);
        showFormError(errorEl, 'సేవ్ విఫలం.');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Notice';
    }
}

async function deleteNotice(noticeId, noticeTitle) {
    if (!confirm(`⚠️ "${noticeTitle}" డిలీట్ చేయాలా?`)) return;
    try {
        await db.collection('noticeBoard').doc(noticeId).delete();
        UI.toast('🗑️ డిలీట్ అయ్యింది!', 'success');
        await loadNotices();
    } catch (error) {
        console.error('Delete:', error);
        UI.toast('❌ డిలీట్ విఫలం.', 'error');
    }
}

// =====================================================
// HELPERS
// =====================================================
function getCategoryInfo(category) {
    const map = {
        general: { icon: '📌', label: 'General', color: '#1565C0' },
        exam: { icon: '📝', label: 'Exam', color: '#6A1B9A' },
        holiday: { icon: '🎉', label: 'Holiday', color: '#2E7D32' },
        meeting: { icon: '👥', label: 'Meeting', color: '#F57C00' },
        emergency: { icon: '⚠️', label: 'Emergency', color: '#C62828' }
    };
    return map[category] || map.general;
}

function getPriorityInfo(priority) {
    const map = { normal: { color: '#388E3C' }, important: { color: '#F9A825' }, urgent: { color: '#D32F2F' } };
    return map[priority] || map.normal;
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
