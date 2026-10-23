// js/pages/hm-classrooms.js

let currentScreen = 'list';
let currentClassroomId = null;
let currentClassroomName = '';
let allClassrooms = [];
let currentStudents = [];
let editingStudentId = null;

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
        const app = document.getElementById('classroomsApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        await loadClassrooms();
        showScreen('list');
    }, 1200);

    bindEvents();
});

// =====================================================
// SCREEN SWITCHER
// =====================================================
function showScreen(name) {
    currentScreen = name;
    ['list', 'createClass', 'students', 'editStudent'].forEach(s => {
        const el = document.getElementById('screen' + capitalize(s));
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('screen' + capitalize(name));
    if (target) target.classList.remove('hidden');

    const title = document.getElementById('pageTitle');
    if (title) {
        const titles = {
            list: 'Classrooms',
            createClass: 'Add Class',
            students: currentClassroomName || 'Students',
            editStudent: 'Edit Student'
        };
        title.textContent = titles[name] || 'Classrooms';
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

    const createClassForm = document.getElementById('createClassForm');
    if (createClassForm) {
        createClassForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleCreateClass();
        });
    }

    const editStudentForm = document.getElementById('editStudentForm');
    if (editStudentForm) {
        editStudentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSaveStudentDetails();
        });
    }

    const dobInput = document.getElementById('editStudentDob');
    if (dobInput) {
        dobInput.addEventListener('input', () => {
            dobInput.value = dobInput.value.replace(/\D/g, '').slice(0, 6);
        });
    }
}

// =====================================================
// LOAD CLASSROOMS
// =====================================================
async function loadClassrooms() {
    try {
        if (typeof authReady !== 'undefined') {
            await Promise.race([
                authReady,
                new Promise(resolve => setTimeout(resolve, 3000))
            ]);
        }

        const snapshot = await db.collection('classrooms').get();
        allClassrooms = [];
        snapshot.forEach(doc => {
            allClassrooms.push({ id: doc.id, ...doc.data() });
        });

        // Class 1, Class 2 లాగా సార్ట్ చేయి
        allClassrooms.sort((a, b) => {
            const an = parseInt((a.className || '').replace(/\D/g, '')) || 0;
            const bn = parseInt((b.className || '').replace(/\D/g, '')) || 0;
            return an - bn;
        });

        renderClassrooms();
    } catch (error) {
        console.error('Load classrooms error:', error);
        UI.toast('Classrooms లోడ్ అవ్వలేదు.', 'error');
    }
}

// =====================================================
// RENDER CLASSROOMS
// =====================================================
function renderClassrooms() {
    const container = document.getElementById('classroomsList');
    if (!container) return;

    let html = `
        <button class="btn btn-primary btn-block" onclick="showScreen('createClass')" style="margin-bottom: var(--space-lg);">
            <i class="fas fa-plus" style="margin-right: 6px;"></i> కొత్త Class క్రియేట్ చేయండి
        </button>
    `;

    if (allClassrooms.length === 0) {
        html += `
            <div style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
                <i class="fas fa-school" style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);"></i>
                <p>ఇంకా Classrooms లేవు</p>
            </div>
        `;
        container.innerHTML = html;
        return;
    }

    html += allClassrooms.map(cls => `
        <div class="card" style="padding: var(--space-md); margin-bottom: var(--space-sm); cursor: pointer;" onclick="openClassroom('${cls.id}', '${escapeHtml(cls.className || '')}')">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <h4 style="font-size: 1.1rem; margin-bottom: 4px;">🏫 ${escapeHtml(cls.className || '—')}</h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">
                        <i class="fas fa-users"></i> మొత్తం విద్యార్థులు: ${cls.classStrength || 0}
                    </p>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button class="icon-btn" onclick="event.stopPropagation(); deleteClass('${cls.id}', '${escapeHtml(cls.className || '')}')" title="Delete Class" style="width: 36px; height: 36px; background: var(--danger); color: #fff;">
                        <i class="fas fa-trash" style="font-size: 0.9rem;"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

// =====================================================
// CREATE CLASS + AUTO ROLL NUMBERS
// =====================================================
async function handleCreateClass() {
    const className = document.getElementById('newClassName').value;
    const strength = parseInt(document.getElementById('newClassStrength').value);
    const errorEl = document.getElementById('createClassError');
    const btn = document.getElementById('createClassBtn');

    if (!className) return showFormError(errorEl, 'Class ఎంచుకోండి.');
    if (!strength || strength < 1 || strength > 100) return showFormError(errorEl, '1 నుంచి 100 మధ్య Strength ఇవ్వండి.');

    // ఈ క్లాస్ ఇప్పటికే ఉందా చెక్ చేయి
    const exists = allClassrooms.find(c => c.className === className);
    if (exists) {
        return showFormError(errorEl, 'ఈ Class ఇప్పటికే క్రియేట్ చేయబడింది.');
    }

    btn.disabled = true;
    btn.innerHTML = 'క్రియేట్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        // 1. Class క్రియేట్ చేయి
        const classRef = await db.collection('classrooms').add({
            className: className,
            classStrength: strength,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. ఆటోమేటిక్ రోల్ నంబర్లు క్రియేట్ చేయి
        const batch = db.batch();
        for (let i = 1; i <= strength; i++) {
            const rollNum = i.toString().padStart(2, '0'); // 01, 02... 30
            const studentRef = db.collection('classrooms').doc(classRef.id).collection('students').doc();
            batch.set(studentRef, {
                rollNumber: rollNum,
                name: '',
                dob: '',
                isFilled: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        await batch.commit();

        UI.toast(`✅ ${className} క్రియేట్ అయ్యింది (${strength} రోల్ నంబర్లు)!`, 'success');
        
        document.getElementById('createClassForm').reset();
        await loadClassrooms();
        showScreen('list');
    } catch (error) {
        console.error('Create class error:', error);
        showFormError(errorEl, 'క్రియేషన్ విఫలమైంది. మళ్లీ ప్రయత్నించండి.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save" style="margin-right: 8px;"></i> Class క్రియేట్ చేయండి';
    }
}

// =====================================================
// DELETE CLASS
// =====================================================
async function deleteClass(classId, className) {
    if (!confirm(`⚠️ "${className}" Class ని పూర్తిగా డిలీట్ చేయాలా? ఇందులోని విద్యార్థులందరూ తీసేయబడతారు.`)) return;

    try {
        const studentsSnap = await db.collection('classrooms').doc(classId).collection('students').get();
        const batch = db.batch();
        studentsSnap.forEach(doc => batch.delete(doc.ref));
        batch.delete(db.collection('classrooms').doc(classId));
        await batch.commit();

        UI.toast('🗑️ Class మరియు విద్యార్థులు డిలీట్ అయ్యారు!', 'success');
        await loadClassrooms();
    } catch (error) {
        console.error('Delete class error:', error);
        UI.toast('❌ డిలీట్ విఫలమైంది.', 'error');
    }
}

// =====================================================
// OPEN CLASSROOM → STUDENTS LIST
// =====================================================
async function openClassroom(classId, className) {
    currentClassroomId = classId;
    currentClassroomName = className;

    document.getElementById('studentsTitle').textContent = `👨‍🎓 ${className} — Students`;
    document.getElementById('studentsClassDesc').textContent = 'రోల్ నంబర్ ప్రకారం వివరాలు నింపండి';

    showScreen('students');
    await loadStudents();
}

// =====================================================
// LOAD STUDENTS
// =====================================================
async function loadStudents() {
    if (!currentClassroomId) return;

    const container = document.getElementById('studentsList');
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">లోడ్ అవుతోంది...</p>`;

    try {
        const snapshot = await db.collection('classrooms').doc(currentClassroomId).collection('students').get();

        currentStudents = [];
        snapshot.forEach(doc => {
            currentStudents.push({ id: doc.id, ...doc.data() });
        });

        currentStudents.sort((a, b) => {
            return parseInt(a.rollNumber) - parseInt(b.rollNumber);
        });

        renderStudents();
    } catch (error) {
        console.error('Load students error:', error);
        container.innerHTML = `<p style="color: var(--danger); text-align: center; padding: var(--space-md);">లోడ్ విఫలమైంది</p>`;
    }
}

// =====================================================
// RENDER STUDENTS (Individual Edit/Delete)
// =====================================================
function renderStudents() {
    const container = document.getElementById('studentsList');
    if (!container) return;

    if (currentStudents.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
                <i class="fas fa-user-graduate" style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);"></i>
                <p>ఇంకా విద్యార్థులు లేరు</p>
            </div>
        `;
        return;
    }

    container.innerHTML = currentStudents.map(student => {
        const isFilled = student.isFilled && student.name;
        const statusColor = isFilled ? 'var(--success)' : '#F9A825';
        
        return `
        <div class="card" style="padding: var(--space-md); margin-bottom: var(--space-sm); border-left: 4px solid ${statusColor};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: var(--space-md); flex: 1;">
                    <div style="background: var(--primary); color: #fff; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem;">
                        ${escapeHtml(student.rollNumber || '—')}
                    </div>
                    <div style="flex: 1;">
                        ${isFilled 
                            ? `<h4 style="font-size: 1rem; margin-bottom: 2px;">${escapeHtml(student.name)}</h4>
                               <p style="font-size: 0.75rem; color: var(--text-muted);">📅 ${escapeHtml(student.dob || '—')}</p>`
                            : `<p style="font-size: 0.9rem; color: var(--text-muted); font-style: italic;">వివరాలు నింపలేదు</p>
                               <p style="font-size: 0.7rem; color: #F9A825; font-weight: 600;">⚠️ Click to add details</p>`
                        }
                    </div>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button class="icon-btn" onclick="editStudentDetails('${student.id}')" title="${isFilled ? 'Edit' : 'Add Details'}" style="width: 36px; height: 36px; background: var(--primary); color: #fff;">
                        <i class="fas fa-${isFilled ? 'edit' : 'user-plus'}" style="font-size: 0.9rem;"></i>
                    </button>
                    <button class="icon-btn" onclick="deleteIndividualStudent('${student.id}', '${escapeHtml(student.rollNumber || '')}')" title="Delete" style="width: 36px; height: 36px; background: var(--danger); color: #fff;">
                        <i class="fas fa-trash" style="font-size: 0.9rem;"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// =====================================================
// EDIT STUDENT DETAILS (Name, DOB)
// =====================================================
function editStudentDetails(studentId) {
    const student = currentStudents.find(s => s.id === studentId);
    if (!student) return;

    editingStudentId = studentId;
    document.getElementById('editStudentTitle').textContent = student.isFilled ? '✏️ Edit Details' : '➕ Add Details';
    document.getElementById('editStudentDesc').textContent = `Roll Number: ${student.rollNumber}`;
    document.getElementById('editStudentRoll').value = student.rollNumber || '';
    document.getElementById('editStudentName').value = student.name || '';
    document.getElementById('editStudentDob').value = student.dob || '';
    document.getElementById('editStudentError').classList.add('hidden');
    showScreen('editStudent');
}

// =====================================================
// SAVE STUDENT DETAILS
// =====================================================
async function handleSaveStudentDetails() {
    const name = document.getElementById('editStudentName').value.trim();
    const dob = document.getElementById('editStudentDob').value.trim();
    const errorEl = document.getElementById('editStudentError');
    const btn = document.getElementById('editStudentBtn');

    if (!name) return showFormError(errorEl, 'పేరు నింపండి.');
    if (!/^\d{6}$/.test(dob)) return showFormError(errorEl, 'DOB ddmmyy ఫార్మాట్ లో 6 అంకెలు ఉండాలి.');

    btn.disabled = true;
    btn.innerHTML = 'సేవ్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        await db.collection('classrooms').doc(currentClassroomId).collection('students').doc(editingStudentId).update({
            name: name,
            dob: dob,
            isFilled: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        UI.toast('✅ విద్యార్థి వివరాలు సేవ్ అయ్యాయి!', 'success');
        await loadStudents();
        showScreen('students');
    } catch (error) {
        console.error('Save student error:', error);
        showFormError(errorEl, 'సేవ్ విఫలమైంది.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save" style="margin-right: 8px;"></i> Save';
    }
}

// =====================================================
// DELETE INDIVIDUAL STUDENT
// =====================================================
async function deleteIndividualStudent(studentId, rollNumber) {
    if (!confirm(`⚠️ Roll Number ${rollNumber} ని డిలీట్ చేయాలా?`)) return;

    try {
        await db.collection('classrooms').doc(currentClassroomId).collection('students').doc(studentId).delete();
        UI.toast('🗑️ విద్యార్థి డిలీట్ అయ్యారు!', 'success');
        await loadStudents();
    } catch (error) {
        console.error('Delete student error:', error);
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
