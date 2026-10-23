// js/pages/hm-notice.js — v12.0 (Step 4.4)
// Changes: Custom back, Home, Logout confirm

let currentScreen = 'list';
let editingNoticeId = null;
let allNotices = [];

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
    backBtn.setAttribute('aria-label', 'Back');
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
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            if (typeof UI !== 'undefined') UI.toggleTheme();
            themeBtn.textContent = document.body.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (typeof UI !== 'undefined' && UI.confirmLogout) UI.confirmLogout();
            else if (confirm('లాగౌట్ చేయాలా?')) Auth.logout();
        });
    }

    const noticeForm = document.getElementById('noticeForm');
    if (noticeForm) {
        noticeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSaveNotice();
        });
    }
}

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
        console.error('Load notices error:', error);
        try {
            const snapshot = await db.collection('noticeBoard').get();
            allNotices = [];
            snapshot.forEach(doc => allNotices.push({ id: doc.id, ...doc.data() }));
            renderNotices();
        } catch (e2) {
            console.error('Retry error:', e2);
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
            <p style="font-size: 0.85rem; margin-top: 4px;">కొత్త నోటీస్ యాడ్ చేయండి</p>
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
                        <div style="display: flex; align-items: center; gap: var(--space-xs); margin-bottom: 4px;">
                            <span style="font-size: 1rem;">${categoryInfo.icon}</span>
                            <span style="font-size: 0.7rem; background: ${categoryInfo.color}; color: #fff; padding: 2px 8px; border-radius: 12px; font-weight: 600;">${categoryInfo.label}</span>
                            ${notice.priority === 'urgent' ? '<span style="font-size: 0.7rem; color: var(--danger); font-weight: 700;">🔴 URGENT</span>' : ''}
                            ${notice.priority === 'important' ? '<span style="font-size: 0.7rem; color: #F9A825; font-weight: 700;">🟡 IMPORTANT</span>' : ''}
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
                <p style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.7;">
                    <i class="fas fa-clock"></i> ${dateStr}
                </p>
            </div>
        `;
    }).join('');
}

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

    btn.disabled = true;
    btn.innerHTML = 'సేవ్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        const noticeData = {
            title, content, category, priority,
            postedBy: 'HM',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editingNoticeId) {
            await db.collection('noticeBoard').doc(editingNoticeId).update(noticeData);
            UI.toast('✅ నోటీస్ అప్‌డేట్ అయ్యింది!', 'success');
        } else {
            noticeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('noticeBoard').add(noticeData);
            UI.toast('✅ నోటీస్ విజయవంతంగా పోస్ట్ అయ్యింది!', 'success');
        }

        await loadNotices();
        showScreen('list');
    } catch (error) {
        console.error('Save notice error:', error);
        showFormError(errorEl, 'సేవ్ విఫలమైంది.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save" style="margin-right: 8px;"></i> Save Notice';
    }
}

async function deleteNotice(noticeId, noticeTitle) {
    if (!confirm(`⚠️ "${noticeTitle}" నోటీస్ డిలీట్ చేయాలా?`)) return;
    try {
        await db.collection('noticeBoard').doc(noticeId).delete();
        UI.toast('🗑️ నోటీస్ డిలీట్ అయ్యింది!', 'success');
        await loadNotices();
    } catch (error) {
        console.error('Delete notice error:', error);
        UI.toast('❌ డిలీట్ విఫలమైంది.', 'error');
    }
}

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
    const map = {
        normal: { color: '#388E3C' },
        important: { color: '#F9A825' },
        urgent: { color: '#D32F2F' }
    };
    return map[priority] || map.normal;
}

function formatDate(timestamp) {
    if (!timestamp) return '—';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        return `${d}/${m}/${y} ${h}:${min}`;
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
