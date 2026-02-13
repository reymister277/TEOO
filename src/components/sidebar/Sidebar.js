// ========================================
// Sidebar Bileşeni
// ========================================

import { getState, onStateChange } from '../../utils/state.js';
import { getAvatarColor, getInitials } from '../../utils/helpers.js';
import { logout } from '../../services/auth.js';
import { leaveVoiceChannel } from '../../services/voice.js';

export function renderSidebar(container) {
    container.innerHTML = `
        <!-- Sunucu Barı -->
        <div class="server-bar">
            <div class="server-icon home active tooltip" data-tooltip="Ana Sayfa" id="homeBtn">
                <div class="server-indicator"></div>
                🚀
            </div>
            <div class="server-icon friends-btn tooltip" data-tooltip="Arkadaşlar" id="friendsBtn">
                👥
            </div>
            <div class="server-separator"></div>
            <div id="serverListContainer">
                <!-- Sunucu ikonları dinamik olarak buraya eklenir -->
            </div>
            <div class="server-add tooltip" data-tooltip="Sunucu Ekle" id="addServerBtn">+</div>
        </div>
        
        <!-- Kanal Sidebar -->
        <div class="channel-sidebar">
            <div class="server-header">
                <h2>TEOO</h2>
                <div class="server-header-actions">
                    <button class="server-header-btn" title="Sunucu Ayarları" id="serverSettingsBtn">⚙️</button>
                    <button class="server-header-btn" title="Kanal Ekle" id="addChannelBtn">➕</button>
                </div>
            </div>
            
            <div class="channels-list" id="channelsList">
                <!-- Kanallar buraya dinamik olarak eklenecek -->
            </div>

            <!-- Sesli bağlantı paneli -->
            <div class="voice-panel hidden" id="voicePanel">
                <div class="voice-connection">
                    <div class="voice-status">
                        <div class="voice-status-icon"></div>
                        <div>
                            <div class="voice-status-text">Ses Bağlantısı</div>
                            <div class="voice-channel-label" id="voiceChannelLabel">-</div>
                        </div>
                    </div>
                    <button class="voice-disconnect-btn" id="voiceDisconnectBtn" title="Bağlantıyı Kes">📞</button>
                </div>
                <div class="voice-controls-bar">
                    <button class="voice-control-btn" id="micToggleBtn" title="Mikrofon">🎤</button>
                    <button class="voice-control-btn" id="speakerToggleBtn" title="Hoparlör">🔊</button>
                </div>
            </div>
            
            <!-- Kullanıcı Paneli -->
            <div class="user-panel">
                <div class="user-panel-avatar" id="sidebarAvatar">😀</div>
                <div class="user-panel-info">
                    <div class="user-panel-name" id="sidebarUserName">Yükleniyor...</div>
                    <div class="user-panel-tag">
                        <span class="user-panel-status online" id="sidebarStatusDot"></span>
                        Çevrimiçi
                    </div>
                    <div class="user-panel-code" id="sidebarFriendCode" title="Arkadaş kodun"></div>
                </div>
                <div class="user-panel-actions">
                    <button class="user-panel-btn" id="settingsBtn" title="Ayarlar">⚙️</button>
                    <button class="user-panel-btn" id="logoutBtn" title="Çıkış Yap">🚪</button>
                </div>
            </div>
        </div>
    `;

    // Event listener'lar
    setupSidebarEvents();

    // State dinle
    onStateChange('user', updateUserPanel);
    onStateChange('voice', updateVoicePanel);
}

/**
 * Kanalları render et
 */
export function renderChannels(channels) {
    const container = document.getElementById('channelsList');
    if (!container) return;

    const textChannels = channels.filter(c => c.type === 'text');
    const voiceChannels = channels.filter(c => c.type === 'voice');
    const currentChannel = getState('currentChannel');

    container.innerHTML = `
        <div class="channel-category">
            <div class="category-header">
                <span class="category-toggle">▾</span>
                <span class="category-name">Metin Kanalları</span>
            </div>
            ${textChannels.map(ch => `
                <div class="channel-item ${currentChannel === ch.id ? 'active' : ''}" 
                     data-channel-id="${ch.id}" data-channel-type="text" data-channel-name="${ch.name}"
                     data-channel-desc="${ch.description || ''}">
                    <span class="channel-icon">#</span>
                    <span class="channel-name">${ch.name}</span>
                </div>
            `).join('')}
        </div>
        
        <div class="channel-category">
            <div class="category-header">
                <span class="category-toggle">▾</span>
                <span class="category-name">Sesli Kanallar</span>
            </div>
            ${voiceChannels.map(ch => {
        const voiceState = getState('voice');
        const isCurrentVoice = voiceState.connected && voiceState.channelId === ch.id;
        const participants = getState('voiceParticipants') || [];

        return `
                    <div class="channel-item ${isCurrentVoice ? 'active' : ''}" 
                         data-channel-id="${ch.id}" data-channel-type="voice" data-channel-name="${ch.name}">
                        <span class="channel-icon">🔊</span>
                        <span class="channel-name">${ch.name}</span>
                    </div>
                    ${isCurrentVoice ? `
                        <div class="voice-channel-users">
                            ${renderVoiceUser(getState('user'))}
                            ${participants.map(p => renderVoiceUser(p)).join('')}
                        </div>
                    ` : ''}
                `;
    }).join('')}
        </div>
    `;

    // Kanal tıklama eventleri yeniden bağla
    container.querySelectorAll('.channel-item').forEach(item => {
        item.addEventListener('click', () => {
            const channelId = item.dataset.channelId;
            const channelType = item.dataset.channelType;
            const channelName = item.dataset.channelName;

            if (channelType === 'text') {
                // Aktif sınıfını güncelle
                container.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');

                // Event tetikle
                document.dispatchEvent(new CustomEvent('channelChange', {
                    detail: {
                        id: channelId,
                        type: channelType,
                        name: channelName,
                        description: item.dataset.channelDesc || ''
                    }
                }));
            } else if (channelType === 'voice') {
                document.dispatchEvent(new CustomEvent('voiceChannelJoin', {
                    detail: { id: channelId, name: channelName }
                }));
            }
        });
    });
}

function setupSidebarEvents() {
    // Çıkış butonu
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        const user = getState('user');
        const voice = getState('voice');

        // Sesli kanaldan ayrıl
        if (voice.connected) {
            await leaveVoiceChannel(user);
        }

        await logout();
    });

    // Ayarlar butonu
    document.getElementById('settingsBtn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('openSettings'));
    });

    // Sesli kanal kontrolleri
    document.getElementById('voiceDisconnectBtn')?.addEventListener('click', async () => {
        const user = getState('user');
        await leaveVoiceChannel(user);
    });

    document.getElementById('micToggleBtn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('toggleMic'));
    });

    document.getElementById('speakerToggleBtn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('toggleSpeaker'));
    });

    // Kanal ekleme
    document.getElementById('addChannelBtn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('createChannel'));
    });

    // Sunucu ayarları
    document.getElementById('serverSettingsBtn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('openServerSettings'));
    });

    // Arkadaşlar butonu
    document.getElementById('friendsBtn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('showFriends'));
    });

    // Ana sayfa butonu
    document.getElementById('homeBtn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('showHome'));
    });

    // Sunucu ekle butonu
    document.getElementById('addServerBtn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('openServerModal', { detail: { mode: 'choose' } }));
    });
}

function updateUserPanel(user) {
    if (!user) return;
    const nameEl = document.getElementById('sidebarUserName');
    const avatarEl = document.getElementById('sidebarAvatar');
    const codeEl = document.getElementById('sidebarFriendCode');

    if (nameEl) nameEl.textContent = user.displayName;
    if (avatarEl) avatarEl.textContent = user.avatar || getInitials(user.displayName);
    if (codeEl && user.friendCode) codeEl.textContent = `#${user.friendCode}`;
}

function updateVoicePanel(voice) {
    const panel = document.getElementById('voicePanel');
    const label = document.getElementById('voiceChannelLabel');
    const micBtn = document.getElementById('micToggleBtn');
    const speakerBtn = document.getElementById('speakerToggleBtn');

    if (!panel) return;

    if (voice.connected) {
        panel.classList.remove('hidden');
        if (label) label.textContent = voice.channelName || '';
        if (micBtn) {
            micBtn.textContent = voice.micEnabled ? '🎤' : '🔇';
            micBtn.classList.toggle('muted', !voice.micEnabled);
        }
        if (speakerBtn) {
            speakerBtn.textContent = voice.speakerEnabled ? '🔊' : '🔇';
            speakerBtn.classList.toggle('muted', !voice.speakerEnabled);
        }
    } else {
        panel.classList.add('hidden');
    }

    // Sesli kanal kullanıcı listesini de güncelle
    const channels = getState('channels');
    if (channels) renderChannels(channels);
}

/**
 * Sesli kanalda kullanıcı render'ı
 */
function renderVoiceUser(user) {
    if (!user) return '';
    const color = getAvatarColor(user.displayName || '');
    return `
        <div class="voice-user-item">
            <div class="voice-user-avatar" style="background: ${color}">
                ${user.avatar || getInitials(user.displayName || '')}
            </div>
            <span class="voice-user-name">${user.displayName || ''}</span>
        </div>
    `;
}

/**
 * Sol barda sunucu listesini güncelle
 */
export function updateServerList(servers) {
    const container = document.getElementById('serverListContainer');
    if (!container) return;

    // teoo-main hariç (o zaten 🚀 ikonu olarak var)
    const customServers = servers.filter(s => s.id !== 'teoo-main');

    if (customServers.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = customServers.map(server => `
        <div class="server-icon tooltip" data-tooltip="${server.name}" data-server-id="${server.id}">
            <div class="server-indicator"></div>
            ${server.icon || '🎮'}
        </div>
    `).join('');

    // Sunucu tıklama event'leri
    container.querySelectorAll('.server-icon').forEach(icon => {
        icon.addEventListener('click', () => {
            // Aktif sınıfını güncelle
            document.querySelectorAll('.server-bar .server-icon').forEach(s => s.classList.remove('active'));
            icon.classList.add('active');

            // Sunucu header'ını güncelle
            const serverName = icon.dataset.tooltip;
            const headerEl = document.querySelector('.server-header h2');
            if (headerEl) headerEl.textContent = serverName;

            // Sunucu değiştir
            document.dispatchEvent(new CustomEvent('switchServer', {
                detail: { serverId: icon.dataset.serverId }
            }));
        });
    });
}
