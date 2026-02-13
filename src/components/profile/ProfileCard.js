// ========================================
// Kullanıcı Profil Kartı Bileşeni
// ========================================

import { getState } from '../../utils/state.js';
import { getAvatarColor, getInitials } from '../../utils/helpers.js';
import { db } from '../../config/firebase.js';
import { doc, getDoc } from 'firebase/firestore';
import { getServerRoles } from '../../services/roles.js';

/**
 * Profil kartı popup göster
 */
export async function showProfileCard(uid, displayName, anchorEl) {
    // Mevcut kartı kaldır
    document.querySelector('.profile-card-popup')?.remove();

    const card = document.createElement('div');
    card.className = 'profile-card-popup';
    card.innerHTML = `<div class="profile-card-loading">Yükleniyor...</div>`;

    // Pozisyon hesapla
    const rect = anchorEl.getBoundingClientRect();
    card.style.position = 'fixed';
    card.style.top = rect.top + 'px';
    card.style.left = (rect.right + 12) + 'px';
    card.style.zIndex = '9999';

    document.body.appendChild(card);

    // Kullanıcı bilgilerini çek
    let userInfo = { displayName: displayName || 'Kullanıcı', avatar: null, bio: '' };
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            userInfo = { ...userInfo, ...userDoc.data() };
        }
    } catch (e) { /* sessiz */ }

    // Mevcut sunucudaki rolleri
    const serverId = getState('currentServer');
    let userRoles = [];
    if (serverId) {
        try {
            const serverDoc = await getDoc(doc(db, 'servers', serverId));
            if (serverDoc.exists()) {
                const serverData = serverDoc.data();
                const memberRoleIds = (serverData.memberRoles || {})[uid] || [];
                const allRoles = await getServerRoles(serverId);
                userRoles = memberRoleIds
                    .map(rId => allRoles.find(r => r.id === rId))
                    .filter(Boolean);
            }
        } catch (e) { /* sessiz */ }
    }

    const color = getAvatarColor(userInfo.displayName);
    const topRole = userRoles[0];
    const currentUser = getState('user');
    const isMe = uid === currentUser?.uid;

    card.innerHTML = `
        <div class="profile-card">
            <div class="profile-card-banner" style="background: ${topRole?.color || color}"></div>
            <div class="profile-card-avatar" style="background: ${color}">
                ${userInfo.avatar || getInitials(userInfo.displayName)}
            </div>
            <div class="profile-card-body">
                <div class="profile-card-name" style="color: ${topRole?.color || 'var(--text-primary)'}">
                    ${userInfo.displayName}
                </div>
                ${userInfo.bio ? `<div class="profile-card-bio">${userInfo.bio}</div>` : ''}
                ${userRoles.length > 0 ? `
                    <div class="profile-card-section">
                        <div class="profile-card-section-title">ROLLER</div>
                        <div class="profile-card-roles">
                            ${userRoles.map(r => `
                                <span class="profile-role-badge" style="color: ${r.color}; border-color: ${r.color}">
                                    <span class="profile-role-dot" style="background: ${r.color}"></span>
                                    ${r.name}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                ${!isMe ? `
                    <div class="profile-card-actions">
                        <button class="profile-card-btn primary" id="profileDmBtn" data-uid="${uid}">💬 Mesaj Gönder</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // Kart ekran dışına çıkmasın
    requestAnimationFrame(() => {
        const cardRect = card.getBoundingClientRect();
        if (cardRect.right > window.innerWidth) {
            card.style.left = (rect.left - cardRect.width - 12) + 'px';
        }
        if (cardRect.bottom > window.innerHeight) {
            card.style.top = (window.innerHeight - cardRect.height - 16) + 'px';
        }
    });

    // DM butonu
    card.querySelector('#profileDmBtn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('startDM', { detail: { uid, displayName: userInfo.displayName } }));
        card.remove();
    });

    // Dışarı tıklayınca kapat
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!card.contains(e.target) && !anchorEl.contains(e.target)) {
                card.remove();
                document.removeEventListener('click', handler);
            }
        });
    }, 0);
}
