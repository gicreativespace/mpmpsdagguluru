// js/pages/valiass-admin.js

let currentScreen = 'loading';
let currentSchoolData = null;
let isPinVisible = false;

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

    setTimeout(async () => {
        const splash = document.getElementById('splash');
        const app = document.getElementById('valiassApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        await decideScreen();
    }, 1500);

    bindEvents();
});

// =====================================================
// SCREEN DECISION
// =====================================================
async function decideScreen() {
    try {
        // Firebase Auth పూర్తి అయ్యే వరకు వేచి ఉండు
        if (typeof authReady !== 'undefined') {
            await Promise.race([
                authReady,
                new Promise(resolve => setTimeout(resolve, 3000))
            ]);
        }

        const currentUser = firebase.auth().currentUser;
        if (currentUser) {
            const adminDoc = await db.collection('admins').doc(currentUser.uid).get();
            if (adminDoc.exists) {
                showScreen('dashboard');
                return;
            }
        }

        showScreen('login');
    } catch (error) {
        console.error('Screen decision error:', error);
        showScreen('login');
    }
}

// =====================================================
// SCREEN SWITCHER
// =====================================================
function showScreen(name) {
    currentScreen = name;
    ['login', 'dashboard', 'setup', 'edit', 'editForm', 'transfer'].forEach(s => {
        const el = document.getElementById('screen' + capitalize(s));
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('screen' + capitalize(name));
    if (target) target.classList.remove('hidden');

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        if (name === 'login') backBtn.classList.add('hidden');
        else backBtn.classList.remove('hidden');
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        if (name === 'login') logoutBtn.classList.add('hidden');
        else logoutBtn.classList.remove('hidden');
    }

    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.classList.remove('hidden');

    const title = document.getElementById('pageTitle');
    if (title) {
        title.textContent = {
            login: 'Valiass Login',
            dashboard: 'Valiass Admin',
            setup: 'Setup Principal',
            edit: 'Edit Principal',
            editForm: 'Edit HM Details',
            transfer: 'Transfer HM'
        }[name] || 'Valiass Admin';
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

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (currentScreen === 'editForm' || currentScreen === 'transfer') showScreen('edit');
            else if (currentScreen === 'setup' || currentScreen === 'edit') showScreen('dashboard');
            else showScreen('login');
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await firebase.auth().signOut();
            } catch (e) { console.error(e); }
            localStorage.removeItem('dm_session');
            window.location.href = 'index.html';
        });
    }

    document.querySelectorAll('.pin-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;
            const isPwd = input.type === 'password';
            input.type = isPwd ? 'text' : 'password';
            btn.textContent = isPwd ? '🙈' : '👁';
        });
    });

    // PIN inputs — 6 digits only
    ['setHmPin', 'setHmPinConfirm', 'editHmPin', 'transferNewPin', 'transferNewPinConfirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                el.value = el.value.replace(/\D/g, '').slice(0, 6);
            });
        }
    });

    // Admin Login
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleAdminLogin();
        });
    }

    // Setup Principal
    const setupPrincipalForm = document.getElementById('setupPrincipalForm');
    if (setupPrincipalForm) {
        setupPrincipalForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSetupPrincipal();
        });
    }

    // Edit HM
    const editHmForm = document.getElementById('editHmForm');
    if (editHmForm) {
        editHmForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleEditHm();
        });
    }

    // Transfer
    const transferForm = document.getElementById('transferForm');
    if (transferForm) {
        transferForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleTransfer();
        });
    }
}

// =====================================================
// VIEW / HIDE HM PIN (Edit Principal లో)
// =====================================================
function toggleViewPin() {
    const pinDisplay = document.getElementById('editHmPinDisplay');
    const pinIcon = document.getElementById('viewPinIcon');
    
    if (!currentSchoolData) return;

    const actualPin = currentSchoolData.hmPin || '—';

    if (isPinVisible) {
        // Hide
        pinDisplay.textContent = '••••••';
        pinDisplay.style.color = 'var(--danger)';
        pinIcon.className = 'fas fa-eye';
        isPinVisible = false;
    } else {
        // Show
        pinDisplay.textContent = actualPin;
        pinDisplay.style.color = 'var(--success)';
        pinIcon.className = 'fas fa-eye-slash';
        isPinVisible = true;
    }
}

// =====================================================
// ADMIN LOGIN
// =====================================================
async function handleAdminLogin() {
    const email = document.getElementById('adminEmail').value.trim().replace(/\s/g, ''); 
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('adminLoginError');
    const btn = document.getElementById('adminLoginBtn');

    if (!email || !password) {
        return showFormError(errorEl, 'Email మరియు Password నింపండి.');
    }

    btn.disabled = true;
    btn.textContent = 'లాగిన్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
        const uid = cred.user.uid;

        const adminDoc = await db.collection('admins').doc(uid).get();
        if (!adminDoc.exists) {
            await firebase.auth().signOut();
            return showFormError(errorEl, '❌ ఈ ఖాతాకు Admin అనుమతి లేదు. Valiass టీమ్‌ను సంప్రదించండి.');
        }

        UI.toast('✅ Admin login successful!', 'success');
        showScreen('dashboard');
    } catch (err) {
        console.error('Admin login error:', err);
        let msg = 'లాగిన్ విఫలమైంది.';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            msg = '❌ తప్పు Email లేదా Password.';
        } else if (err.code === 'auth/too-many-requests') {
            msg = '⚠️ చాలా సార్లు ప్రయత్నించారు. కొంత సమయం తర్వాత ప్రయత్నించండి.';
        }
        showFormError(errorEl, msg);
    } finally {
        btn.disabled = false;
        btn.textContent = 'లాగిన్';
    }
}

// =====================================================
// SETUP PRINCIPAL
// =====================================================
async function handleSetupPrincipal() {
    const district = document.getElementById('setDistrict').value.trim();
    const mandal = document.getElementById('setMandal').value.trim();
    const village = document.getElementById('setVillage').value.trim();
    const school = document.getElementById('setSchool').value.trim();
    const hmName = document.getElementById('setHmName').value.trim();
    const pin = document.getElementById('setHmPin').value;
    const pinConfirm = document.getElementById('setHmPinConfirm').value;
    const errorEl = document.getElementById('setupPrincipalError');
    const btn = document.getElementById('setupPrincipalBtn');

    if (!district || !mandal || !village || !school || !hmName) {
        return showFormError(errorEl, 'అన్ని ఫీల్డ్స్ నింపండి.');
    }
    if (!/^\d{6}$/.test(pin)) {
        return showFormError(errorEl, 'PIN 6 అంకెలు ఉండాలి.');
    }
    if (pin !== pinConfirm) {
        return showFormError(errorEl, 'PIN మరియు నిర్ధారణ PIN మ్యాచ్ అవ్వలేదు.');
    }

    btn.disabled = true;
    btn.textContent = 'సేవ్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        const doc = await db.collection('schoolInfo').doc('main').get();
        const existingData = doc.exists ? doc.data() : {};

        await db.collection('schoolInfo').doc('main').set({
            ...existingData,
            schoolName: school,
            district: district,
            mandal: mandal,
            village: village,
            hmName: hmName,
            hmPin: pin,
            isSetupComplete: true,
            hmDob: existingData.hmDob || null,
            sections: existingData.sections || { teacher: false, cook: false, parent: false, office: false },
            createdAt: existingData.createdAt || firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        UI.toast('✅ Setup విజయవంతమైంది! HM ఇప్పుడు login చేయగలరు.', 'success');
        clearSetupForm();
        showScreen('dashboard');
    } catch (err) {
        console.error('Setup error:', err);
        showFormError(errorEl, 'సెటప్ విఫలమైంది. మళ్లీ ప్రయత్నించండి.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save" style="margin-right: 8px;"></i> Save & Complete Setup';
    }
}

function clearSetupForm() {
    ['setDistrict', 'setMandal', 'setVillage', 'setSchool', 'setHmName', 'setHmPin', 'setHmPinConfirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

// =====================================================
// LOAD EDIT PRINCIPAL
// =====================================================
async function loadEditPrincipal() {
    try {
        const doc = await db.collection('schoolInfo').doc('main').get();
        if (!doc.exists || !doc.data().isSetupComplete) {
            UI.toast('⚠️ ఇంకా సెటప్ పూర్తి కాలేదు. మొదట Setup Principal చేయండి.', 'warning');
            return;
        }

        currentSchoolData = doc.data();

        const hmName = currentSchoolData.hmName || '—';
        const schoolName = currentSchoolData.schoolName || '—';
        const isActive = currentSchoolData.hm?.isActive !== false;

        document.getElementById('editHmNameDisplay').textContent = hmName;
        document.getElementById('editSchoolDisplay').textContent = schoolName;

        const statusEl = document.getElementById('editHmStatusDisplay');
        statusEl.textContent = isActive ? '✅ Active' : '🔒 Disabled';
        statusEl.style.color = isActive ? 'var(--success)' : 'var(--danger)';

        const editStatus = document.getElementById('editHmStatus');
        editStatus.textContent = isActive ? 'HM యాక్టివ్ గా ఉన్నారు' : 'HM నిలిపివేయబడ్డారు';

        const disableBtn = document.getElementById('disableBtn');
        disableBtn.innerHTML = isActive
            ? '<i class="fas fa-lock" style="margin-right: 8px;"></i> Disable HM'
            : '<i class="fas fa-unlock" style="margin-right: 8px;"></i> Enable HM';

        // ✅ PIN వ్యూ సెక్షన్ రీసెట్ చేయి
        const pinDisplay = document.getElementById('editHmPinDisplay');
        if (pinDisplay) {
            pinDisplay.textContent = '••••••';
            pinDisplay.style.color = 'var(--danger)';
            isPinVisible = false;
            const pinIcon = document.getElementById('viewPinIcon');
            if (pinIcon) pinIcon.className = 'fas fa-eye';
        }

        showScreen('edit');
    } catch (err) {
        console.error('Load edit error:', err);
        UI.toast('లోపం. మళ్లీ ప్రయత్నించండి.', 'error');
    }
}

// =====================================================
// EDIT HM DETAILS
// =====================================================
async function handleEditHm() {
    const hmName = document.getElementById('editHmName').value.trim();
    const newPin = document.getElementById('editHmPin').value;
    const schoolName = document.getElementById('editSchoolName').value.trim();
    const district = document.getElementById('editDistrict').value.trim();
    const mandal = document.getElementById('editMandal').value.trim();
    const village = document.getElementById('editVillage').value.trim();
    const errorEl = document.getElementById('editHmError');
    const btn = document.getElementById('editHmSubmitBtn');

    if (!hmName || !schoolName) {
        return showFormError(errorEl, 'HM పేరు మరియు పాఠశాల పేరు నింపండి.');
    }
    if (newPin && !/^\d{6}$/.test(newPin)) {
        return showFormError(errorEl, 'కొత్త PIN 6 అంకెలు ఉండాలి.');
    }

    btn.disabled = true;
    btn.innerHTML = 'సేవ్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        const updateData = {
            hmName: hmName,
            schoolName: schoolName,
            district: district,
            mandal: mandal,
            village: village
        };
        if (newPin) updateData.hmPin = newPin;

        await db.collection('schoolInfo').doc('main').update(updateData);
        UI.toast('✅ వివరాలు విజయవంతంగా అప్‌డేట్ అయ్యాయి!', 'success');
        showScreen('edit
