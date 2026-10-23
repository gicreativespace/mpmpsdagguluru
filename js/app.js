// js/app.js — Digital Manabadi v12.0 (Full updated)
// Changes: HM bypass fix, Session check, initPWA duplicate removed,
//          getRoleLabel updated, Loading state, Red dot on notice (later ready).

// =====================================================
// SPLASH HIDE
// =====================================================
(function hideSplashAfterDelay() {
    function doHide() {
        const splash = document.getElementById('splash-screen');
        const appContainer = document.getElementById('app-container');
        if (splash) {
            splash.classList.add('hidden');
            splash.style.opacity = '0';
            splash.style.pointerEvents = 'none';
            setTimeout(() => { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 500);
        }
        if (appContainer) {
            appContainer.style.display = 'flex';
            appContainer.style.opacity = '1';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(doHide, 1500));
    } else {
        setTimeout(doHide, 1500);
    }
    setTimeout(doHide, 3000);
})();

// =====================================================
// MAIN INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    // --- Theme ---
    const savedTheme = localStorage.getItem('dm_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);

    // --- Font size ---
    const savedSize = localStorage.getItem('dm_font_size');
    if (savedSize) {
        document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');
    }

    // --- Session auto redirect ---
    const session = localStorage.getItem('dm_session');
    if (session) {
        try {
            const data = JSON.parse(session);
            const sessionAge = Date.now() - (data.timestamp || 0);
            const EIGHT_HOURS = 8 * 60 * 60 * 1000;

            if (sessionAge < EIGHT_HOURS && data.role) {
                // Session valid → auto redirect
                window.location.href = data.role + '.html';
                return;
            } else {
                // Expired or invalid → clear
                localStorage.removeItem('dm_session');
            }
        } catch (e) {
            console.warn('Invalid session — clearing:', e);
            localStorage.removeItem('dm_session');
        }
    }

    // --- UI Init (initPWA inside initLayout) ---
    if (typeof UI !== 'undefined') {
        UI.initLayout();
    }

    // --- Red dot on notice card (future-ready) ---
    checkUnreadNotices();
});

// =====================================================
// ACCESS CONTROL
// =====================================================
async function checkAccess(role) {
    // --- Loading state on card ---
    const card = document.querySelector(`[onclick*="checkAccess('${role}')"]`);
    const originalOpacity = card ? card.style.opacity : '';
    const originalPointer = card ? card.style.pointerEvents : '';

    if (card) {
        card.style.opacity = '0.6';
        card.style.pointerEvents = 'none';
    }

    function restoreCard() {
        if (card) {
            setTimeout(() => {
                card.style.opacity = originalOpacity || '1';
                card.style.pointerEvents = originalPointer || 'auto';
            }, 100);
        }
    }

    // --- Read schoolInfo ---
    let data = null;
    try {
        if (typeof authReady !== 'undefined') {
            await Promise.race([
                authReady,
                new Promise(resolve => setTimeout(resolve, 3000))
            ]);
        }
        const schoolDoc = await db.collection('schoolInfo').doc('main').get();
        data = schoolDoc.exists ? schoolDoc.data() : null;
    } catch (error) {
        console.error('Firestore Error:', error);
        restoreCard();
        showAccessError('⚠️ డేటాబేస్ కనెక్షన్ లోపం.\nదయచేసి హెడ్‌మాస్టర్‌ని సంప్రదించండి.');
        return;
    }

    // --- Setup not complete → HM setup only ---
    if (!data || !data.isSetupComplete) {
        if (role === 'headmaster') {
            window.location.href = 'headmaster.html';
        } else {
            restoreCard();
            showAccessError('⚠️ పాఠశాల సెటప్ ఇంకా పూర్తి కాలేదు.\nదయచేసి హెడ్‌మాస్టర్‌ని సంప్రదించండి.');
        }
        return;
    }

    // --- HM → always allowed ---
    if (role === 'headmaster') {
        window.location.href = 'headmaster.html';
        return;
    }

    // --- Section toggle check ---
    const sections = data.sections || {};
    if (sections[role] === true) {
        window.location.href = role + '.html';
    } else {
        restoreCard();
        showAccessError(`⚠️ ${getRoleLabel(role)} సెక్షన్ ఎనేబుల్ చేయలేదు.\nదయచేసి హెడ్‌మాస్టర్‌ని సంప్రదించండి.`);
    }
}

// =====================================================
// SHOW ERROR
// =====================================================
function showAccessError(message) {
    if (typeof UI !== 'undefined' && typeof UI.toast === 'function') {
        UI.toast(message, 'warning', 5000);
    } else {
        alert(message);
    }
}

// =====================================================
// ROLE LABELS (Telugu)
// =====================================================
function getRoleLabel(role) {
    const labels = {
        headmaster: 'ప్రిన్సిపాల్',
        teacher: 'టీచర్',
        cook: 'వంటవాడు',
        parent: 'తల్లిదండ్రుల'
    };
    return labels[role] || role.toUpperCase();
}

// =====================================================
// RED DOT — Unread Notices
// =====================================================
async function checkUnreadNotices() {
    try {
        if (typeof db === 'undefined' || typeof UI === 'undefined') return;

        const snap = await db.collection('noticeBoard')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        if (snap.empty) return;

        const latest = snap.docs[0].data();
        const latestTime = latest.createdAt?.toDate
            ? latest.createdAt.toDate()
            : new Date(latest.createdAt || Date.now());

        if (UI.hasUnreadNotices(latestTime.toISOString())) {
            const noticeCards = document.querySelectorAll('[data-role="notice"]');
            noticeCards.forEach(c => c.classList.add('notice-badge'));
        }
    } catch (e) {
        // noticeBoard empty or permission issue → silent
        console.warn('Notice check skipped:', e.message);
    }
}
