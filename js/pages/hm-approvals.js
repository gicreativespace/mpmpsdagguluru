// js/pages/hm-approvals.js

let currentTab = 'pending'; // 'pending' | 'approved'
let allDiaries = [];
let teacherMap = {}; // teacherId → teacher name

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

    const session = Auth.checkAuth('headmaster');
    if (!session) return;

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('approvalsApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        await loadTeachersMap();
        await loadDiaries();
    }, 1200);

    bindEvents();
});

// =====================================================
// LOAD TEACHERS MAP (id → name)
// =====================================================
async function loadTeachersMap() {
    try {
        if (typeof authReady !== 'undefined') {
            await Promise.race([
                authReady,
                new Promise(resolve => setTimeout(resolve, 3000))
            ]);
        }

        const snapshot = await db.collection('users').get();
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.role === 'teacher') {
                teacherMap[doc.id] = data.name || 'Teacher';
            }
        });
    } catch (error) {
        console.error('Load teachers error:', error);
    }
}

// =====================================================
// LOAD DIARIES
// =====================================================
async function loadDiaries() {
    const listEl = document.getElementById('diaryList');
    if (listEl) {
        listEl.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">లోడ్ అవుతోంది...</p>`;
    }

    try {
        const snapshot = await db.collection('diary').get();
        allDiaries = [];
        snapshot.forEach(doc => {
            allDiaries.push({ id: doc.id, ...doc.data() });
        });

        // Sort by date descending
        allDiaries.sort((a, b) => {
            const da = a.date || '';
            const db_ = b.date || '';
            return db_.localeCompare(da);
        });

        renderStats();
        renderDiaries();
    } catch (error) {
        console.error('Load diaries error:', error);
        if (listEl) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
                    <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);"></i>
                    <p>Diary entries లోడ్ అవ్వలేదు</p>
                    <p style="font-size: 0.8rem; margin-top: 4px;">Teachers diary రాసిన తర్వాత ఇక్కడ కనిపిస్తాయి</p>
                </div>
            `;
        }
    }
}

// =====================================================
// STATS
// =====================================================
function renderStats() {
    const pending = allDiaries.filter(d => !d.isApproved).length;
    const approved = allDiaries.filter(d => d.isApproved).length;

    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('approvedCount').textContent = approved;
}

// =====================================================
// TAB SWITCH
// =====================================================
function switchTab(tab) {
    currentTab = tab;

    const tabPending = document.getElementById('tabPending');
    const tabApproved = document.getElementById('tabApproved');

    if (tab === 'pending') {
        tabPending.className = 'btn btn-primary';
        tabApproved.className = 'btn btn-outline';
    } else {
        tabPending.className = 'btn btn-outline';
        tabApproved.className = 'btn btn-primary';
    }

    renderDiaries();
}

// =====================================================
// RENDER DIARIES
// =====================================================
function renderDiaries() {
    const container = document.getElementById('diaryList');
    if (!container) return;

    const filtered = allDiaries.filter(d =>
        currentTab === 'pending' ? !d.isApproved : d.isApproved
    );

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
                <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);"></i>
                <p>${currentTab === 'pending' ? 'Pending diaries లేవు' : 'Approved diaries లేవు'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(diary => {
        const teacherName = teacherMap[diary.teacherId] || diary.teacherName || 'Teacher';
        const isApproved = diary.isApproved === true;

        return `
            <div class="card" style="padding: var(--space-md); margin-bottom: var(--space-sm); border-left: 4px solid ${isApproved ? 'var(--success)' : '#F9A825'};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-sm);">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: var(--space-xs); margin-bottom: 4px; flex-wrap: wrap;">
                            <span style="font-size: 0.7rem; background: ${isApproved ? 'var(--success)' : '#F9A825'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-weight: 600;">
                                ${isApproved ? '✅ Approved' : '⏳ Pending'}
                            </span>
                            ${diary.className ? `<span style="font-size: 0.7rem; background: var(--primary); color: #fff; padding: 2px 8px; border-radius: 12px; font-weight: 600;">${escapeHtml(diary.className)}</span>` : ''}
                        </div>
                        <h4 style="font-size: 1rem; margin-bottom: 4px;">👨‍🏫 ${escapeHtml(teacherName)}</h4>
                        <p style="font-size: 0.75rem; color: var(--text-muted);">📅 ${escapeHtml(diary.date || '—')}</p>
                    </div>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-main); line-height: 1.6; margin-bottom: var(--space-sm); white-space: pre-wrap;">${escapeHtml(diary.content || '—')}</p>
                ${!isApproved ? `
                    <div style="display: flex; gap: var(--space-sm);">
                        <button class="btn btn-primary" onclick="approveDiary('${diary.id}')" style="flex: 1; padding: 10px; font-size: 0.85rem;">
                            <i class="fas fa-check" style="margin-right: 6px;"></i> Approve
                        </button>
                        <button class="btn btn-outline" onclick="rejectDiary('${diary.id}')" style="flex: 1; padding: 10px; font-size: 0.85rem;">
                            <i class="fas fa-times" style="margin-right: 6px;"></i> Reject
                        </button>
                    </div>
                ` : `
                    <p style="font-size: 0.75rem; color: var(--success); font-weight: 600;">
                        <i class="fas fa-check-circle"></i> Approved ${diary.approvedAt ? '(' + formatDate(diary.approvedAt) + ')' : ''}
                    </p>
                `}
            </div>
        `;
    }).join('');
}

// =====================================================
// APPROVE DIARY
// =====================================================
async function approveDiary(diaryId) {
    try {
        const session = JSON.parse(localStorage.getItem('dm_session') || '{}');
        await db.collection('diary').doc(diaryId).update({
            isApproved: true,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedBy: session.name || 'HM'
        });

        // Update local cache
        const d = allDiaries.find(x => x.id === diaryId);
        if (d) d.isApproved = true;

        UI.toast('✅ Diary అప్రూవ్ అయ్యింది!', 'success');
        renderStats();
        renderDiaries();
    } catch (error) {
        console.error('Approve error:', error);
        UI.toast('❌ అప్రూవ్ విఫలమైంది.', 'error');
    }
}

// =====================================================
// REJECT DIARY (Delete or mark as rejected)
// =====================================================
async function rejectDiary(diaryId) {
    if (!confirm('ఈ diary entry ని తీసేయాలా? (Teacher కి తెలియదు)')) return;

    try {
        await db.collection('diary').doc(diaryId).delete();

        // Remove from local cache
        allDiaries = allDiaries.filter(x => x.id !== diaryId);

        UI.toast('🗑️ Diary entry తీసేయబడింది.', 'success');
        renderStats();
        renderDiaries();
    } catch (error) {
        console.error('Reject error:', error);
        UI.toast('❌ తీసేయడం విఫలమైంది.', 'error');
    }
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

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'hm-dashboard.html';
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('లాగౌట్ చేయాలా?')) Auth.logout();
        });
    }
}

// =====================================================
// HELPERS
// =====================================================
function formatDate(timestamp) {
    if (!timestamp) return '';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    } catch (e) {
        return '';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
