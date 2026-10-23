// js/ui.js — Digital Manabadi v12.0 (Full updated)
// Changes: VALIASS_PHONE from config, Red dot logic, Auto logoff,
//          Logout confirm, Modal helpers, setInterval removed,
//          Splash hide, BackUrl support.

const UI = {

    // =====================================================
    // INIT LAYOUT
    // =====================================================
    initLayout: function() {
        this.refreshHeader();
        this.renderFooter();
        this.initAutoBackButton();
        this.initPWA();
    },

    // =====================================================
    // AUTO BACK BUTTON (with backUrl support)
    // =====================================================
    // Usage: UI.initAutoBackButton('hm-dashboard.html') — optional
    // Default: index.html
    initAutoBackButton: function(backUrl) {
        const header = document.querySelector('.app-header');
        if (!header) return;

        const currentPath = window.location.pathname;
        const isHomePage = currentPath.endsWith('index.html') || currentPath === '/' || currentPath.endsWith('/');
        if (isHomePage) return;

        // పాత బటన్ తీసేయి
        const existingBackBtn = header.querySelector('.auto-back-btn');
        if (existingBackBtn) existingBackBtn.remove();

        const backBtn = document.createElement('button');
        backBtn.className = 'icon-btn back-btn auto-back-btn';
        backBtn.setAttribute('aria-label', 'Back');
        backBtn.setAttribute('title', 'వెనక్కి');
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';

        // ✅ backUrl ఉంటే అక్కడికి, లేకపోతే index.html
        backBtn.addEventListener('click', () => {
            const target = backUrl || 'index.html';
            window.location.href = target;
        });

        header.insertBefore(backBtn, header.firstChild);
    },

    // =====================================================
    // HEADER (Dynamic)
    // =====================================================
    refreshHeader: function() {
        const header = document.getElementById('app-header');
        if (!header) return;

        const session = localStorage.getItem('dm_session');
        const isLoggedIn = !!session;
        const currentTheme = document.body.getAttribute('data-theme') || 'light';
        const themeIconClass = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

        if (!isLoggedIn) {
            header.innerHTML = `
                <div class="header-left">
                    <i class="fas fa-school" style="color: var(--primary); font-size: 1.4rem;"></i>
                </div>
                <div class="header-title" style="color: var(--primary);">MPMP School - Dagguluru</div>
                <div class="header-right">
                    <button class="header-btn" onclick="UI.toggleTheme()" aria-label="Theme">
                        <i class="${themeIconClass}" id="header-theme-icon"></i>
                    </button>
                </div>
            `;
        } else {
            const data = JSON.parse(session);
            const displayName = data.displayRole || data.role || 'User';
            header.innerHTML = `
                <div class="header-left">
                    <button class="header-btn" onclick="history.back()" aria-label="Back">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                </div>
                <div class="header-title">${displayName}</div>
                <div class="header-right">
                    <button class="header-btn" onclick="UI.confirmLogout()" aria-label="Logout">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            `;
        }
    },

    // =====================================================
    // LOGOUT (Confirm)
    // =====================================================
    confirmLogout: function() {
        if (confirm('Logout అవ్వాలా?')) {
            if (typeof Auth !== 'undefined' && Auth.logout) {
                Auth.logout();
            } else {
                localStorage.removeItem('dm_session');
                window.location.href = 'index.html';
            }
        }
    },

    // =====================================================
    // LOGIN PAGE — Auto Logoff on Back
    // =====================================================
    // Usage: login pages లో initLayout() తర్వాత call చేయాలి
    initLoginBackLogout: function() {
        const header = document.querySelector('.app-header');
        if (!header) return;
        const backBtn = header.querySelector('.auto-back-btn');
        if (backBtn) {
            // existing listener ఉంటుంది — replace చేయి
            backBtn.replaceWith(backBtn.cloneNode(true));
            const newBackBtn = header.querySelector('.auto-back-btn');
            newBackBtn.addEventListener('click', () => {
                localStorage.removeItem('dm_session');
                window.location.href = 'index.html';
            });
        }
    },

    // =====================================================
    // FOOTER
    // =====================================================
    renderFooter: function() {
        const footer = document.getElementById('app-footer');
        if (!footer) return;
        footer.innerHTML = `An initiative of <span class="valiass-link" onclick="UI.showContact()">@valiass</span> team`;
    },

    // =====================================================
    // CONTACT MODAL (Valiass)
    // =====================================================
    showContact: function() {
        let modal = document.getElementById('contact-modal');
        if (!modal) {
            // ✅ config.js నుంచి phone వాడు (hardcode కాదు)
            const phone = (typeof VALIASS_PHONE !== 'undefined') ? VALIASS_PHONE : '918985361991';
            const displayPhone = phone.startsWith('91') ? '+91 ' + phone.slice(2) : phone;

            modal = document.createElement('div');
            modal.id = 'contact-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="text-align: center; padding-bottom: var(--space-xl); position: relative;">
                    <h3 style="color: var(--primary); margin-bottom: 4px;">Contact Valiass Team</h3>
                    <p style="color: var(--text-muted); font-weight: 600; font-size: 1.1rem; margin-bottom: var(--space-lg);">${displayPhone}</p>
                    <div style="display: flex; gap: var(--space-md); justify-content: center; margin-bottom: var(--space-lg);">
                        <a href="tel:${phone}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--surface);border:2px solid var(--primary);color:var(--primary);padding:16px;border-radius:var(--radius-lg);text-decoration:none;width:120px;">
                            <i class="fas fa-phone-alt" style="font-size:2rem;margin-bottom:8px;"></i>
                            <span style="font-weight:600;">Call</span>
                        </a>
                        <a href="https://wa.me/${phone}" target="_blank" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:#25D366;border:2px solid #25D366;color:white;padding:16px;border-radius:var(--radius-lg);text-decoration:none;width:120px;">
                            <i class="fab fa-whatsapp" style="font-size:2.2rem;margin-bottom:6px;"></i>
                            <span style="font-weight:600;">WhatsApp</span>
                        </a>
                    </div>
                    <button class="btn btn-outline" style="border:none;color:var(--text-muted);" onclick="UI.closeModal('contact-modal')">Cancel</button>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        }
        setTimeout(() => modal.classList.add('active'), 10);
    },

    // =====================================================
    // MODAL HELPERS (Generic)
    // =====================================================
    openModal: function(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
    },

    closeModal: function(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    },

    // =====================================================
    // THEME TOGGLE
    // =====================================================
    toggleTheme: function() {
        const currentTheme = document.body.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('dm_theme', newTheme);

        const newIconClass = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        const headerIcon = document.getElementById('header-theme-icon');
        const bottomIcon = document.getElementById('theme-icon');
        if (headerIcon) headerIcon.className = newIconClass;
        if (bottomIcon) bottomIcon.className = newIconClass;
    },

    // =====================================================
    // FONT SIZE
    // =====================================================
    changeFontSize: function(action) {
        let currentSize = parseInt(localStorage.getItem('dm_font_size') || '16');
        if (action === 'increase' && currentSize < 22) currentSize += 2;
        if (action === 'decrease' && currentSize > 12) currentSize -= 2;
        document.documentElement.style.setProperty('--base-font-size', currentSize + 'px');
        localStorage.setItem('dm_font_size', currentSize);
        this.toast(`ఫాంట్ సైజ్: ${currentSize}px`, 'info', 1500);
    },

    // =====================================================
    // RED DOT — Unread Notice (Local Storage)
    // =====================================================
    // Usage: page లో notice board render అయ్యాక —
    //   UI.hasUnreadNotices(latestNoticeTimeISO) → true/false
    // Notice board open అయినప్పుడు —
    //   UI.markNoticesRead()
    hasUnreadNotices: function(latestNoticeTimeISO) {
        if (!latestNoticeTimeISO) return false;
        const lastRead = localStorage.getItem('dm_lastReadNoticeTime') || '0';
        return new Date(latestNoticeTimeISO) > new Date(lastRead);
    },

    markNoticesRead: function() {
        localStorage.setItem('dm_lastReadNoticeTime', new Date().toISOString());
    },

    // =====================================================
    // TOAST
    // =====================================================
    toast: function(message, type = 'info', duration = 3000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-text"></span>`;
        toast.querySelector('.toast-text').textContent = message;
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // =====================================================
    // SPLASH HIDE
    // =====================================================
    hideSplash: function() {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('hidden');
            setTimeout(() => splash.remove(), 500);
        }
    },

    // =====================================================
    // PWA INSTALL
    // =====================================================
    initPWA: function() {
        let deferredPrompt;
        const installBtn = document.getElementById('install-app-btn');

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            if (installBtn) installBtn.style.display = 'inline-flex';
        });

        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') installBtn.style.display = 'none';
                    deferredPrompt = null;
                }
            });
        }

        window.addEventListener('appinstalled', () => {
            if (installBtn) installBtn.style.display = 'none';
        });
    }
};
