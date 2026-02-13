// ========================================
// Ana Uygulama Bileşeni
// ========================================
// Tüm bileşenleri bir araya getirir ve olayları koordine eder

import { getState, setState, onStateChange } from '../utils/state.js';
import { renderSidebar, renderChannels } from './sidebar/Sidebar.js';
import { renderChatArea, updateChatHeader, renderMessages, updateTypingIndicator } from './chat/ChatArea.js';
import { renderMemberPanel, updateMembers } from './members/MemberPanel.js';
import { renderSettings } from './settings/UserSettings.js';
import {
    createDefaultServer,
    watchChannels,
    watchMessages,
    watchMembers,
    sendMessage,
    deleteMessage,
    editMessage,
    createChannel,
    setTypingStatus,
    watchTyping
} from '../services/database.js';
import { joinVoiceChannel, leaveVoiceChannel, toggleMicrophone, toggleSpeaker } from '../services/voice.js';
import { debounce } from '../utils/helpers.js';

let currentMessageUnsubscribe = null;
let currentTypingUnsubscribe = null;
let typingTimeout = null;

/**
 * Ana uygulamayı başlat
 */
export async function renderApp() {
    const app = document.getElementById('app');
    const user = getState('user');

    if (!user) return;

    // Ana layout
    app.innerHTML = `
        <div class="app-layout">
            <div id="sidebarContainer"></div>
            <div id="chatContainer"></div>
            <div id="membersContainer"></div>
        </div>
    `;

    // Bileşenleri render et
    renderSidebar(document.getElementById('sidebarContainer'));
    renderChatArea(document.getElementById('chatContainer'));
    renderMemberPanel(document.getElementById('membersContainer'));

    // Varsayılan sunucuyu oluştur/yükle
    const serverId = await createDefaultServer(user.uid);
    setState('currentServer', serverId);

    // Kanalları dinle
    watchChannels(serverId, (channels) => {
        setState('channels', channels);
        renderChannels(channels);

        // İlk kanal yoksa seçme, varsa ilk metin kanalını seç
        if (channels.length > 0 && !getState('currentChannel')) {
            const firstTextChannel = channels.find(c => c.type === 'text');
            if (firstTextChannel) {
                selectChannel(firstTextChannel);
            }
        }
    });

    // Üyeleri dinle
    watchMembers((members) => {
        setState('members', members);
        updateMembers(members);
    });

    // Event listener'ları kur
    setupAppEvents();
}

/**
 * Kanal seç
 */
function selectChannel(channel) {
    setState('currentChannel', channel.id);
    setState('currentChannelType', channel.type);

    updateChatHeader(channel.name, channel.description);

    const serverId = getState('currentServer');

    // Önceki dinleyicileri temizle
    if (currentMessageUnsubscribe) {
        currentMessageUnsubscribe();
    }
    if (currentTypingUnsubscribe) {
        currentTypingUnsubscribe();
    }

    // Yeni mesajları dinle
    currentMessageUnsubscribe = watchMessages(serverId, channel.id, (messages) => {
        setState('messages', messages);
        renderMessages(messages);
    });

    // Yazılıyor göstergesini dinle
    const user = getState('user');
    currentTypingUnsubscribe = watchTyping(serverId, channel.id, user.uid, (typingUsers) => {
        updateTypingIndicator(typingUsers);
    });
}

/**
 * Uygulama event'lerini kur
 */
function setupAppEvents() {
    const user = getState('user');
    const serverId = getState('currentServer');

    // Kanal değişimi
    document.addEventListener('channelChange', (e) => {
        const channel = e.detail;
        selectChannel(channel);
    });

    // Mesaj gönder
    document.addEventListener('sendMessage', async (e) => {
        const { text } = e.detail;
        const channelId = getState('currentChannel');
        if (!channelId) return;

        await sendMessage(serverId, channelId, user, text);

        // Yazılıyor durumunu temizle
        setTypingStatus(serverId, channelId, user.uid, user.displayName, false);
    });

    // Mesaj sil
    document.addEventListener('deleteMessage', async (e) => {
        const { messageId } = e.detail;
        const channelId = getState('currentChannel');
        if (!channelId || !messageId) return;

        await deleteMessage(serverId, channelId, messageId);
    });

    // Mesaj düzenle
    document.addEventListener('editMessage', async (e) => {
        const { messageId } = e.detail;
        const channelId = getState('currentChannel');
        if (!channelId || !messageId) return;

        const messages = getState('messages');
        const msg = messages.find(m => m.id === messageId);
        if (!msg) return;

        const newText = prompt('Mesajı düzenle:', msg.text);
        if (newText && newText !== msg.text) {
            await editMessage(serverId, channelId, messageId, newText);
        }
    });

    // Yazılıyor durumu
    const typingDebounce = debounce(() => {
        const channelId = getState('currentChannel');
        if (channelId) {
            setTypingStatus(serverId, channelId, user.uid, user.displayName, false);
        }
    }, 3000);

    document.addEventListener('typing', (e) => {
        const { isTyping } = e.detail;
        const channelId = getState('currentChannel');
        if (!channelId) return;

        if (isTyping) {
            setTypingStatus(serverId, channelId, user.uid, user.displayName, true);
            typingDebounce(); // 3 saniye sonra otomatik kapat
        } else {
            setTypingStatus(serverId, channelId, user.uid, user.displayName, false);
        }
    });

    // Üye paneli toggle
    document.addEventListener('toggleMembers', () => {
        const panel = document.getElementById('membersContainer');
        if (panel) {
            const isVisible = !panel.classList.contains('hidden');
            panel.classList.toggle('hidden');

            const btn = document.getElementById('toggleMembersBtn');
            if (btn) btn.classList.toggle('active', !isVisible);
        }
    });

    // Ayarları aç
    document.addEventListener('openSettings', () => {
        setState('ui.showSettings', true);
        renderSettings();
    });

    // Sesli kanala katıl
    document.addEventListener('voiceChannelJoin', async (e) => {
        const { id, name } = e.detail;
        const voice = getState('voice');

        // Zaten bağlıysa önce ayrıl
        if (voice.connected) {
            await leaveVoiceChannel(user);
        }

        const result = await joinVoiceChannel(serverId, id, name, user);
        if (!result.success) {
            alert(result.error);
        }
    });

    // Mikrofon toggle
    document.addEventListener('toggleMic', () => {
        toggleMicrophone();
    });

    // Hoparlör toggle
    document.addEventListener('toggleSpeaker', () => {
        toggleSpeaker();
    });

    // Kanal oluştur
    document.addEventListener('createChannel', async () => {
        const name = prompt('Yeni kanal adı:');
        if (!name || !name.trim()) return;

        const type = confirm('Sesli kanal mı? (Tamam = Sesli, İptal = Metin)') ? 'voice' : 'text';
        const description = prompt('Kanal açıklaması (opsiyonel):') || '';

        const result = await createChannel(serverId, name, type, description);
        if (!result.success) {
            alert('Kanal oluşturulamadı: ' + result.error);
        }
    });
}
