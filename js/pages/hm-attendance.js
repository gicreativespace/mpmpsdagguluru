// js/pages/hm-attendance.js — v12.0 (Step 5.4)
// HM approve teacher-submitted attendance (C2 format)

let currentClassName = '';
let currentMonthDoc = null;

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('dm_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const savedSize = localStorage.getItem('dm_font_size');
    if (savedSize) document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');

    const session = Auth.checkAuth('headmaster');
    if (!session) return;

    setTimeout(() => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('attApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        addCustomBackButton();
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

async function loadAttendance() {
    currentClassName = document.getElementById('classSelect').value;
    const container = document.getElementById('attList');

    if (!currentClassName) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">Class ఎంచుకోండి...</p>`;
        return;
    }

    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">లోడ్ అవుతోంది...</p>`;

    try {
        const today = new Date();
        const eduYear = getEduYear();
        const month = getMonthName(today);

        const docRef = db.collection('attendance').doc(eduYear).collection(currentClassName).doc(month);
        const doc = await docRef.get();

        if (!doc.exists) {
            container.innerHTML = `<div class="card" style="text-align: center; padding: var(--space-xl);">
                <div style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);">📋</div>
                <p style="color: var(--text-muted);">ఈ నెల ${currentClassName} attendance ఇంకా submit చేయలేదు</p>
            </div>`;
            return;
        }

        currentMonthDoc = { id: doc.id, ref: docRef, data: doc.data() };

        const days = doc.data().days || {};
        const dateKeys = Object.keys(days).sort().reverse();

        if (dateKeys.length === 0) {
            container.innerHTML = `<div class="card" style="text-align: center; padding: var(--space-xl);">
                <p style="color: var(--text-muted);">Attendance records లేవు</p>
            </div>`;
            return;
        }

        // Load students for names
        const classSnap = await db.collection('classrooms').where('className', '==', currentClassName).limit(1).get();
        let studentsMap = {};
        if (!classSnap.empty) {
            const studentsSnap = await db.collection('classrooms').doc(classSnap.docs[0].id).collection('students').get();
            studentsSnap.forEach(s => { studentsMap[s.id] = s.data(); });
        }

        const isApproved = doc.data().approved === true;

        let html = `
            <div class="card" style="background: ${isApproved ? 'var(--success)' : '#F9A825'}; color: #fff; border: none; margin-bottom: var(--space-sm); padding: var(--space-sm) var(--space-md);">
                <p style="margin: 0; font-size: 0.85rem; font-weight: 600; text-align: center;">
                    ${isApproved ? '✅ Approved' : '⏳ Pending HM Approval'}
                </p>
            </div>`;

        dateKeys.forEach(dateStr => {
            const dayData = days[dateStr];
            const entries = Object.entries(dayData);
            let present = 0, absent = 0, leave = 0;
            entries.forEach(([_, d]) => {
                if (d.status === 'present') present++;
                else if (d.status === 'absent') absent++;
                else if (d.status === 'leave') leave++;
            });

            html += `
            <div class="card" style="padding: var(--space-md); margin-bottom: var(--space-sm);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm);">
                    <h4 style="font-size: 0.95rem;">📅 ${escapeHtml(dateStr)}</h4>
                    <div style="font-size: 0.7rem;">
                        <span style="color: var(--success); font-weight: 700;">✅ ${present}</span> |
                        <span style="color: var(--danger); font-weight: 700;">❌ ${absent}</span> |
                        <span style="color: #E65100; font-weight: 700;">📅 ${leave}</span>
                    </div>
                </div>
                <div style="font-size: 0.8rem; line-height: 1.8;">
                    ${entries.map(([sid, d]) => {
                        const s = studentsMap[sid] || {};
                        const icon = d.status === 'present' ? '✅' : d.status === 'absent' ? '❌' : '📅';
                        return `<div style="display: flex; justify-content: space-between; padding: 2px 0;">
                            <span>${escapeHtml(s.rollNumber || '')} ${escapeHtml(s.name || sid)}</span>
                            <span>${icon} ${d.status}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        });

        if (!isApproved) {
            html += `
            <button class="btn btn-primary btn-block" onclick="approveMonth()" style="padding: 14px; margin-top: var(--space-md);">
                <i class="fas fa-check-circle" style="margin-right: 6px;"></i> Approve All (${currentClassName} — ${month})
            </button>`;
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('Load attendance error:', error);
        container.innerHTML = `<p style="color: var(--danger); text-align: center; padding: var(--space-md);">లోడ్ విఫలమైంది</p>`;
    }
}

async function approveMonth() {
    if (!currentMonthDoc) return;
    if (!confirm(`${currentClassName} — ${currentMonthDoc.data.month} attendance approve చేయాలా?`)) return;

    try {
        const session = JSON.parse(localStorage.getItem('dm_session') || '{}');
        await currentMonthDoc.ref.update({
            approved: true,
            approvedBy: session.name || 'HM',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        UI.toast('✅ Attendance Approve అయ్యింది!', 'success');
        await loadAttendance();
    } catch (error) {
        console.error('Approve error:', error);
        UI.toast('❌ Approve విఫలమైంది.', 'error');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
