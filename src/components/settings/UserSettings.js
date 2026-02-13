// ========================================
// Kullanıcı Ayarları Bileşeni
// ========================================

import { getState, setState } from '../../utils/state.js';
import { updateUserProfile, logout, changePassword } from '../../services/auth.js';
import { AVATAR_EMOJIS } from '../../utils/helpers.js';

/**
 * PTT tuş kodunu kullanıcıya gösterilecek güzel isme çevir
 */
function getPTTKeyName() {
    const key = localStorage.getItem('pttKey') || 'Space';
    const keyNames = {
        'Space': 'Space',
        'ControlLeft': 'Sol Ctrl',
        'ControlRight': 'Sağ Ctrl',
        'ShiftLeft': 'Sol Shift',
        'ShiftRight': 'Sağ Shift',
        'AltLeft': 'Sol Alt',
        'AltRight': 'Sağ Alt',
        'CapsLock': 'Caps Lock',
        'Tab': 'Tab',
        'Backquote': '`',
        'Escape': 'ESC'
    };
    return keyNames[key] || key.replace('Key', '').replace('Digit', '');
}


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
                    <button class="settings-nav-item" data-tab="voice">Ses & Video</button>
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
            else if (tab === 'voice') renderVoiceTab();
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
                    <div class="profile-avatar-large" id="profileAvatar">
                        ${user.photoURL ? `<img src="${user.photoURL}" class="avatar-image" alt="Profil" />` : (user.avatar || '😀')}
                    </div>
                    <div>
                        <div class="profile-username">${user.displayName}</div>
                        <div class="profile-tag">${user.email}</div>
                        <button class="profile-photo-btn" id="changeProfilePhoto">📷 Profil Resmi Değiştir</button>
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

    // Profil resmi değiştir
    document.getElementById('changeProfilePhoto')?.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png,image/jpeg,image/gif,image/webp';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    alert('Profil resmi 5MB\'ı aşamaz!');
                    fileInput.remove();
                    return;
                }
                document.dispatchEvent(new CustomEvent('uploadProfileImage', {
                    detail: { file }
                }));
                // Önizleme göster
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const profileAvatar = document.getElementById('profileAvatar');
                    if (profileAvatar) {
                        profileAvatar.innerHTML = `<img src="${ev.target.result}" class="avatar-image" alt="Profil" />`;
                    }
                };
                reader.readAsDataURL(file);
            }
            fileInput.remove();
        });

        fileInput.click();
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

        <div class="settings-section-title" style="margin-top: 24px;">Kullanıcı Adı Değiştir</div>
        <div class="profile-card">
            <div class="profile-card-body" style="padding-top: 24px;">
                <div class="setting-row" style="flex-direction: column; align-items: stretch;">
                    <div class="setting-label">Yeni Kullanıcı Adı</div>
                    <input type="text" id="newDisplayName" class="settings-input" placeholder="${user.displayName}" value="${user.displayName}" maxlength="32" />
                </div>
                <div class="setting-row" style="gap: 10px;">
                    <button class="settings-save-btn" id="changeNameBtn">Adı Kaydet</button>
                    <div class="settings-status" id="nameStatus"></div>
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

    // Hesap adı değiştirme
    document.getElementById('changeNameBtn')?.addEventListener('click', () => {
        const newName = document.getElementById('newDisplayName')?.value;
        const status = document.getElementById('nameStatus');
        if (!newName || !newName.trim() || newName.trim().length < 2) {
            if (status) { status.textContent = 'Ad en az 2 karakter olmalı!'; status.style.color = 'var(--error)'; }
            return;
        }
        if (status) { status.textContent = 'Kaydediliyor...'; status.style.color = 'var(--text-muted)'; }
        document.dispatchEvent(new CustomEvent('changeDisplayName', {
            detail: { newName: newName.trim() }
        }));
        setTimeout(() => {
            if (status) { status.textContent = '✅ Ad başarıyla değiştirildi!'; status.style.color = 'var(--success)'; }
        }, 500);
    });

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

function renderVoiceTab() {
    const content = document.getElementById('settingsTabContent');
    if (!content) return;

    const voiceMode = localStorage.getItem('voiceMode') || 'auto';
    const sensitivity = localStorage.getItem('voiceSensitivity') || '25';
    const echoCancellation = localStorage.getItem('echoCancellation') !== 'false';
    const noiseSuppression = localStorage.getItem('noiseSuppression') !== 'false';
    const autoGainControl = localStorage.getItem('autoGainControl') !== 'false';

    content.innerHTML = `
        <div class="settings-section-title">Ses & Video</div>
        
        <div class="setting-row">
            <div>
                <div class="setting-label">Ses Giriş Modu</div>
                <div class="setting-desc">Mikrofon aktivasyonu yöntemi</div>
            </div>
        </div>

        <div class="voice-mode-picker" id="voiceModePicker">
            <button class="voice-mode-option ${voiceMode === 'auto' ? 'selected' : ''}" data-mode="auto">
                <span class="voice-mode-icon">🎙️</span>
                <div>
                    <div class="voice-mode-title">Ses Aktivasyonu</div>
                    <div class="voice-mode-desc">Konuştuğunuzda otomatik açılır</div>
                </div>
            </button>
            <button class="voice-mode-option ${voiceMode === 'ptt' ? 'selected' : ''}" data-mode="ptt">
                <span class="voice-mode-icon">⌨️</span>
                <div>
                    <div class="voice-mode-title">Tuşla Yakala</div>
                    <div class="voice-mode-desc">Tuşa bastığınızda aktif olur</div>
                </div>
            </button>
        </div>

        ${voiceMode === 'auto' ? `
            <div class="setting-row" style="margin-top: 16px;">
                <div style="width:100%">
                    <div class="setting-label">Ses Algılama Eşiği</div>
                    <div class="setting-desc">Düşük değer = daha hassas algılama</div>
                    <div class="sensitivity-slider-container">
                        <span>🔇</span>
                        <input type="range" class="sensitivity-slider" id="sensitivitySlider" min="5" max="80" value="${sensitivity}" />
                        <span>🔊</span>
                        <span class="sensitivity-value" id="sensitivityValue">${sensitivity}</span>
                    </div>
                </div>
            </div>
        ` : `
            <div class="setting-row" style="margin-top: 16px;">
                <div>
                    <div class="setting-label">Tuşla Yakala Tuşu</div>
                    <div class="setting-desc">Tıklayıp yeni tuş seçin</div>
                </div>
                <button class="ptt-key-badge" id="pttKeyBadge" title="Tıklayıp yeni tuş seçin">${getPTTKeyName()}</button>
            </div>
        `}

        <div class="settings-section-title" style="margin-top: 24px;">Ses İşleme</div>
        
        <div class="setting-row">
            <div>
                <div class="setting-label">Eko İptali</div>
                <div class="setting-desc">Hoparlör yankısını engeller</div>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" id="echoCancelToggle" ${echoCancellation ? 'checked' : ''} />
                <span class="toggle-slider"></span>
            </label>
        </div>

        <div class="setting-row">
            <div>
                <div class="setting-label">Gürültü Bastırma</div>
                <div class="setting-desc">Arka plan gürültüsünü azaltır</div>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" id="noiseSuppressionToggle" ${noiseSuppression ? 'checked' : ''} />
                <span class="toggle-slider"></span>
            </label>
        </div>

        <div class="setting-row">
            <div>
                <div class="setting-label">Otomatik Kazanç</div>
                <div class="setting-desc">Ses seviyesini otomatik ayarlar</div>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" id="autoGainToggle" ${autoGainControl ? 'checked' : ''} />
                <span class="toggle-slider"></span>
            </label>
        </div>
    `;

    // Voice mode seçimi
    document.getElementById('voiceModePicker')?.addEventListener('click', (e) => {
        const option = e.target.closest('.voice-mode-option');
        if (!option) return;
        const mode = option.dataset.mode;
        localStorage.setItem('voiceMode', mode);
        // Voice modunu değiştir event'i dispatch et
        document.dispatchEvent(new CustomEvent('voiceModeSwitched', {
            detail: { mode }
        }));
        renderVoiceTab(); // Yeniden render
    });

    // PTT tuş seçme
    document.getElementById('pttKeyBadge')?.addEventListener('click', function () {
        const badge = this;
        badge.textContent = 'Tuşa basın...';
        badge.classList.add('recording');

        const keyListener = (e) => {
            e.preventDefault();
            e.stopPropagation();
            localStorage.setItem('pttKey', e.code);
            badge.textContent = getPTTKeyName();
            badge.classList.remove('recording');
            document.removeEventListener('keydown', keyListener);
            // PTT'yi yeni tuşla yeniden aktif et
            document.dispatchEvent(new CustomEvent('voiceModeSwitched', {
                detail: { mode: 'ptt' }
            }));
        };
        document.addEventListener('keydown', keyListener);
    });

    // Sensitivity slider
    document.getElementById('sensitivitySlider')?.addEventListener('input', (e) => {
        const val = e.target.value;
        document.getElementById('sensitivityValue').textContent = val;
        localStorage.setItem('voiceSensitivity', val);
    });

    // Toggle'lar
    document.getElementById('echoCancelToggle')?.addEventListener('change', (e) => {
        localStorage.setItem('echoCancellation', e.target.checked);
    });
    document.getElementById('noiseSuppressionToggle')?.addEventListener('change', (e) => {
        localStorage.setItem('noiseSuppression', e.target.checked);
    });
    document.getElementById('autoGainToggle')?.addEventListener('change', (e) => {
        localStorage.setItem('autoGainControl', e.target.checked);
    });
}

export function closeSettings() {
    const overlay = document.getElementById('settingsOverlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(() => overlay.remove(), 200);
    }
    setState('ui.showSettings', false);
}
