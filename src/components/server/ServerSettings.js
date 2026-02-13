// ========================================
// Sunucu Ayarları Bileşeni
// ========================================
// Sunucu bilgileri, rol yönetimi, üye yönetimi

import { getState } from '../../utils/state.js';
import { getServerInfo } from '../../services/database.js';
import {
    createRole,
    updateRole,
    deleteRole,
    assignRole,
    removeRole,
    watchRoles,
    createDefaultRoles,
    PERMISSIONS
} from '../../services/roles.js';

const ROLE_COLORS = ['#ff6b35', '#43b581', '#faa61a', '#e74c3c', '#3498db', '#9b59b6', '#1abc9c', '#e91e63', '#00bcd4', '#ff9800'];

const PERMISSION_LABELS = {
    [PERMISSIONS.MANAGE_CHANNELS]: { label: 'Kanal Yönetimi', desc: 'Kanal oluştur/sil' },
    [PERMISSIONS.MANAGE_ROLES]: { label: 'Rol Yönetimi', desc: 'Rol oluştur/düzenle' },
    [PERMISSIONS.MANAGE_MESSAGES]: { label: 'Mesaj Yönetimi', desc: 'Başkalarının mesajlarını sil' },
    [PERMISSIONS.KICK_MEMBERS]: { label: 'Üye Atma', desc: 'Üyeleri sunucudan at' },
    [PERMISSIONS.MANAGE_SERVER]: { label: 'Sunucu Yönetimi', desc: 'Sunucu ayarlarını değiştir' },
    [PERMISSIONS.SEND_MESSAGES]: { label: 'Mesaj Gönder', desc: 'Kanallara mesaj yaz' },
    [PERMISSIONS.CONNECT_VOICE]: { label: 'Sesli Bağlan', desc: 'Sesli kanallara katıl' }
};

let currentRoles = [];
let rolesUnsubscribe = null;

/**
 * Sunucu ayarları modalını göster
 */
export async function renderServerSettings(serverId) {
    if (!serverId) return;

    // Önceki modali kaldır
    const existing = document.getElementById('serverSettingsModal');
    if (existing) existing.remove();

    const server = await getServerInfo(serverId);
    if (!server) return;

    const user = getState('user');
    const isOwner = server.ownerId === user?.uid;

    // Rolleri henüz yoksa oluştur
    const rolesExist = currentRoles.length > 0;

    const modal = document.createElement('div');
    modal.id = 'serverSettingsModal';
    modal.className = 'server-settings-overlay';
    modal.innerHTML = `
        <div class="server-settings-panel">
            <div class="server-settings-sidebar">
                <div class="ss-sidebar-title">${server.name}</div>
                <div class="ss-nav-item active" data-tab="overview">Genel Bakış</div>
                <div class="ss-nav-item" data-tab="roles">Roller</div>
                <div class="ss-nav-item" data-tab="members">Üyeler</div>
                ${isOwner ? '<div class="ss-nav-item danger" data-tab="danger">Tehlikeli</div>' : ''}
                <div class="ss-nav-sep"></div>
                <div class="ss-nav-item close" id="closeServerSettings">✕ Kapat</div>
            </div>
            <div class="server-settings-content" id="ssContent">
                <!-- Dinamik içerik -->
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Rolleri dinle
    rolesUnsubscribe = watchRoles(serverId, (roles) => {
        currentRoles = roles;
    });

    // Varsayılan roller yoksa oluştur
    if (!rolesExist) {
        await createDefaultRoles(serverId, server.ownerId);
    }

    // Tab navigasyonu
    modal.querySelectorAll('.ss-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (item.id === 'closeServerSettings') {
                closeServerSettings();
                return;
            }
            modal.querySelectorAll('.ss-nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            const tab = item.dataset.tab;
            if (tab === 'overview') renderOverviewTab(server, isOwner);
            if (tab === 'roles') renderRolesTab(serverId, isOwner);
            if (tab === 'members') renderMembersTab(serverId, server);
            if (tab === 'danger') renderDangerTab(serverId);
        });
    });

    // Kapatma
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeServerSettings();
    });

    // İlk tab
    renderOverviewTab(server, isOwner);
}

function renderOverviewTab(server, isOwner) {
    const content = document.getElementById('ssContent');
    if (!content) return;

    content.innerHTML = `
        <div class="ss-section-title">Sunucu Bilgileri</div>
        <div class="ss-card">
            <div class="ss-row">
                <div class="ss-label">Sunucu Adı</div>
                <div class="ss-value">${server.name}</div>
            </div>
            <div class="ss-row">
                <div class="ss-label">İkon</div>
                <div class="ss-value" style="font-size: 32px;">${server.icon || '🎮'}</div>
            </div>
            <div class="ss-row">
                <div class="ss-label">Üye Sayısı</div>
                <div class="ss-value">${server.memberCount || server.members?.length || 0} üye</div>
            </div>
            <div class="ss-row">
                <div class="ss-label">Sahip</div>
                <div class="ss-value">${server.ownerName || 'Bilinmiyor'}</div>
            </div>
        </div>

        <div class="ss-section-title">Davet Kodu</div>
        <div class="ss-card">
            <div class="ss-invite-row">
                <div class="ss-invite-code">${server.inviteCode || 'Yok'}</div>
                <button class="ss-copy-btn" id="copyServerCode">📋 Kopyala</button>
            </div>
            <p class="ss-hint">Bu kodu arkadaşlarınla paylaş, sunucuna katılsınlar!</p>
        </div>
    `;

    document.getElementById('copyServerCode')?.addEventListener('click', () => {
        if (server.inviteCode) {
            navigator.clipboard.writeText(server.inviteCode).then(() => {
                const btn = document.getElementById('copyServerCode');
                if (btn) { btn.textContent = '✅ Kopyalandı!'; setTimeout(() => btn.textContent = '📋 Kopyala', 2000); }
            });
        }
    });
}

function renderRolesTab(serverId, isOwner) {
    const content = document.getElementById('ssContent');
    if (!content) return;

    content.innerHTML = `
        <div class="ss-section-title">
            Roller
            ${isOwner ? '<button class="ss-add-btn" id="addRoleBtn">+ Yeni Rol</button>' : ''}
        </div>
        <div class="ss-roles-list" id="rolesList">
            ${currentRoles.map(role => `
                <div class="ss-role-item" data-role-id="${role.id}">
                    <div class="ss-role-color" style="background: ${role.color}"></div>
                    <div class="ss-role-info">
                        <div class="ss-role-name">${role.name}</div>
                        <div class="ss-role-perms">${role.permissions?.length || 0} yetki</div>
                    </div>
                    ${!role.isDefault && isOwner ? `
                        <button class="ss-role-edit" data-action="edit" data-role-id="${role.id}">✏️</button>
                        <button class="ss-role-delete" data-action="delete" data-role-id="${role.id}">🗑️</button>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;

    // Yeni rol ekle
    document.getElementById('addRoleBtn')?.addEventListener('click', () => {
        showRoleEditor(serverId, null);
    });

    // Rol düzenle/sil
    content.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const roleId = btn.dataset.roleId;
            const action = btn.dataset.action;

            if (action === 'edit') {
                const role = currentRoles.find(r => r.id === roleId);
                if (role) showRoleEditor(serverId, role);
            }
            if (action === 'delete') {
                if (confirm('Bu rolü silmek istediğine emin misin?')) {
                    await deleteRole(serverId, roleId);
                    renderRolesTab(serverId, isOwner);
                }
            }
        });
    });
}

function showRoleEditor(serverId, existingRole) {
    const content = document.getElementById('ssContent');
    if (!content) return;

    const isEdit = !!existingRole;
    const perms = existingRole?.permissions || [PERMISSIONS.SEND_MESSAGES, PERMISSIONS.CONNECT_VOICE];

    content.innerHTML = `
        <div class="ss-section-title">${isEdit ? 'Rol Düzenle' : 'Yeni Rol Oluştur'}</div>
        <div class="ss-card">
            <div class="ss-form-group">
                <label class="ss-form-label">Rol Adı</label>
                <input type="text" id="roleNameInput" class="ss-form-input" 
                    value="${existingRole?.name || ''}" placeholder="Örn: Admin" maxlength="20">
            </div>

            <div class="ss-form-group">
                <label class="ss-form-label">Renk</label>
                <div class="ss-color-picker" id="colorPicker">
                    ${ROLE_COLORS.map(c => `
                        <div class="ss-color-option ${c === (existingRole?.color || ROLE_COLORS[0]) ? 'selected' : ''}" 
                             data-color="${c}" style="background: ${c}"></div>
                    `).join('')}
                </div>
            </div>

            <div class="ss-form-group">
                <label class="ss-form-label">Yetkiler</label>
                <div class="ss-perms-list">
                    ${Object.entries(PERMISSION_LABELS).map(([key, val]) => `
                        <label class="ss-perm-item">
                            <input type="checkbox" class="ss-perm-check" data-perm="${key}" 
                                ${perms.includes(key) ? 'checked' : ''}>
                            <div>
                                <div class="ss-perm-label">${val.label}</div>
                                <div class="ss-perm-desc">${val.desc}</div>
                            </div>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div class="ss-form-actions">
                <button class="ss-btn secondary" id="cancelRoleBtn">İptal</button>
                <button class="ss-btn primary" id="saveRoleBtn">${isEdit ? 'Kaydet' : 'Oluştur'}</button>
            </div>
        </div>
    `;

    let selectedColor = existingRole?.color || ROLE_COLORS[0];

    // Renk seçimi
    content.querySelectorAll('.ss-color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            content.querySelectorAll('.ss-color-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedColor = opt.dataset.color;
        });
    });

    // İptal
    document.getElementById('cancelRoleBtn')?.addEventListener('click', () => {
        renderRolesTab(serverId, true);
    });

    // Kaydet
    document.getElementById('saveRoleBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('roleNameInput')?.value?.trim();
        if (!name) return alert('Rol adı giriniz!');

        const permissions = [];
        content.querySelectorAll('.ss-perm-check:checked').forEach(cb => {
            permissions.push(cb.dataset.perm);
        });

        if (isEdit) {
            await updateRole(serverId, existingRole.id, { name, color: selectedColor, permissions });
        } else {
            await createRole(serverId, name, selectedColor, permissions);
        }

        // Kısa bekleme sonrası rol listesine dön
        setTimeout(() => renderRolesTab(serverId, true), 500);
    });
}

function renderMembersTab(serverId, server) {
    const content = document.getElementById('ssContent');
    if (!content) return;

    const members = getState('members') || [];
    const memberRoles = server.memberRoles || {};
    const user = getState('user');
    const isOwner = server.ownerId === user?.uid;

    content.innerHTML = `
        <div class="ss-section-title">Üyeler (${members.length})</div>
        <div class="ss-members-list">
            ${members.map(member => {
        const roles = (memberRoles[member.id] || [])
            .map(rId => currentRoles.find(r => r.id === rId))
            .filter(Boolean);
        const topRole = roles[0];

        return `
                    <div class="ss-member-item">
                        <div class="ss-member-avatar" style="background: ${topRole?.color || 'var(--accent-gradient)'}">
                            ${member.avatar || '😀'}
                        </div>
                        <div class="ss-member-info">
                            <div class="ss-member-name" style="color: ${topRole?.color || 'var(--text-primary)'}">
                                ${member.displayName || 'Kullanıcı'}
                            </div>
                            <div class="ss-member-roles">
                                ${roles.map(r => `<span class="ss-role-badge" style="color: ${r.color}; border-color: ${r.color}">${r.name}</span>`).join('') || '<span class="ss-role-badge">Üye</span>'}
                            </div>
                        </div>
                        ${isOwner && member.id !== user.uid ? `
                            <div class="ss-member-actions">
                                <select class="ss-role-select" data-uid="${member.id}">
                                    <option value="">Rol Ata...</option>
                                    ${currentRoles.filter(r => !r.isDefault || r.name !== 'Sahip').map(r => `
                                        <option value="${r.id}">${r.name}</option>
                                    `).join('')}
                                </select>
                            </div>
                        ` : ''}
                    </div>
                `;
    }).join('')}
        </div>
    `;

    // Rol atama
    content.querySelectorAll('.ss-role-select').forEach(select => {
        select.addEventListener('change', async () => {
            const uid = select.dataset.uid;
            const roleId = select.value;
            if (!roleId) return;

            await assignRole(serverId, uid, roleId);
            select.value = '';

            // Güncelle
            const updatedServer = await getServerInfo(serverId);
            if (updatedServer) {
                setTimeout(() => renderMembersTab(serverId, updatedServer), 300);
            }
        });
    });
}

function renderDangerTab(serverId) {
    const content = document.getElementById('ssContent');
    if (!content) return;

    content.innerHTML = `
        <div class="ss-section-title" style="color: var(--error);">Tehlikeli Bölge</div>
        <div class="ss-card" style="border-color: rgba(240, 71, 71, 0.3);">
            <div class="ss-row">
                <div>
                    <div class="ss-label">Sunucuyu Sil</div>
                    <div class="ss-hint">Bu işlem geri alınamaz! Tüm kanallar ve mesajlar silinir.</div>
                </div>
                <button class="ss-btn danger" id="deleteServerBtn">Sunucuyu Sil</button>
            </div>
        </div>
    `;

    document.getElementById('deleteServerBtn')?.addEventListener('click', () => {
        const confirmText = prompt('Sunucuyu silmek için "SİL" yazın:');
        if (confirmText === 'SİL') {
            // TODO: Sunucu silme implementasyonu
            alert('Sunucu silme henüz aktif değil.');
        }
    });
}

function closeServerSettings() {
    if (rolesUnsubscribe) { rolesUnsubscribe(); rolesUnsubscribe = null; }
    const modal = document.getElementById('serverSettingsModal');
    if (modal) modal.remove();
}
