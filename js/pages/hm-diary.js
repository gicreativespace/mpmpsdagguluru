// js/pages/hm-diary.js — v12.0 (Step 4.6)
// Diary list + Approve/Reject + WhatsApp + Poster (Canvas)

let currentFilter = 'pending';
let allDiaries = [];
let currentSchoolData = null;
let waText = '';
let posterDataUrl = '';

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('dm_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const savedSize = localStorage.getItem('dm_font_size');
    if (savedSize) document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');

    const session = Auth.checkAuth('headmaster');
    if (!session) return;

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('diaryApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        addCustomBackButton();
        await loadSchoolData();
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
    backBtn.addEventListener('click', () => window.location.href = 'hm-dashboard.html');
    header.insertBefore(backBtn, header.firstChild);
}

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
}

async function loadSchoolData() {
    try {
        if (typeof authReady !== 'undefined') {
            await Promise.race([authReady, new Promise(r => setTimeout(r, 3000))]);
        }
        const doc = await db.collection('schoolInfo').doc('main').get();
        if (doc.exists) currentSchoolData = doc.data();
    } catch (e) {
        console.warn('School data error:', e);
    }
}

// =====================================================
// LOAD DIARIES
// =====================================================
async function loadDiaries() {
    const className = document.getElementById('classSelect').value;
    const container = document.getElementById('diariesList');

    if (!className) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">Class ఎంచుకోండి...</p>`;
        allDiaries = [];
        return;
    }

    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">లోడ్ అవుతోంది...</p>`;

    try {
        const snapshot = await db.collection('diary')
            .where('className', '==', className)
            .get();

        allDiaries = [];
        snapshot.forEach(doc => allDiaries.push({ id: doc.id, ...doc.data() }));
        allDiaries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        renderDiaries();
    } catch (error) {
        console.error('Load diaries error:', error);
        container.innerHTML = `<p style="color: var(--danger); text-align: center; padding: var(--space-md);">లోడ్ విఫలమైంది</p>`;
    }
}

function switchFilter(filter) {
    currentFilter = filter;
    ['pending', 'approved', 'rejected', 'all'].forEach(f => {
        const btn = document.getElementById('filter' + capitalize(f));
        if (btn) btn.className = f === filter ? 'btn btn-primary' : 'btn btn-outline';
    });
    renderDiaries();
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// =====================================================
// RENDER
// =====================================================
function renderDiaries() {
    const container = document.getElementById('diariesList');
    if (!container) return;

    let filtered = allDiaries;
    if (currentFilter === 'pending') filtered = allDiaries.filter(d => !d.isApproved && !d.isRejected);
    else if (currentFilter === 'approved') filtered = allDiaries.filter(d => d.isApproved === true);
    else if (currentFilter === 'rejected') filtered = allDiaries.filter(d => d.isRejected === true);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="card" style="text-align: center; padding: var(--space-xl);">
            <div style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);">📖</div>
            <p style="color: var(--text-muted);">Diary entries లేవు</p>
        </div>`;
        return;
    }

    container.innerHTML = filtered.map(d => renderDiaryCard(d)).join('');
}

function renderDiaryCard(d) {
    let statusClass = 'status-pending', statusText = '⏳ Pending';
    if (d.isApproved) { statusClass = 'status-approved'; statusText = '✅ Approved'; }
    else if (d.isRejected) { statusClass = 'status-rejected'; statusText = '❌ Rejected'; }

    const canAct = !d.isApproved && !d.isRejected;

    return `
        <div class="card" style="padding: var(--space-md); margin-bottom: var(--space-sm);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-sm);">
                <div style="flex: 1;">
                    <h4 style="font-size: 1rem;">📚 ${escapeHtml(d.subject || '—')}</h4>
                    <p style="font-size: 0.75rem; color: var(--text-muted);">👨‍🏫 ${escapeHtml(d.teacherName || 'Teacher')} • 📅 ${escapeHtml(d.date || '—')}</p>
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>

            ${d.classWork || d.content ? `
                <p style="font-size: 0.8rem; margin-bottom: 6px;"><strong>Class Work:</strong> ${escapeHtml(d.classWork || d.content)}</p>
            ` : ''}
            ${d.homework ? `
                <p style="font-size: 0.8rem; margin-bottom: 6px; color: var(--primary);"><strong>Home Work:</strong> ${escapeHtml(d.homework)}</p>
            ` : ''}

            ${d.isApproved ? `
                <p style="font-size: 0.7rem; color: var(--success); margin-bottom: var(--space-sm);">
                    ✅ Approved by ${escapeHtml(d.approvedBy || 'HM')}
                </p>
            ` : ''}
            ${d.isRejected ? `
                <p style="font-size: 0.7rem; color: var(--danger); margin-bottom: var(--space-sm);">
                    ❌ Rejected ${d.rejectionReason ? '— ' + escapeHtml(d.rejectionReason) : ''}
                </p>
            ` : ''}

            ${canAct ? `
                <div style="display: flex; gap: 6px; margin-bottom: var(--space-sm);">
                    <button class="btn btn-primary" onclick="approveDiary('${d.id}')" style="flex: 1; padding: 10px; font-size: 0.85rem;">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-danger" onclick="rejectDiary('${d.id}')" style="flex: 1; padding: 10px; font-size: 0.85rem;">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            ` : `
                <div style="display: flex; gap: 6px; margin-bottom: var(--space-sm);">
                    <button class="btn btn-outline" onclick="showWAModal('${d.id}')" style="flex: 1; padding: 10px; font-size: 0.8rem;">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </button>
                    <button class="btn btn-secondary" onclick="showPosterModal('${d.id}')" style="flex: 1; padding: 10px; font-size: 0.8rem;">
                        <i class="fas fa-image"></i> Poster
                    </button>
                </div>
            `}
        </div>
    `;
}

// =====================================================
// APPROVE / REJECT
// =====================================================
async function approveDiary(diaryId) {
    if (!confirm('ఈ Diary ని Approve చేయాలా?')) return;
    try {
        const hmName = currentSchoolData?.hmName || 'HM';
        await db.collection('diary').doc(diaryId).update({
            isApproved: true,
            isRejected: false,
            approvedBy: hmName,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        UI.toast('✅ Diary Approve అయ్యింది!', 'success');
        await loadDiaries();
    } catch (e) {
        console.error(e);
        UI.toast('❌ Approve విఫలమైంది.', 'error');
    }
}

async function rejectDiary(diaryId) {
    const reason = prompt('Reject కారణం (optional):');
    if (reason === null) return;
    try {
        const hmName = currentSchoolData?.hmName || 'HM';
        await db.collection('diary').doc(diaryId).update({
            isApproved: false,
            isRejected: true,
            rejectedBy: hmName,
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            rejectionReason: reason || ''
        });
        UI.toast('❌ Diary Reject అయ్యింది.', 'success');
        await loadDiaries();
    } catch (e) {
        console.error(e);
        UI.toast('Reject విఫలమైంది.', 'error');
    }
}

// =====================================================
// WHATSAPP FORMAT
// =====================================================
function showWAModal(diaryId) {
    const d = allDiaries.find(x => x.id === diaryId);
    if (!d) return;

    const schoolName = currentSchoolData?.schoolName || 'MPMP School';
    const hmName = currentSchoolData?.hmName || 'HM';

    waText = `🏫 *${schoolName}*

📚 *${d.className} | ${d.subject}*
📅 Date: ${d.date}

✍️ *Class Work:*
${d.classWork || d.content || '—'}

🏠 *Home Work:*
${d.homework || '—'}

👨‍🏫 Teacher: ${d.teacherName || '—'}
✅ Approved by: HM ${hmName}

_— Digital Manabadi_`;

    document.getElementById('waMessage').textContent = waText;
    document.getElementById('waModal').classList.add('active');
}

function closeWAModal() {
    document.getElementById('waModal').classList.remove('active');
}

function shareWA() {
    const url = 'https://wa.me/?text=' + encodeURIComponent(waText);
    window.open(url, '_blank');
}

// =====================================================
// POSTER (Canvas)
// =====================================================
function showPosterModal(diaryId) {
    const d = allDiaries.find(x => x.id === diaryId);
    if (!d) return;

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

    // BG white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Green header
    ctx.fillStyle = '#1B5E20';
    ctx.fillRect(0, 0, W, 220);

    // School name (header)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 52px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(schoolName, W / 2, 90);

    // Address
    ctx.font = '28px Inter, sans-serif';
    ctx.fillText(`${village} • ${mandal} • ${district}`, W / 2, 140);

    // Gold accent line
    ctx.fillStyle = '#FFC107';
    ctx.fillRect(0, 215, W, 10);

    // Class/Subject/Date
    ctx.fillStyle = '#1B5E20';
    ctx.font = 'bold 42px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${d.className}`, 60, 300);

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

    // Teacher name (bottom left)
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

    // HM Rubber Seal (bottom right)
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

    // Outer circle
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(198, 40, 40, 0.85)';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner dashed circle
    ctx.beginPath();
    ctx.arc(0, 0, R - 14, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(198, 40, 40, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
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
    if (!posterDataUrl) return;
    const a = document.createElement('a');
    a.href = posterDataUrl;
    a.download = `diary-poster-${Date.now()}.png`;
    a.click();
    UI.toast('✅ Poster download అవుతోంది!', 'success');
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
