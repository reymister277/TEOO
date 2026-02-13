// ========================================
// Sunucu Oluştur / Katıl Modal
// ========================================

const SERVER_ICONS = ['🎮', '🎵', '🎬', '📚', '💻', '🏆', '🎯', '🔥', '⚡', '🌟', '🎨', '🎲', '🏰', '⚔️', '🛡️', '🐉'];

export function renderServerModal(mode = 'create') {
    // Önceki modali kaldır
    const existing = document.getElementById('serverModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'serverModal';
    modal.className = 'server-modal-overlay';
    modal.innerHTML = `
        <div class="server-modal">
            <button class="server-modal-close" id="closeServerModal">✕</button>
            
            ${mode === 'choose' ? renderChooseMode() : ''}
            ${mode === 'create' ? renderCreateMode() : ''}
            ${mode === 'join' ? renderJoinMode() : ''}
            ${mode === 'success' ? '' : ''}
        </div>
    `;

    document.body.appendChild(modal);

    // Kapatma event'leri
    document.getElementById('closeServerModal')?.addEventListener('click', closeServerModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeServerModal();
    });

    // Mode-specific event'ler
    if (mode === 'choose') {
        document.getElementById('chooseCreateBtn')?.addEventListener('click', () => {
            modal.remove();
            renderServerModal('create');
        });
        document.getElementById('chooseJoinBtn')?.addEventListener('click', () => {
            modal.remove();
            renderServerModal('join');
        });
    }

    if (mode === 'create') setupCreateMode();
    if (mode === 'join') setupJoinMode();
}

function renderChooseMode() {
    return `
        <div class="server-modal-header">
            <h2>Sunucu Ekle</h2>
            <p>Kendi sunucunu oluştur veya mevcut bir sunucuya katıl</p>
        </div>
        <div class="server-modal-body">
            <button class="server-modal-option" id="chooseCreateBtn">
                <span class="option-icon">✨</span>
                <div>
                    <div class="option-title">Sunucu Oluştur</div>
                    <div class="option-desc">Sıfırdan kendi sunucunu kur, kanallar ekle</div>
                </div>
                <span class="option-arrow">→</span>
            </button>
            <button class="server-modal-option" id="chooseJoinBtn">
                <span class="option-icon">🔗</span>
                <div>
                    <div class="option-title">Sunucuya Katıl</div>
                    <div class="option-desc">Davet kodu ile bir sunucuya katıl</div>
                </div>
                <span class="option-arrow">→</span>
            </button>
        </div>
    `;
}

function renderCreateMode() {
    return `
        <div class="server-modal-header">
            <h2>✨ Sunucu Oluştur</h2>
            <p>Sunucuna bir isim ve ikon seç!</p>
        </div>
        <div class="server-modal-body">
            <div class="server-create-form">
                <label class="server-form-label">Sunucu İkonu</label>
                <div class="server-icon-picker" id="iconPicker">
                    ${SERVER_ICONS.map((icon, i) => `
                        <button class="server-icon-option ${i === 0 ? 'selected' : ''}" data-icon="${icon}">${icon}</button>
                    `).join('')}
                </div>
                
                <label class="server-form-label">Sunucu Adı</label>
                <input type="text" id="serverNameInput" class="server-form-input" 
                    placeholder="Benim sunucum" maxlength="30" autocomplete="off">
                
                <div class="server-modal-status" id="createStatus"></div>
                
                <div class="server-modal-actions">
                    <button class="server-modal-btn secondary" id="createBackBtn">Geri</button>
                    <button class="server-modal-btn primary" id="createServerBtn">Oluştur</button>
                </div>
            </div>
        </div>
    `;
}

function renderJoinMode() {
    return `
        <div class="server-modal-header">
            <h2>🔗 Sunucuya Katıl</h2>
            <p>Arkadaşının sana verdiği davet kodunu gir</p>
        </div>
        <div class="server-modal-body">
            <div class="server-join-form">
                <label class="server-form-label">Davet Kodu</label>
                <input type="text" id="inviteCodeInput" class="server-form-input invite-code-input" 
                    placeholder="ABC123" maxlength="8" autocomplete="off" spellcheck="false">
                
                <div class="server-modal-status" id="joinStatus"></div>
                
                <div class="server-modal-actions">
                    <button class="server-modal-btn secondary" id="joinBackBtn">Geri</button>
                    <button class="server-modal-btn primary" id="joinServerBtn">Katıl</button>
                </div>
            </div>
        </div>
    `;
}

export function showServerSuccess(type, data) {
    const existing = document.getElementById('serverModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'serverModal';
    modal.className = 'server-modal-overlay';

    if (type === 'created') {
        modal.innerHTML = `
            <div class="server-modal">
                <button class="server-modal-close" id="closeServerModal">✕</button>
                <div class="server-modal-header">
                    <h2>🎉 Sunucu Oluşturuldu!</h2>
                    <p>Arkadaşlarını davet etmek için kodu paylaş</p>
                </div>
                <div class="server-modal-body">
                    <div class="server-invite-display">
                        <div class="server-invite-label">Davet Kodu</div>
                        <div class="server-invite-code" id="inviteCodeDisplay">${data.inviteCode}</div>
                        <button class="server-invite-copy" id="copyInviteBtn">📋 Kopyala</button>
                    </div>
                    <div class="server-modal-actions" style="justify-content: center; margin-top: 20px;">
                        <button class="server-modal-btn primary" id="goToServerBtn">Sunucuya Git →</button>
                    </div>
                </div>
            </div>
        `;
    } else {
        modal.innerHTML = `
            <div class="server-modal">
                <button class="server-modal-close" id="closeServerModal">✕</button>
                <div class="server-modal-header">
                    <h2>🎉 Sunucuya Katıldın!</h2>
                    <p><strong>${data.serverName}</strong> sunucusuna hoş geldin!</p>
                </div>
                <div class="server-modal-body">
                    <div class="server-modal-actions" style="justify-content: center; margin-top: 20px;">
                        <button class="server-modal-btn primary" id="goToServerBtn">Sunucuya Git →</button>
                    </div>
                </div>
            </div>
        `;
    }

    document.body.appendChild(modal);

    document.getElementById('closeServerModal')?.addEventListener('click', closeServerModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeServerModal();
    });

    document.getElementById('copyInviteBtn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(data.inviteCode).then(() => {
            const btn = document.getElementById('copyInviteBtn');
            if (btn) { btn.textContent = '✅ Kopyalandı!'; setTimeout(() => btn.textContent = '📋 Kopyala', 2000); }
        });
    });

    document.getElementById('goToServerBtn')?.addEventListener('click', () => {
        closeServerModal();
        document.dispatchEvent(new CustomEvent('switchServer', { detail: { serverId: data.serverId } }));
    });
}

function setupCreateMode() {
    let selectedIcon = SERVER_ICONS[0];

    // İkon seçimi
    document.querySelectorAll('.server-icon-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.server-icon-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedIcon = btn.dataset.icon;
        });
    });

    // Geri
    document.getElementById('createBackBtn')?.addEventListener('click', () => {
        closeServerModal();
        renderServerModal('choose');
    });

    // Oluştur
    document.getElementById('createServerBtn')?.addEventListener('click', () => {
        const name = document.getElementById('serverNameInput')?.value?.trim();
        if (!name) {
            showStatus('createStatus', 'Sunucu adı giriniz!', 'error');
            return;
        }
        showStatus('createStatus', 'Oluşturuluyor...', 'sending');
        document.dispatchEvent(new CustomEvent('createServerRequest', {
            detail: { name, icon: selectedIcon }
        }));
    });

    // Enter
    document.getElementById('serverNameInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('createServerBtn')?.click();
    });
}

function setupJoinMode() {
    const input = document.getElementById('inviteCodeInput');

    // Auto uppercase
    input?.addEventListener('input', () => {
        input.value = input.value.toUpperCase();
    });

    // Geri
    document.getElementById('joinBackBtn')?.addEventListener('click', () => {
        closeServerModal();
        renderServerModal('choose');
    });

    // Katıl
    document.getElementById('joinServerBtn')?.addEventListener('click', () => {
        const code = input?.value?.trim();
        if (!code) {
            showStatus('joinStatus', 'Davet kodu giriniz!', 'error');
            return;
        }
        showStatus('joinStatus', 'Katılınıyor...', 'sending');
        document.dispatchEvent(new CustomEvent('joinServerRequest', {
            detail: { inviteCode: code }
        }));
    });

    // Enter
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('joinServerBtn')?.click();
    });
}

function showStatus(elementId, message, type) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.className = `server-modal-status ${type}`;
    }
}

export function showModalError(elementId, message) {
    showStatus(elementId, message, 'error');
}

function closeServerModal() {
    const modal = document.getElementById('serverModal');
    if (modal) modal.remove();
}
