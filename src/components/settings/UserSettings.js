// ========================================
// Kullanıcı Ayarları Bileşeni
// ========================================

import { getState, setState } from '../../utils/state.js';
import { updateUserProfile, logout, changePassword } from '../../services/auth.js';
import { AVATAR_EMOJIS } from '../../utils/helpers.js';

export function renderSettings() {
    const user = getState('user');
    if (!user) return;

    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay';
    overlay.id = 'settingsOverlay';

    overlay.innerHTML = `
        <div class="settings-container">
            <div class="settings-nav">
                <div class="settings-nav-inner">
                    <div class="settings-nav-title">Kullanıcı Ayarları</div>
                    <button class="settings-nav-item active" data-tab="profile">Profilim</button>
                    <button class="settings-nav-item" data-tab="account">Hesap</button>
                    <div class="settings-nav-separator"></div>
                    <div class="settings-nav-title">Uygulama Ayarları</div>
                    <button class="settings-nav-item" data-tab="appearance">Görünüm</button>
                    <div class="settings-nav-separator"></div>
                    <button class="settings-nav-item danger" id="settingsLogout">Çıkış Yap</button>
                </div>
            </div>
            
            <div class="settings-content">
                <button class="settings-close" id="settingsClose">✕</button>
                <div id="settingsTabContent"></div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // İlk tab'ı render et
    renderProfileTab();

    // Event listener'lar
    document.getElementById('settingsClose').addEventListener('click', closeSettings);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeSettings();
    });

    // Tab navigasyonu
    overlay.querySelectorAll('.settings-nav-item[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            overlay.querySelectorAll('.settings-nav-item').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.tab;
            if (tab === 'profile') renderProfileTab();
            else if (tab === 'account') renderAccountTab();
            else if (tab === 'appearance') renderAppearanceTab();
        });
    });

    // Çıkış yap
    document.getElementById('settingsLogout')?.addEventListener('click', async () => {
        closeSettings();
        await logout();
    });

    // ESC ile kapat
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closeSettings();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

function renderProfileTab() {
    const user = getState('user');
    const content = document.getElementById('settingsTabContent');
    if (!content) return;

    const avatarsHtml = AVATAR_EMOJIS.map(emoji =>
        `<div class="avatar-option ${user.avatar === emoji ? 'selected' : ''}" data-emoji="${emoji}">${emoji}</div>`
    ).join('');

    content.innerHTML = `
        <div class="settings-section-title">Profilim</div>
        
        <div class="profile-card">
            <div class="profile-banner"></div>
            <div class="profile-card-body">
                <div class="profile-avatar-section">
                    <div class="profile-avatar-large" id="profileAvatar">${user.avatar || '😀'}</div>
                    <div>
                        <div class="profile-username">${user.displayName}</div>
                        <div class="profile-tag">${user.email}</div>
                    </div>
                </div>
                
                <div class="setting-row">
                    <div>
                        <div class="setting-label">Kullanıcı Adı</div>
                        <div class="setting-value">${user.displayName}</div>
                    </div>
                </div>
                
                <div class="setting-row">
                    <div>
                        <div class="setting-label">E-posta</div>
                        <div class="setting-value">${user.email}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 24px;">
            <div class="settings-section-title">Avatar Değiştir</div>
            <div class="avatar-picker" id="settingsAvatarPicker">
                ${avatarsHtml}
            </div>
        </div>
        
        <div style="margin-top: 24px;">
            <div class="settings-section-title">Durum</div>
            <div class="status-picker" id="statusPicker">
                <div class="status-option ${user.status === 'online' ? 'selected' : ''}" data-status="online">
                    <div class="status-dot-picker online"></div>
                    Çevrimiçi
                </div>
                <div class="status-option ${user.status === 'idle' ? 'selected' : ''}" data-status="idle">
                    <div class="status-dot-picker idle"></div>
                    Boşta
                </div>
                <div class="status-option ${user.status === 'dnd' ? 'selected' : ''}" data-status="dnd">
                    <div class="status-dot-picker dnd"></div>
                    Rahatsız Etmeyin
                </div>
                <div class="status-option ${user.status === 'offline' ? 'selected' : ''}" data-status="offline">
                    <div class="status-dot-picker offline"></div>
                    Görünmez
                </div>
            </div>
        </div>
    `;

    // Avatar değiştirme
    document.getElementById('settingsAvatarPicker')?.addEventListener('click', async (e) => {
        const option = e.target.closest('.avatar-option');
        if (!option) return;

        document.querySelectorAll('#settingsAvatarPicker .avatar-option').forEach(el => el.classList.remove('selected'));
        option.classList.add('selected');

        const newAvatar = option.dataset.emoji;
        await updateUserProfile(user.uid, { avatar: newAvatar });
        setState('user', { ...getState('user'), avatar: newAvatar });

        const profileAvatar = document.getElementById('profileAvatar');
        if (profileAvatar) profileAvatar.textContent = newAvatar;

        const sidebarAvatar = document.getElementById('sidebarAvatar');
        if (sidebarAvatar) sidebarAvatar.textContent = newAvatar;
    });

    // Durum değiştirme
    document.getElementById('statusPicker')?.addEventListener('click', async (e) => {
        const option = e.target.closest('.status-option');
        if (!option) return;

        document.querySelectorAll('.status-option').forEach(el => el.classList.remove('selected'));
        option.classList.add('selected');

        const newStatus = option.dataset.status;
        await updateUserProfile(user.uid, { status: newStatus });
        setState('user', { ...getState('user'), status: newStatus });
    });
}

function renderAccountTab() {
    const user = getState('user');
    const content = document.getElementById('settingsTabContent');
    if (!content) return;

    content.innerHTML = `
        <div class="settings-section-title">Hesap</div>
        <div class="profile-card">
            <div class="profile-card-body" style="padding-top: 24px;">
                <div class="setting-row">
                    <div>
                        <div class="setting-label">E-posta</div>
                        <div class="setting-value">${user.email}</div>
                    </div>
                </div>
                <div class="setting-row">
                    <div>
                        <div class="setting-label">Arkadaş Kodu</div>
                        <div class="setting-value" style="color: var(--accent-primary); font-weight: 700; letter-spacing: 2px;">#${user.friendCode || '...'}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="settings-section-title" style="margin-top: 24px;">Şifre Değiştir</div>
        <div class="profile-card">
            <div class="profile-card-body" style="padding-top: 24px;">
                <div class="setting-row" style="flex-direction: column; align-items: stretch;">
                    <input type="password" id="currentPassword" class="settings-input" placeholder="Mevcut şifre" autocomplete="current-password">
                </div>
                <div class="setting-row" style="flex-direction: column; align-items: stretch;">
                    <input type="password" id="newPassword" class="settings-input" placeholder="Yeni şifre (en az 6 karakter)" autocomplete="new-password">
                </div>
                <div class="setting-row" style="flex-direction: column; align-items: stretch;">
                    <input type="password" id="confirmPassword" class="settings-input" placeholder="Yeni şifre tekrar" autocomplete="new-password">
                </div>
                <div class="setting-row" style="gap: 10px;">
                    <button class="settings-save-btn" id="changePasswordBtn">Şifreyi Değiştir</button>
                    <div class="settings-status" id="passwordStatus"></div>
                </div>
            </div>
        </div>

        <div class="settings-section-title" style="margin-top: 24px; color: var(--error);">Tehlikeli Bölge</div>
        <div class="profile-card">
            <div class="profile-card-body" style="padding-top: 16px;">
                <div class="setting-row">
                    <div>
                        <div class="setting-label">Çıkış Yap</div>
                        <div class="setting-value">Hesabından güvenli çıkış yap</div>
                    </div>
                    <button class="settings-danger-btn" id="logoutBtn">Çıkış</button>
                </div>
            </div>
        </div>
    `;

    // Şifre değiştirme
    document.getElementById('changePasswordBtn')?.addEventListener('click', async () => {
        const current = document.getElementById('currentPassword')?.value;
        const newPass = document.getElementById('newPassword')?.value;
        const confirm = document.getElementById('confirmPassword')?.value;
        const status = document.getElementById('passwordStatus');

        if (!current || !newPass || !confirm) {
            if (status) { status.textContent = 'Tüm alanları doldurun!'; status.style.color = 'var(--error)'; }
            return;
        }
        if (newPass !== confirm) {
            if (status) { status.textContent = 'Yeni şifreler eşleşmiyor!'; status.style.color = 'var(--error)'; }
            return;
        }
        if (newPass.length < 6) {
            if (status) { status.textContent = 'Yeni şifre en az 6 karakter!'; status.style.color = 'var(--error)'; }
            return;
        }

        if (status) { status.textContent = 'Değiştiriliyor...'; status.style.color = 'var(--text-muted)'; }

        const result = await changePassword(current, newPass);
        if (result.success) {
            if (status) { status.textContent = '✅ Şifre başarıyla değiştirildi!'; status.style.color = 'var(--success)'; }
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            if (status) { status.textContent = `❌ ${result.error}`; status.style.color = 'var(--error)'; }
        }
    });

    // Çıkış
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await logout();
        closeSettings();
        location.reload();
    });
}


function renderAppearanceTab() {
    const content = document.getElementById('settingsTabContent');
    if (!content) return;

    content.innerHTML = `
        <div class="settings-section-title">Görünüm</div>
        <div class="profile-card">
            <div class="profile-card-body" style="padding-top: 24px;">
                <div class="setting-row">
                    <div>
                        <div class="setting-label">Tema</div>
                        <div class="setting-value">Koyu (Varsayılan)</div>
                    </div>
                </div>
                <div class="setting-row">
                    <div>
                        <div class="setting-label">Yazı Boyutu</div>
                        <div class="setting-value">Normal</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function closeSettings() {
    const overlay = document.getElementById('settingsOverlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(() => overlay.remove(), 200);
    }
    setState('ui.showSettings', false);
}
