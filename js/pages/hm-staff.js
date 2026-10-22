// js/pages/hm-staff.js

let currentScreen = 'list';
let currentStaffType = 'teacher';
let editingStaffId = null;
let allStaff = [];

// Class & Subject మాస్టర్ లిస్ట్
const CLASSES = {
    'Class 1': ['Telugu', 'English', 'Maths'],
    'Class 2': ['Telugu', 'English', 'Maths'],
    'Class 3': ['Telugu', 'English', 'Maths', 'EVS'],
    'Class 4': ['Telugu', 'English', 'Maths', 'EVS'],
    'Class 5': ['Telugu', 'English', 'Maths', 'EVS']
};

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
        const app = document.getElementById('staffApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        await loadStaffList();
        showScreen('list');
    }, 1200);

    bindEvents();
});

// =====================================================
// SCREEN SWITCHER
// =====================================================
function showScreen(name) {
    currentScreen = name;
    ['list', 'form'].forEach(s => {
        const el = document.getElementById('screen' + capitalize(s));
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('screen' + capitalize(name));
    if (target) target.classList.remove('hidden');

    const title = document.getElementById('pageTitle');
    if (title) {
        title.textContent = name === 'list' ? 'Staff Management' : 'Add Staff';
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
            const t = document.body.getAttribute('data-theme');
            themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('లాగౌట్ చేయాలా?')) Auth.logout();
        });
    }

    const phoneInput = document.getElementById('staffPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', () => {
            phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
        });
    }

    const dobInput = document.getElementById('staffDob');
    if (dobInput) {
        dobInput.addEventListener('input', () => {
            dobInput.value = dobInput.value.replace(/\D/g, '').slice(0, 6);
        });
    }

    const staffForm = document.getElementById('staffForm');
    if (staffForm) {
        staffForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSaveStaff();
        });
    }
}

// =====================================================
// LOAD STAFF LIST
// =====================================================
async function loadStaffList() {
    try {
        if (typeof authReady !== 'undefined') {
            await Promise.race([
                authReady,
                new Promise(resolve => setTimeout(resolve, 3000))
            ]);
        }

        const snapshot = await db.collection('users').get();
        allStaff = [];
        snapshot.forEach(doc => {
            allStaff.push({ id: doc.id, ...doc.data() });
        });

        renderStaffList();
    } catch (error) {
        console.error('Load staff error:', error);
        UI.toast('Staff list లోడ్ విఫలమైంది.', 'error');
    }
}

// =====================================================
// RENDER STAFF LIST
// =====================================================
function renderStaffList() {
    const teachers = allStaff.filter(s => s.role === 'teacher');
    const cooks = allStaff.filter(s => s.role === 'cook');

    renderStaffGroup('teachersList', teachers, 'teacher');
    renderStaffGroup('cooksList', cooks, 'cook');
}

function renderStaffGroup(containerId, list, role) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-md); font-style: italic;">ఇంకా ${role === 'teacher' ? 'Teachers' : 'Cooks'} లేరు</p>`;
        return;
    }

    container.innerHTML = list.map(staff => {
        const assignmentsText = staff.assignments && staff.assignments.length > 0
            ? staff.assignments.map(a => `${a.className} - ${a.subject}`).join(', ')
            : '—';

        return `
        <div class="card" style="padding: var(--space-md); margin-bottom: var(--space-sm); border-left: 4px solid ${staff.isActive ? 'var(--success)' : 'var(--danger)'};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                    <h4 style="font-size: 1rem; margin-bottom: 4px;">${escapeHtml(staff.name || '—')}</h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 2px;">
                        <i class="fas fa-phone"></i> ${escapeHtml(staff.phone || '—')} (Login ID)
                    </p>
                    <p style="font-size: 0.75rem; color: var(--primary); font-weight: 600;">
                        🔑 PIN: ${escapeHtml(staff.masterPin || '—')}
                    </p>
                    ${role === 'teacher' ? `<p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">📚 ${escapeHtml(assignmentsText)}</p>` : ''}
                    <p style="font-size: 0.7rem; color: ${staff.isActive ? 'var(--success)' : 'var(--danger)'}; margin-top: 4px;">
                        ${staff.isActive ? '✅ Active' : '🔒 Inactive'}
                    </p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <button class="icon-btn" onclick="editStaff('${staff.id}')" title="Edit" style="width: 36px; height: 36px; background: var(--primary); color: #fff;">
                        <i class="fas fa-edit" style="font-size: 0.9rem;"></i>
                    </button>
                    <button class="icon-btn" onclick="toggleStaffStatus('${staff.id}', ${staff.isActive})" title="${staff.isActive ? 'Disable' : 'Enable'}" style="width: 36px; height: 36px; background: ${staff.isActive ? '#F57C00' : 'var(--success)'}; color: #fff;">
                        <i class="fas ${staff.isActive ? 'fa-lock' : 'fa-unlock'}" style="font-size: 0.9rem;"></i>
                    </button>
                    <button class="icon-btn" onclick="deleteStaff('${staff.id}', '${escapeHtml(staff.name || '')}')" title="Delete" style="width: 36px; height: 36px; background: var(--danger); color: #fff;">
                        <i class="fas fa-trash" style="font-size: 0.9rem;"></i>
                    </button>
                </div>
            </div>
        </div>
    `}).join('');
}

// =====================================================
// TOGGLE ACTIVE/INACTIVE (Disable/Enable)
// =====================================================
async function toggleStaffStatus(staffId, currentStatus) {
    const action = currentStatus ? 'Disable' : 'Enable';
    if (!confirm(`ఈ స్టాఫ్ ని ${action} చేయాలా?`)) return;

    try {
        await db.collection('users').doc(staffId).update({
            isActive: !currentStatus
        });
        UI.toast(`✅ స్టాఫ్ ${action} అయ్యారు!`, 'success');
        await loadStaffList();
    } catch (error) {
        console.error('Toggle status error:', error);
        UI.toast('❌ మార్పు విఫలమైంది.', 'error');
    }
}

// =====================================================
// ADD STAFF SCREEN
// =====================================================
function showAddScreen(type) {
    currentStaffType = type;
    editingStaffId = null;

    document.getElementById('formTitle').textContent = `➕ Add ${type === 'teacher' ? 'Teacher' : 'Cook'}`;
    document.getElementById('formDesc').textContent = `${type === 'teacher' ? 'Teacher' : 'Cook'} వివరాలు నింపండి`;

    document.getElementById('staffForm').reset();
    document.getElementById('staffError').classList.add('hidden');

    const assignmentsSection = document.getElementById('teacherAssignmentsSection');
    if (assignmentsSection) {
        if (type === 'teacher') {
            assignmentsSection.style.display = 'block';
            renderAssignmentCheckboxes();
        } else {
            assignmentsSection.style.display = 'none';
        }
    }

    showScreen('form');
}

// =====================================================
// RENDER CLASS & SUBJECT CHECKBOXES
// =====================================================
function renderAssignmentCheckboxes(selectedAssignments = []) {
    const container = document.getElementById('assignmentsContainer');
    if (!container) return;

    let html = '';
    for (const [className, subjects] of Object.entries(CLASSES)) {
        html += `<div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
            <p style="font-weight: 700; color: var(--primary); margin-bottom: 6px;">🏫 ${className}</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">`;

        subjects.forEach(subject => {
            const isChecked = selectedAssignments.some(a => a.className === className && a.subject === subject);
            const id = `assign_${className.replace(/\s/g, '')}_${subject}`;
            html += `
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; padding: 4px; cursor: pointer;">
                    <input type="checkbox" value="${className}|${subject}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px;" />
                    <span>${subject}</span>
                </label>
            `;
        });

        html += `</div></div>`;
    }
    container.innerHTML = html;
}

// =====================================================
// EDIT STAFF
// =====================================================
function editStaff(staffId) {
    const staff = allStaff.find(s => s.id === staffId);
    if (!staff) return;

    editingStaffId = staffId;
    currentStaffType = staff.role || 'teacher';

    document.getElementById('formTitle').textContent = `✏️ Edit ${staff.role === 'teacher' ? 'Teacher' : 'Cook'}`;
    document.getElementById('formDesc').textContent = 'వివరాలు మార్చండి';

    document.getElementById('staffName').value = staff.name || '';
    document.getElementById('staffPhone').value = staff.phone || '';
    document.getElementById('staffDob').value = staff.dob || '';
    document.getElementById('staffError').classList.add('hidden');

    const assignmentsSection = document.getElementById('teacherAssignmentsSection');
    if (assignmentsSection) {
        if (currentStaffType === 'teacher') {
            assignmentsSection.style.display = 'block';
            renderAssignmentCheckboxes(staff.assignments || []);
        } else {
            assignmentsSection.style.display = 'none';
        }
    }

    showScreen('form');
}

// =====================================================
// SAVE STAFF (Add or Edit)
// =====================================================
async function handleSaveStaff() {
    const name = document.getElementById('staffName').value.trim();
    const phone = document.getElementById('staffPhone').value.trim();
    const dob = document.getElementById('staffDob').value.trim();
    const errorEl = document.getElementById('staffError');
    const btn = document.getElementById('staffSubmitBtn');

    if (!name) return showFormError(errorEl, 'పేరు నింపండి.');
    if (!/^\d{10}$/.test(phone)) return showFormError(errorEl, 'ఫోన్ నంబర్ 10 అంకెలు ఉండాలి.');
    if (!/^\d{6}$/.test(dob)) return showFormError(errorEl, 'పుట్టిన తేదీ ddmmyy ఫార్మాట్ లో 6 అంకెలు ఉండాలి.');

    // Master PIN ఆటోమేటిక్ జనరేట్ (చివరి 4 అంకెలు)
    const autoPin = phone.slice(-4);

    // Teacher అయితే, సెలెక్ట్ చేసిన అసైన్‌మెంట్స్ తీసుకో
    let assignments = [];
    if (currentStaffType === 'teacher') {
        const checkboxes = document.querySelectorAll('#assignmentsContainer input[type="checkbox"]:checked');
        assignments = Array.from(checkboxes).map(cb => {
            const [className, subject] = cb.value.split('|');
            return { className, subject };
        });
    }

    btn.disabled = true;
    btn.innerHTML = 'సేవ్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        const staffData = {
            role: currentStaffType,
            name: name,
            phone: phone,
            dob: dob,
            masterPin: autoPin,
            isActive: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (currentStaffType === 'teacher') {
            staffData.assignments = assignments;
        }

        if (editingStaffId) {
            await db.collection('users').doc(editingStaffId).update(staffData);
            UI.toast('✅ Staff వివరాలు అప్‌డేట్ అయ్యాయి!', 'success');
        } else {
            staffData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('users').add(staffData);
            UI.toast('✅ Staff విజయవంతంగా యాడ్ అయ్యారు!', 'success');
        }

        await loadStaffList();
        showScreen('list');
    } catch (error) {
        console.error('Save staff error:', error);
        showFormError(errorEl, 'సేవ్ విఫలమైంది. మళ్లీ ప్రయత్నించండి.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save" style="margin-right: 8px;"></i> Save';
    }
}

// =====================================================
// DELETE STAFF
// =====================================================
async function deleteStaff(staffId, staffName) {
    if (!confirm(`⚠️ ${staffName} ని పూర్తిగా డిలీట్ చేయాలా? ఇది తిరిగి తీసుకోలేము.`)) return;

    try {
        await db.collection('users').doc(staffId).delete();
        UI.toast('🗑️ Staff విజయవంతంగా డిలీట్ అయ్యారు!', 'success');
        await loadStaffList();
    } catch (error) {
        console.error('Delete staff error:', error);
        UI.toast('❌ డిలీట్ విఫలమైంది.', 'error');
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
