// js/auth.js — Digital Manabadi v12.0
// Changes:
//  - Setup re-run protection
//  - Session timestamp (backward compatible)
//  - Reset code = 919720 - today (ddmmyy) → result
//  - setupLog in schoolInfo

const Auth = {

    // =====================================================
    // HELPER — Today ddmmyy
    // =====================================================
    _getTodayDDMMYY: function() {
        const d = new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        return `${dd}${mm}${yy}`;
    },

    // =====================================================
    // HM LOGIN — 6 అంకెల PIN + Active check
    // =====================================================
    loginHM: async function(enteredPin) {
        try {
            const lockUntil = parseInt(localStorage.getItem('dm_lock_until') || '0');
            if (Date.now() < lockUntil) {
                const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
                return { success: false, message: `లాక్ అయ్యింది. ${remaining} సెకన్ల తర్వాత ప్రయత్నించండి.` };
            }

            const pinStr = String(enteredPin || '').trim();
            if (!/^\d{6}$/.test(pinStr)) {
                return { success: false, message: "PIN 6 అంకెలు ఉండాలి." };
            }

            const schoolDoc = await db.collection('schoolInfo').doc('main').get();
            if (!schoolDoc.exists) {
                return { success: false, message: "స్కూల్ సెటప్ పూర్తి కాలేదు. వాలియాస్ టీమ్ ని సంప్రదించండి." };
            }

            const schoolData = schoolDoc.data();
            const storedPin = String(schoolData.hmPin || '').trim();

            if (storedPin !== pinStr) {
                const failCount = parseInt(localStorage.getItem('dm_fail_count') || '0') + 1;
                localStorage.setItem('dm_fail_count', failCount);

                if (failCount >= 5) {
                    localStorage.setItem('dm_lock_until', Date.now() + 60000);
                    localStorage.setItem('dm_fail_count', '0');
                    return { success: false, message: "5 సార్లు తప్పు PIN. 60 సెకన్ల లాక్.", failCount: 5 };
                }
                return { success: false, message: `తప్పు PIN. (${failCount}/5)`, failCount };
            }

            // HM Active check
            if (schoolData.hm && schoolData.hm.isActive === false) {
                return { success: false, message: "🔒 మీ ఖాతా నిలిపివేయబడింది. Valiass టీమ్‌ను సంప్రదించండి." };
            }

            localStorage.removeItem('dm_fail_count');
            localStorage.removeItem('dm_lock_until');

            this.setSession('headmaster', schoolData.hmName, 'HM');
            return { success: true, message: "లాగిన్ విజయవంతమైంది!" };

        } catch (error) {
            console.error("Login Error:", error);
            return { success: false, message: "నెట్‌వర్క్ లోపం. మళ్ళీ ప్రయత్నించండి." };
        }
    },

    // =====================================================
    // HM SETUP — Valiass code + re-run protection
    // =====================================================
    setupHM: async function(setupData) {
        try {
            const pinStr = String(setupData.hmPin || '').trim();
            if (!/^\d{6}$/.test(pinStr)) {
                return { success: false, message: "PIN 6 అంకెలు ఉండాలి." };
            }

            // ✅ SETUP RE-RUN PROTECTION
            const existingDoc = await db.collection('schoolInfo').doc('main').get();
            if (existingDoc.exists && existingDoc.data().isSetupComplete === true) {
                return { success: false, message: "⚠️ సెటప్ ఇప్పటికే పూర్తి అయింది. HM గారిని సంప్రదించండి." };
            }

            // Valiass code verify (5 fields last chars + @533340)
            const lastChars =
                (setupData.district || '').slice(-1) +
                (setupData.mandal || '').slice(-1) +
                (setupData.village || '').slice(-1) +
                (setupData.school || '').slice(-1) +
                (setupData.hmName || '').slice(-1);

            const expectedCode = lastChars + '@533340';
            if (setupData.valiassCode !== expectedCode) {
                return { success: false, message: "Valiass Setup Code తప్పు. మళ్లీ చెక్ చేయండి." };
            }

            await db.collection('schoolInfo').doc('main').set({
                schoolName: setupData.school,
                district: setupData.district,
                mandal: setupData.mandal,
                village: setupData.village,
                hmName: setupData.hmName,
                hmPin: pinStr,
                valiassCode: setupData.valiassCode,
                isSetupComplete: true,
                hmDob: null,
                hm: {
                    isActive: true,
                    disabledAt: null,
                    transferredAt: null
                },
                sections: { teacher: false, cook: false, parent: false, office: false },
                setupLog: [{
                    action: 'setup',
                    date: new Date().toISOString(),
                    hmName: setupData.hmName
                }],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.setSession('headmaster', setupData.hmName, 'HM');
            return { success: true, message: "సెటప్ విజయవంతమైంది!" };

        } catch (error) {
            console.error("Setup Error:", error);
            return { success: false, message: "సెటప్ విఫలమైంది. మళ్లీ ప్రయత్నించండి." };
        }
    },

    // =====================================================
    // HM PIN RESET
    // Reset Code = 919720 - today(ddmmyy) → result
    // Example (23-10-2026): 919720 - 231026 = 688694
    // =====================================================
    resetHMPin: async function(resetCode, newPin) {
        try {
            const newPinStr = String(newPin || '').trim();
            if (!/^\d{6}$/.test(newPinStr)) {
                return { success: false, message: "కొత్త PIN 6 అంకెలు ఉండాలి." };
            }

            const schoolDoc = await db.collection('schoolInfo').doc('main').get();
            if (!schoolDoc.exists) {
                return { success: false, message: "స్కూల్ సెటప్ పూర్తి కాలేదు." };
            }

            // ✅ Reset code = 919720 - today (ddmmyy)
            const todayNum = parseInt(this._getTodayDDMMYY(), 10);
            const expectedReset = String(919720 - todayNum);
            const entered = String(resetCode || '').trim();

            if (entered !== expectedReset) {
                return { success: false, message: "రీసెట్ కోడ్ తప్పు. Valiass టీమ్‌ను సంప్రదించండి." };
            }

            await db.collection('schoolInfo').doc('main').update({ hmPin: newPinStr });
            localStorage.removeItem('dm_fail_count');
            localStorage.removeItem('dm_lock_until');
            return { success: true, message: "PIN విజయవంతంగా రీసెట్ అయ్యింది!" };

        } catch (error) {
            console.error("Reset Error:", error);
            return { success: false, message: "రీసెట్ విఫలమైంది." };
        }
    },

    // =====================================================
    // SESSION MANAGEMENT
    // =====================================================
    setSession: function(role, name, displayRole) {
        const now = Date.now();
        const sessionData = {
            role,
            name,
            displayRole,
            loginTime: now,
            timestamp: now   // ✅ app.js కోసం
        };
        localStorage.setItem('dm_session', JSON.stringify(sessionData));
    },

    logout: function() {
        localStorage.removeItem('dm_session');
        window.location.href = 'index.html';
    },

    checkAuth: function(requiredRole) {
        const session = localStorage.getItem('dm_session');
        if (!session) {
            window.location.href = 'index.html';
            return false;
        }
        const data = JSON.parse(session);
        if (requiredRole && data.role !== requiredRole) {
            window.location.href = 'index.html';
            return false;
        }
        return data;
    }
};
