// js/pages/hm-classrooms.js

let currentScreen = 'list';
let editingClassId = null;
let editingStudentId = null;
let currentClassroomId = null;
let currentClassroomName = '';
let allClassrooms = [];
let currentStudents = [];

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
    ['list', 'classForm', 'students', 'studentForm'].forEach(s => {
        const el = document.getElementById('screen' + capitalize(s));
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('screen' + capitalize(name));
    if (target) target.classList.remove('hidden');

    const title = document.getElementById('pageTitle');
    if (title) {
        const titles = {
            list: 'Classrooms',
            classForm: 'Add Class',
            students: currentClassroomName || 'Students',
            studentForm: 'Add Student'
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

    // Class form
    const classForm = document.getElementById('classForm');
    if (classForm) {
        classForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSaveClass();
        });
    }

    // Student form
    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
        studentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSaveStudent();
        });
    }

    // Numeric inputs
    const rollInput = document.getElementById('studentRollNumber');
    if (rollInput) {
        rollInput.addEventListener('input', () => {
            rollInput.value = rollInput.value.replace(/\D/g, '').slice(0, 10);
        });
    }

    const dobInput = document.getElementById('studentDob');
    if (dobInput) {
        dobInput.addEventListener('input', () => {
            dobInput.value = dobInput.value.replace(/\D/g, '').slice(0, 6);
        });
    }

    const parentPhoneInput = document.getElementById('studentParentPhone');
    if (parentPhoneInput) {
        parentPhoneInput.addEventListener('input', () => {
            parentPhoneInput.value = parentPhoneInput.value.replace(/\D/g, '').slice(0, 10);
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

        allClassrooms.sort((a, b) => (a.className || '').localeCompare(b.className || '', undefined, { numeric: true }));

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

    if (allClassrooms.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
                <i class="fas fa-school" style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);"></i>
                <p>ఇంకా Classrooms లేవు</p>
                <p style="font-size: 0.85rem; margin-top: 4px;">కొత్త Class యాడ్ చేయండి</p>
            </div>
        `;
        return;
    }

    container.innerHTML = allClassrooms.map(cls => `
        <div class="card" style="padding: var(--space-md); margin-bottom: var(--space-sm); cursor: pointer;" onclick="openClassroom('${cls.id}', '${escapeHtml(cls.className || '')}')">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <h4 style="font-size: 1.1rem; margin-bottom: 4px;">🏫 ${escapeHtml(cls.className || '—')}</h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">
                        <i class="fas fa-users"></i> ${cls.studentCount || 0} విద్యార్థులు
                    </p>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button class="icon-btn" onclick="event.stopPropagation(); editClass('${cls.id}')" title="Edit" style="width: 36px; height: 36px; background: var(--primary); color: #fff;">
                        <i class="fas fa-edit" style="font-size: 0.9rem;"></i>
                    </button>
                    <button class="icon-btn" onclick="event.stopPropagation(); deleteClass('${cls.id}', '${escapeHtml(cls.className || '')}')" title="Delete" style="width: 36px; height: 36px; background: var(--danger); color: #fff;">
                        <i class="fas fa-trash" style="font-size: 0.9rem;"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// =====================================================
// ADD CLASS SCREEN
// =====================================================
function showAddClassScreen() {
    editingClassId = null;
    document.getElementById('classFormTitle').textContent = '➕ కొత్త Class';
    document.getElementById('classFormDesc').textContent = 'Class వివరాలు నింపండి';
    document.getElementById('classForm').reset();
    document.getElementById('classError').classList.add('hidden');
    showScreen('classForm');
}

// =====================================================
// EDIT CLASS
// =====================================================
function editClass(classId) {
    const cls = allClassrooms.find(c => c.id === classId);
    if (!cls) return;

    editingClassId = classId;
    document.getElementById('classFormTitle').textContent = '✏️ Edit Class';
    document.getElementById('classFormDesc').textContent = 'Class పేరు మార్చండి';
    document.getElementById('className').value = cls.className || '';
    document.getElementById('classError').classList.add('hidden');
    showScreen('classForm');
}

// =====================================================
// SAVE CLASS
// =====================================================
async function handleSaveClass() {
    const className = document.getElementById('className').value.trim();
    const errorEl = document.getElementById('classError');
    const btn = document.getElementById('classSubmitBtn');

    if (!className) return showFormError(errorEl, 'Class పేరు నింపండి.');

    btn.disabled = true;
    btn.innerHTML = 'సేవ్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        if (editingClassId) {
            await db.collection('classrooms').doc(editingClassId).update({
                className: className,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            UI.toast('✅ Class అప్‌డేట్ అయ్యింది!', 'success');
        } else {
            await db.collection('classrooms').add({
                className: className,
                studentCount: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            UI.toast('✅ Class విజయవంతంగా యాడ్ అయ్యింది!', 'success');
        }

        await loadClassrooms();
        showScreen('list');
    } catch (error) {
        console.error('Save class error:', error);
        showFormError(errorEl, 'సేవ్ విఫలమైంది.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save" style="margin-right: 8px;"></i> Save Class';
    }
}

// =====================================================
// DELETE CLASS
// =====================================================
async function deleteClass(classId, className) {
    if (!confirm(`⚠️ "${className}" Class ని డిలీట్ చేయాలా? ఇందులోని విద్యార్థులందరూ తీసేయబడతారు.`)) return;

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
    document.getElementById('studentsClassDesc').textContent = 'విద్యార్థుల జాబితా';

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
            const an = parseInt(a.rollNumber) || 0;
            const bn = parseInt(b.rollNumber) || 0;
            return an - bn;
        });

        renderStudents();
    } catch (error) {
        console.error('Load students error:', error);
        container.innerHTML = `<p style="color: var(--danger); text-align: center; padding: var(--space-md);">లోడ్ విఫలమైంది</p>`;
    }
}

// =====================================================
// RENDER STUDENTS
// =====================================================
function renderStudents() {
    const container = document.getElementById('studentsList');
    if (!container) return;

    if (currentStudents.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
                <i class="fas fa-user-graduate" style="font-size: 3rem; opacity: 0.3; margin-bottom: var(--space-md);"></i>
                <p>ఇంకా విద్యార్థులు లేరు</p>
                <p style="font-size: 0.85rem; margin-top: 4px;">కొత్త Student యాడ్ చేయండి</p>
            </div>
        `;
        return;
    }

    container.innerHTML = currentStudents.map(student => `
        <div class="card" style="padding: var(--space-md); margin-bottom: var(--space-sm);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: var(--space-sm); margin-bottom: 4px;">
                        <span style="background: var(--primary); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700;">
                            ${escapeHtml(student.rollNumber || '—')}
                        </span>
                        <h4 style="font-size: 1rem;">${escapeHtml(student.name || '—')}</h4>
                    </div>
                    ${student.dob ? `<p style="font-size: 0.75rem; color: var(--text-muted);">📅 ${escapeHtml(student.dob)}</p>` : ''}
                    ${student.parentPhone ? `<p style="font-size: 0.75rem; color: var(--text-muted);">📞 ${escapeHtml(student.parentPhone)}</p>` : ''}
                </div>
                <div style="display: flex; gap: 4px;">
                    <button class="icon-btn" onclick="editStudent('${student.id}')" title="Edit" style="width: 32px; height: 32px; background: var(--primary); color: #fff;">
                        <i class="fas fa-edit" style="font-size: 0.8rem;"></i>
                    </button>
                    <button class="icon-btn" onclick="deleteStudent('${student.id}', '${escapeHtml(student.name || '')}')" title="Delete" style="width: 32px; height: 32px; background: var(--danger); color: #fff;">
                        <i class="fas fa-trash" style="font-size: 0.8rem;"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// =====================================================
// ADD STUDENT SCREEN
// =====================================================
function showAddStudentScreen() {
    editingStudentId = null;
    document.getElementById('studentFormTitle').textContent = '➕ కొత్త Student';
    document.getElementById('studentFormDesc').textContent = 'Student వివరాలు నింపండి';
    document.getElementById('studentForm').reset();
    document.getElementById('studentError').classList.add('hidden');
    showScreen('studentForm');
}

// =====================================================
// EDIT STUDENT
// =====================================================
function editStudent(studentId) {
    const student = currentStudents.find(s => s.id === studentId);
    if (!student) return;

    editingStudentId = studentId;
    document.getElementById('studentFormTitle').textContent = '✏️ Edit Student';
    document.getElementById('studentFormDesc').textContent = 'Student వివరాలు మార్చండి';
    document.getElementById('studentRollNumber').value = student.rollNumber || '';
    document.getElementById('studentName').value = student.name || '';
    document.getElementById('studentDob').value = student.dob || '';
    document.getElementById('studentParentPhone').value = student.parentPhone || '';
    document.getElementById('studentError').classList.add('hidden');
    showScreen('studentForm');
}

// =====================================================
// SAVE STUDENT
// =====================================================
async function handleSaveStudent() {
    const rollNumber = document.getElementById('studentRollNumber').value.trim();
    const name = document.getElementById('studentName').value.trim();
    const dob = document.getElementById('studentDob').value.trim();
    const parentPhone = document.getElementById('studentParentPhone').value.trim();
    const errorEl = document.getElementById('studentError');
    const btn = document.getElementById('studentSubmitBtn');

    if (!rollNumber) return showFormError(errorEl, 'Roll Number నింపండి.');
    if (!name) return showFormError(errorEl, 'Student పేరు నింపండి.');
    if (!/^\d{6}$/.test(dob)) return showFormError(errorEl, 'DOB ddmmyy ఫార్మాట్ లో 6 అంకెలు ఉండాలి.');

    btn.disabled = true;
    btn.innerHTML = 'సేవ్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        const studentData = {
            rollNumber: rollNumber,
            name: name,
            dob: dob,
            parentPhone: parentPhone || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editingStudentId) {
            await db.collection('classrooms').doc(currentClassroomId).collection('students').doc(editingStudentId).update(studentData);
            UI.toast('✅ Student వివరాలు అప్‌డేట్ అయ్యాయి!', 'success');
        } else {
            studentData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('classrooms').doc(currentClassroomId).collection('students').add(studentData);
            UI.toast('✅ Student విజయవంతంగా యాడ్ అయ్యారు!', 'success');

            // Update studentCount
            const classDoc = await db.collection('classrooms').doc(currentClassroomId).get();
            const currentCount = classDoc.exists ? (classDoc.data().studentCount || 0) : 0;
            await db.collection('classrooms').doc(currentClassroomId).update({
                studentCount: currentCount + 1
            });
        }

        await loadStudents();
        await loadClassrooms();
        showScreen('students');
    } catch (error) {
        console.error('Save student error:', error);
        showFormError(errorEl, 'సేవ్ విఫలమైంది.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save" style="margin-right: 8px;"></i> Save Student';
    }
}

// =====================================================
// DELETE STUDENT
// =====================================================
async function deleteStudent(studentId, studentName) {
    if (!confirm(`⚠️ "${studentName}" Student ని డిలీట్ చేయాలా?`)) return;

    try {
        await db.collection('classrooms').doc(currentClassroomId).collection('students').doc(studentId).delete();

        const classDoc = await db.collection('classrooms').doc(currentClassroomId).get();
        const currentCount = classDoc.exists ? (classDoc.data().studentCount || 0) : 0;
        if (currentCount > 0) {
            await db.collection('classrooms').doc(currentClassroomId).update({
                studentCount: currentCount - 1
            });
        }

        UI.toast('🗑️ Student డిలీట్ అయ్యారు!', 'success');
        await loadStudents();
        await loadClassrooms();
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
