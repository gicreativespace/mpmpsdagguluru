// =====================================================
// js/config.js — Digital Manabadi (MPMP School Dagguluru)
// Step 1.1: Firebase Config + Anonymous Auth + Constants
// =====================================================

const firebaseConfig = {
  apiKey: "AIzaSyDkmfsfUuP_5NWfqsn_FHhDVhLPVvSivY8",
  authDomain: "mpmpsdagguluru-2026.firebaseapp.com",
  projectId: "mpmpsdagguluru-2026",
  storageBucket: "mpmpsdagguluru-2026.firebasestorage.app",
  messagingSenderId: "347951688448",
  appId: "1:347951688448:web:6f45e622dff615806ea1e5"
};

// Firebase Initialize (duplicate prevent)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

// =====================================================
// GLOBAL CONSTANTS
// =====================================================

// Valiass Contact (Footer popup — Call / WhatsApp)
const VALIASS_PHONE = "918985361991"; // 91 + 8985361991

// School / Project Info
const PROJECT_NAME = "Digital Manabadi";
const PROJECT_TAGLINE = "An initiative of @valiass team";

// =====================================================
// EDUCATIONAL YEAR HELPER (June 1 → April 30)
// =====================================================
// Returns format: "2025-26"
// June (6) నుంచి December (12) → current year + next year
// January (1) నుంచి April (4) → previous year + current year
// May (5) → previous educational year (holidays)
function getEducationalYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    if (month >= 6) {
        // June to December
        return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
        // January to May
        return `${year - 1}-${year.toString().slice(-2)}`;
    }
}

// =====================================================
// DATE HELPERS (used across all pages)
// =====================================================

// Returns: "2026-10-23" (Firestore-safe)
function getTodayDateStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Returns: "23-10-2026" (display)
function getTodayDisplayDate() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const y = d.getFullYear();
    return `${day}-${m}-${y}`;
}

// Returns: "October 2026" (month name for attendance C2 doc)
function getMonthName() {
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    return months[new Date().getMonth()];
}

// Returns: "10:30 AM" (time display)
function getCurrentTimeStr() {
    const d = new Date();
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

// =====================================================
// ANONYMOUS AUTH — Crash-Proof
// =====================================================
let auth = null;
let authReady = Promise.resolve(false);

if (typeof firebase.auth === 'function') {
    try {
        auth = firebase.auth();
        authReady = auth.signInAnonymously()
            .then(() => {
                console.log("✅ Firebase Auth: Anonymous login successful!");
                return true;
            })
            .catch((error) => {
                console.warn("⚠️ Anonymous Auth failed:", error.code || error.message);
                return false;
            });
    } catch (err) {
        console.warn("⚠️ Firebase Auth init error:", err.message);
        authReady = Promise.resolve(false);
    }
} else {
    console.warn("⚠️ firebase-auth-compat.js NOT loaded. Auth disabled.");
}

// =====================================================
// EXPOSE FOR DEBUGGING (Optional)
// =====================================================
window.DM = {
    db,
    auth,
    authReady,
    VALIASS_PHONE,
    getEducationalYear,
    getTodayDateStr,
    getTodayDisplayDate,
    getMonthName,
    getCurrentTimeStr
};
