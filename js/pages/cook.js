// js/pages/cook.js

let currentScreen = 'login';
let currentCook = null;

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
        const app = document.getElementById('cookApp');
        if (splash) splash.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        setTimeout(() => splash && splash.remove(), 500);
        await decideScreen();
    }, 1200);

    bindEvents();
});

// =====================================================
// SCREEN DECISION
// =====================================================
async function decideScreen() {
    try {
        if (typeof authReady !== 'undefined') {
            await Promise.race([
                authReady,
                new Promise(resolve => setTimeout(resolve, 3000))
            ]);
        }

        const session = localStorage.getItem('dm_cook_session');
        if (session) {
            const s = JSON.parse(session);
            currentCook = s;
            await loadCookData();
            showScreen('dashboard');
            return;
        }

        const schoolDoc = await db.collection('schoolInfo').doc('main').get();
        if (!schoolDoc.exists || !schoolDoc.data().isSetupComplete) {
            UI.toast('⚠️ పాఠశాల సెటప్ పూర్తి కాలేదు. హెడ్‌మాస్టర్‌ని సంప్రదించండి.', 'warning', 5000);
            showScreen('login');
            return;
        }

        if (schoolDoc.data().sections?.cook !== true) {
            UI.toast('⚠️ Cook సెక్షన్ ఇంకా ఎనేబుల్ చేయలేదు.', 'warning', 5000);
            showScreen('login');
            return;
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
    ['login', 'dashboard'].forEach(s => {
        const el = document.getElementById('screen' + capitalize(s));
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('screen' + capitalize(name));
    if (target) target.classList.remove('hidden');

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        if (name === 'dashboard') backBtn.classList.remove('hidden');
        else backBtn.classList.add('hidden');
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        if (name === 'login') logoutBtn.classList.add('hidden');
        else logoutBtn.classList.remove('hidden');
    }

    const title = document.getElementById('pageTitle');
    if (title) {
        title.textContent = name === 'login' ? 'Cook Login' : 'Cook Dashboard';
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
            if (currentScreen === 'dashboard') window.location.href = 'index.html';
            else showScreen('login');
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('లాగౌట్ చేయాలా?')) {
                localStorage.removeItem('dm_cook_session');
                window.location.href = 'index.html';
            }
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

    const phoneInput = document.getElementById('cookPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', () => {
            phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
        });
    }

    const pinInput = document.getElementById('cookPin');
    if (pinInput) {
        pinInput.addEventListener('input', () => {
            pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
        });
    }

    const loginForm = document.getElementById('cookLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleCookLogin();
        });
    }
}

// =====================================================
// COOK LOGIN
// =====================================================
async function handleCookLogin() {
    const phone = document.getElementById('cookPhone').value.trim();
    const pin = document.getElementById('cookPin').value;
    const errorEl = document.getElementById('cookLoginError');
    const btn = document.getElementById('cookLoginBtn');

    if (!/^\d{10}$/.test(phone)) return showFormError(errorEl, '10 అంకెల ఫోన్ నంబర్ నింపండి.');
    if (!/^\d{4}$/.test(pin)) return showFormError(errorEl, 'Master PIN 4 అంకెలు ఉండాలి.');

    btn.disabled = true;
    btn.textContent = 'లాగిన్ అవుతోంది...';
    hideFormError(errorEl);

    try {
        const snapshot = await db.collection('users')
            .where('phone', '==', phone)
            .where('role', '==', 'cook')
            .limit(1)
            .get();

        if (snapshot.empty) {
            return showFormError(errorEl, '❌ ఈ ఫోన్ నంబర్ కనుగొనబడలేదు. HM ని సంప్రదించండి.');
        }

        const cookDoc = snapshot.docs[0];
        const cookData = cookDoc.data();

        if (cookData.isActive === false) {
            return showFormError(errorEl, '🔒 మీ ఖాతా నిలిపివేయబడింది. HM ని సంప్రదించండి.');
        }

        const storedPin = String(cookData.masterPin || '').trim();
        if (storedPin !== pin) {
            return showFormError(errorEl, '❌ తప్పు Master PIN.');
        }

        currentCook = {
            id: cookDoc.id,
            name: cookData.name || 'Cook',
            phone: cookData.phone,
            role: 'cook'
        };
        localStorage.setItem('dm_cook_session', JSON.stringify(currentCook));

        UI.toast('✅ Login విజయవంతమైంది!', 'success');
        await loadCookData();
        showScreen('dashboard');
    } catch (error) {
        console.error('Login error:', error);
        showFormError(errorEl, 'నెట్‌వర్క్ లోపం. మళ్లీ ప్రయత్నించండి.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'లాగిన్';
    }
}

// =====================================================
// LOAD COOK DATA
// =====================================================
async function loadCookData() {
    if (!currentCook) return;

    document.getElementById('cookWelcomeName').textContent = currentCook.name || '—';
    document.getElementById('cookWelcomePhone').textContent = currentCook.phone || '—';

    await loadTodayMenu();
}

// =====================================================
// LOAD TODAY'S MENU
// =====================================================
async function loadTodayMenu() {
    const container = document.getElementById('todayMenu');
    const dateEl = document.getElementById('menuDate');

    if (container) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: var(--space-sm);">లోడ్ అవుతోంది...</p>`;
    }

    try {
        // Today's date in YYYY-MM-DD
        const today = new Date();
        const dateStr = today.getFullYear() + '-' +
                        String(today.getMonth() + 1).padStart(2, '0') + '-' +
                        String(today.getDate()).padStart(2, '0');

        if (dateEl) {
            dateEl.textContent = `📅 ${dateStr}`;
        }

        // Try to get today's menu
        const menuDoc = await db.collection('menu').doc(dateStr).get();

        if (!menuDoc.exists) {
            // No menu for today — show default weekly menu
            renderDefaultMenu(container);
            return;
        }

        const menuData = menuDoc.data();
        renderMenu(container, menuData, dateStr);
    } catch (error) {
        console.error('Load menu error:', error);
        renderDefaultMenu(container);
    }
}

// =====================================================
// RENDER MENU
// =====================================================
function renderMenu(container, menuData, dateStr) {
    const meals = [
        { key: 'breakfast', icon: '🌅', label: 'Breakfast (అల్పాహారం)', time: '7:30 AM' },
        { key: 'lunch', icon: '☀️', label: 'Lunch (మధ్యాహ్న భోజనం)', time: '12:00 PM' },
        { key: 'snacks', icon: '🍪', label: 'Snacks (అల్పాహారం)', time: '4:00 PM' }
    ];

    let html = '';

    meals.forEach(meal => {
        const items = menuData[meal.key];
        if (items && items.length > 0) {
            html += `
                <div style="background: var(--bg-color); padding: var(--space-md); border-radius: var(--radius-md); margin-bottom: var(--space-sm); border-left: 4px solid #F57C00;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm);">
                        <h4 style="font-size: 0.95rem; font-weight: 700;">${meal.icon} ${meal.label}</h4>
                        <span style="font-size: 0.7rem; color: var(--text-muted);">${meal.time}</span>
                    </div>
                    <ul style="list-style: none; padding: 0; margin: 0;">
                        ${items.map(item => `
                            <li style="padding: 6px 0; font-size: 0.9rem; border-bottom: 1px solid var(--border-color);">
                                🍽️ ${escapeHtml(item)}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
    });

    if (!html) {
        html = `
            <div style="text-align: center; padding: var(--space-lg); color: var(--text-muted);">
                <i class="fas fa-utensils" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: var(--space-sm);"></i>
                <p style="font-size: 0.9rem;">ఈరోజు మెనూ ఇంకా సెట్ చేయలేదు</p>
                <p style="font-size: 0.75rem; margin-top: 4px;">HM ని సంప్రదించండి</p>
            </div>
        `;
    }

    container.innerHTML = html;
}

// =====================================================
// DEFAULT WEEKLY MENU
// =====================================================
function renderDefaultMenu(container) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[new Date().getDay()];

    const weeklyMenus = {
        Monday: {
            breakfast: ['Idli', 'Sambar', 'Chutney'],
            lunch: ['Rice', 'Dal', 'Vegetable Curry', 'Curd'],
            snacks: ['Biscuits', 'Milk']
        },
        Tuesday: {
            breakfast: ['Dosa', 'Chutney'],
            lunch: ['Rice', 'Sambar', 'Leafy Greens', 'Buttermilk'],
            snacks: ['Banana', 'Biscuits']
        },
        Wednesday: {
            breakfast: ['Pongal', 'Chutney'],
            lunch: ['Rice', 'Dal', 'Potato Curry', 'Curd'],
            snacks: ['Biscuits', 'Milk']
        },
        Thursday: {
            breakfast: ['Upma', 'Chutney'],
            lunch: ['Rice', 'Sambar', 'Vegetable Fry', 'Curd'],
            snacks: ['Fruit', 'Biscuits']
        },
        Friday: {
            breakfast: ['Idli', 'Sambar'],
            lunch: ['Rice', 'Dal', 'Egg Curry', 'Curd'],
            snacks: ['Milk', 'Biscuits']
        },
        Saturday: {
            breakfast: ['Dosa', 'Chutney'],
            lunch: ['Rice', 'Sambar', 'Vegetable Curry', 'Curd'],
            snacks: ['Banana']
        },
        Sunday: {
            breakfast: ['Upma'],
            lunch: ['Rice', 'Dal', 'Vegetable Curry'],
            snacks: ['Biscuits']
        }
    };

    const menu = weeklyMenus[dayName] || weeklyMenus.Monday;

    renderMenu(container, menu, dayName);
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
