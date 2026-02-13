// ========================================
// Üye Paneli Bileşeni
// ========================================

import { getAvatarColor, getInitials } from '../../utils/helpers.js';

export function renderMemberPanel(container) {
    container.innerHTML = `
        <div class="members-panel" id="membersPanel">
            <div class="members-section">
                <div class="members-section-title" id="onlineTitle">Çevrimiçi — 0</div>
                <div id="onlineMembers"></div>
            </div>
            <div class="members-section">
                <div class="members-section-title" id="offlineTitle">Çevrimdışı — 0</div>
                <div id="offlineMembers"></div>
            </div>
        </div>
    `;
}

/**
 * Üye listesini güncelle
 */
export function updateMembers(members) {
    const onlineContainer = document.getElementById('onlineMembers');
    const offlineContainer = document.getElementById('offlineMembers');
    const onlineTitle = document.getElementById('onlineTitle');
    const offlineTitle = document.getElementById('offlineTitle');

    if (!onlineContainer || !offlineContainer) return;

    const online = members.filter(m => m.status === 'online');
    const offline = members.filter(m => m.status !== 'online');

    if (onlineTitle) onlineTitle.textContent = `Çevrimiçi — ${online.length}`;
    if (offlineTitle) offlineTitle.textContent = `Çevrimdışı — ${offline.length}`;

    onlineContainer.innerHTML = online.map(m => renderMemberItem(m, true)).join('');
    offlineContainer.innerHTML = offline.map(m => renderMemberItem(m, false)).join('');
}

function renderMemberItem(member, isOnline) {
    const color = getAvatarColor(member.displayName || member.name);
    const avatar = member.avatar || getInitials(member.displayName || member.name);

    return `
        <div class="member-item ${!isOnline ? 'offline' : ''}">
            <div class="member-avatar" style="background: ${color}">
                ${avatar}
                <div class="member-status-dot ${isOnline ? 'online' : 'offline'}"></div>
            </div>
            <div class="member-info">
                <div class="member-name">${member.displayName || member.name}</div>
            </div>
        </div>
    `;
}
