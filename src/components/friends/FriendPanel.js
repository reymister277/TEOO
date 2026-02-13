// ========================================
// Arkadaş Paneli Bileşeni
// ========================================
// Arkadaş listesi, istek yönetimi ve DM

import { getState, setState } from '../../utils/state.js';
import { getAvatarColor, getInitials } from '../../utils/helpers.js';

let currentTab = 'online';

/**
 * Arkadaş panelini render et
 */
export function renderFriendPanel(container) {
    if (!container) return;

    const user = getState('user');

    container.innerHTML = `
        <div class="friend-panel">
            <div class="friend-header">
                <div class="friend-header-left">
                    <span class="friend-header-icon">👥</span>
                    <span class="friend-header-title">Arkadaşlar</span>
                </div>
                <div class="friend-tabs">
                    <button class="friend-tab ${currentTab === 'online' ? 'active' : ''}" data-tab="online">Çevrimiçi</button>
                    <button class="friend-tab ${currentTab === 'all' ? 'active' : ''}" data-tab="all">Tümü</button>
                    <button class="friend-tab ${currentTab === 'pending' ? 'active' : ''}" data-tab="pending">
                        Bekleyen
                        <span class="pending-badge" id="pendingBadge" style="display:none">0</span>
                    </button>
                    <button class="friend-tab add-friend-tab ${currentTab === 'add' ? 'active' : ''}" data-tab="add">Arkadaş Ekle</button>
                </div>
            </div>

            <div class="friend-content" id="friendContent">
                <!-- Tab içeriği buraya gelecek -->
            </div>

            <!-- Kullanıcının kendi kodu -->
            <div class="my-friend-code">
                <span class="my-code-label">Senin Kodun:</span>
                <span class="my-code-value" id="myFriendCode">${user?.friendCode || '...'}</span>
                <button class="copy-code-btn" id="copyCodeBtn" title="Kodu kopyala">📋</button>
            </div>
        </div>
    `;

    // Tab event'leri
    container.querySelectorAll('.friend-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentTab = tab.dataset.tab;
            container.querySelectorAll('.friend-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updateFriendContent();
        });
    });

    // Kod kopyala
    document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
        const code = user?.friendCode || '';
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('copyCodeBtn');
            if (btn) {
                btn.textContent = '✅';
                setTimeout(() => btn.textContent = '📋', 2000);
            }
        });
    });

    // İlk tab'ı göster
    updateFriendContent();
}

/**
 * Tab içeriğini güncelle
 */
export function updateFriendContent() {
    const content = document.getElementById('friendContent');
    if (!content) return;

    switch (currentTab) {
        case 'online':
            renderOnlineFriends(content);
            break;
        case 'all':
            renderAllFriends(content);
            break;
        case 'pending':
            renderPendingRequests(content);
            break;
        case 'add':
            renderAddFriend(content);
            break;
    }
}

/**
 * Çevrimiçi arkadaşlar
 */
function renderOnlineFriends(content) {
    const friends = getState('friendsList') || [];
    const online = friends.filter(f => f.status === 'online' || f.status === 'idle');

    if (online.length === 0) {
        content.innerHTML = `
            <div class="friend-empty">
                <div class="friend-empty-icon">😴</div>
                <div class="friend-empty-text">Çevrimiçi arkadaş yok</div>
                <div class="friend-empty-sub">Arkadaş eklemek için "Arkadaş Ekle" sekmesini kullan</div>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="friend-section-title">ÇEVRİMİÇİ — ${online.length}</div>
        <div class="friend-list">
            ${online.map(f => renderFriendItem(f)).join('')}
        </div>
    `;

    attachFriendItemEvents(content);
}

/**
 * Tüm arkadaşlar
 */
function renderAllFriends(content) {
    const friends = getState('friendsList') || [];

    if (friends.length === 0) {
        content.innerHTML = `
            <div class="friend-empty">
                <div class="friend-empty-icon">👻</div>
                <div class="friend-empty-text">Henüz arkadaşınız yok</div>
                <div class="friend-empty-sub">Arkadaş kodunu paylaşarak arkadaş ekle!</div>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="friend-section-title">TÜM ARKADAŞLAR — ${friends.length}</div>
        <div class="friend-list">
            ${friends.map(f => renderFriendItem(f)).join('')}
        </div>
    `;

    attachFriendItemEvents(content);
}

/**
 * Bekleyen istekler
 */
function renderPendingRequests(content) {
    const requests = getState('friendRequests') || [];

    if (requests.length === 0) {
        content.innerHTML = `
            <div class="friend-empty">
                <div class="friend-empty-icon">📭</div>
                <div class="friend-empty-text">Bekleyen istek yok</div>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="friend-section-title">BEKLEYEN İSTEKLER — ${requests.length}</div>
        <div class="friend-list">
            ${requests.map(req => `
                <div class="friend-item request-item">
                    <div class="friend-item-left">
                        <div class="friend-avatar" style="background: ${getAvatarColor(req.fromName)}">
                            ${req.fromAvatar || getInitials(req.fromName)}
                        </div>
                        <div class="friend-info">
                            <div class="friend-name">${req.fromName}</div>
                            <div class="friend-sub">Arkadaşlık isteği gönderdi</div>
                        </div>
                    </div>
                    <div class="friend-actions">
                        <button class="friend-accept-btn" data-request-id="${req.id}" data-from-uid="${req.from}" title="Kabul Et">✅</button>
                        <button class="friend-reject-btn" data-request-id="${req.id}" title="Reddet">❌</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Kabul/Red event'leri
    content.querySelectorAll('.friend-accept-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('acceptFriendRequest', {
                detail: { requestId: btn.dataset.requestId, fromUid: btn.dataset.fromUid }
            }));
        });
    });

    content.querySelectorAll('.friend-reject-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('rejectFriendRequest', {
                detail: { requestId: btn.dataset.requestId }
            }));
        });
    });
}

/**
 * Arkadaş ekle formu
 */
function renderAddFriend(content) {
    content.innerHTML = `
        <div class="add-friend-section">
            <div class="add-friend-title">ARKADAŞ EKLE</div>
            <div class="add-friend-desc">Arkadaşının 4 haneli kodunu girerek istek gönderebilirsin.</div>
            
            <div class="add-friend-form">
                <input type="text" 
                    id="friendCodeInput" 
                    class="add-friend-input" 
                    placeholder="Kodu gir (ör: A7K9)" 
                    maxlength="6"
                    autocomplete="off"
                    spellcheck="false">
                <button class="add-friend-btn" id="sendRequestBtn">İstek Gönder</button>
            </div>
            
            <div class="add-friend-status" id="addFriendStatus"></div>
        </div>
    `;

    const input = document.getElementById('friendCodeInput');
    const btn = document.getElementById('sendRequestBtn');

    // Auto uppercase
    input?.addEventListener('input', () => {
        input.value = input.value.toUpperCase();
    });

    // Enter ile gönder
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btn?.click();
    });

    btn?.addEventListener('click', () => {
        const code = input?.value?.trim();
        if (!code) return;

        const status = document.getElementById('addFriendStatus');
        if (status) {
            status.textContent = 'Gönderiliyor...';
            status.className = 'add-friend-status sending';
        }

        document.dispatchEvent(new CustomEvent('sendFriendRequest', {
            detail: { code }
        }));
    });
}

/**
 * Tek bir arkadaş öğesi render et
 */
function renderFriendItem(friend) {
    const statusColors = {
        online: '#43b581',
        idle: '#faa61a',
        dnd: '#f04747',
        offline: '#747f8d'
    };

    return `
        <div class="friend-item" data-friend-uid="${friend.uid}">
            <div class="friend-item-left">
                <div class="friend-avatar" style="background: ${getAvatarColor(friend.displayName || '')}">
                    ${friend.avatar || getInitials(friend.displayName || '')}
                    <div class="friend-status-dot" style="background: ${statusColors[friend.status] || statusColors.offline}"></div>
                </div>
                <div class="friend-info">
                    <div class="friend-name">${friend.displayName || ''}</div>
                    <div class="friend-sub">${getStatusText(friend.status)}</div>
                </div>
            </div>
            <div class="friend-actions">
                <button class="friend-dm-btn" data-friend-uid="${friend.uid}" title="Mesaj Gönder">💬</button>
            </div>
        </div>
    `;
}

/**
 * Arkadaş item event'leri
 */
function attachFriendItemEvents(content) {
    content.querySelectorAll('.friend-dm-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.dispatchEvent(new CustomEvent('openDM', {
                detail: { friendUid: btn.dataset.friendUid }
            }));
        });
    });

    content.querySelectorAll('.friend-item[data-friend-uid]').forEach(item => {
        item.addEventListener('dblclick', () => {
            document.dispatchEvent(new CustomEvent('openDM', {
                detail: { friendUid: item.dataset.friendUid }
            }));
        });
    });
}

/**
 * Durum metni
 */
function getStatusText(status) {
    switch (status) {
        case 'online': return 'Çevrimiçi';
        case 'idle': return 'Boşta';
        case 'dnd': return 'Rahatsız Etmeyin';
        default: return 'Çevrimdışı';
    }
}

/**
 * Bekleyen istek badge'ini güncelle
 */
export function updatePendingBadge(count) {
    const badge = document.getElementById('pendingBadge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
}

/**
 * Arkadaş ekle sonuç mesajını göster
 */
export function showAddFriendResult(success, message) {
    const status = document.getElementById('addFriendStatus');
    if (status) {
        status.textContent = message;
        status.className = `add-friend-status ${success ? 'success' : 'error'}`;
    }
    // Input'u temizle
    if (success) {
        const input = document.getElementById('friendCodeInput');
        if (input) input.value = '';
    }
}
