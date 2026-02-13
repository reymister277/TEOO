// ========================================
// Ana Uygulama Bileşeni
// ========================================
// Tüm bileşenleri bir araya getirir ve olayları koordine eder

import { getState, setState, onStateChange } from '../utils/state.js';
import { renderSidebar, renderChannels } from './sidebar/Sidebar.js';
import { renderChatArea, updateChatHeader, renderMessages, updateTypingIndicator } from './chat/ChatArea.js';
import { renderMemberPanel, updateMembers } from './members/MemberPanel.js';
import { renderSettings } from './settings/UserSettings.js';
import { renderFriendPanel, updateFriendContent, updatePendingBadge, showAddFriendResult } from './friends/FriendPanel.js';
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
import {
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    watchFriendRequests,
    watchFriends,
    sendDirectMessage,
    watchDirectMessages,
    getDMChatId
} from '../services/friends.js';
import { joinVoiceChannel, leaveVoiceChannel, toggleMicrophone, toggleSpeaker } from '../services/voice.js';
import { debounce } from '../utils/helpers.js';

let currentMessageUnsubscribe = null;
let currentTypingUnsubscribe = null;
let friendRequestsUnsubscribe = null;
let friendsUnsubscribe = null;
let dmMessagesUnsubscribe = null;

// Uygulama modu: 'server' veya 'friends'
let appMode = 'server';
let currentDMFriend = null;

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

    // Arkadaş isteklerini dinle
    friendRequestsUnsubscribe = watchFriendRequests(user.uid, (requests) => {
        setState('friendRequests', requests);
        updatePendingBadge(requests.length);
        if (appMode === 'friends') updateFriendContent();
    });

    // Arkadaş listesini dinle
    friendsUnsubscribe = watchFriends(user.uid, (friends) => {
        setState('friendsList', friends);
        if (appMode === 'friends') updateFriendContent();
    });

    // Event listener'ları kur
    setupAppEvents();
}

/**
 * Kanal seç (sunucu modu)
 */
function selectChannel(channel) {
    appMode = 'server';
    currentDMFriend = null;
    setState('currentChannel', channel.id);
    setState('currentChannelType', channel.type);

    // Chat alanını göster, arkadaş panelini gizle
    showChatMode();

    updateChatHeader(channel.name, channel.description);

    const serverId = getState('currentServer');

    // Önceki dinleyicileri temizle
    cleanupMessageListeners();

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
 * DM aç
 */
function openDM(friendUid) {
    const user = getState('user');
    const friends = getState('friendsList') || [];
    const friend = friends.find(f => f.uid === friendUid);
    if (!friend) return;

    appMode = 'friends';
    currentDMFriend = friend;

    // Chat alanını göster
    showChatMode();
    updateChatHeader(`@${friend.displayName}`, 'Direkt Mesaj');

    // Önceki dinleyicileri temizle
    cleanupMessageListeners();

    // DM mesajlarını dinle
    const chatId = getDMChatId(user.uid, friendUid);
    dmMessagesUnsubscribe = watchDirectMessages(chatId, (messages) => {
        setState('messages', messages);
        renderMessages(messages);
    });
}

/**
 * Chat modu - chat alanını göster
 */
function showChatMode() {
    const chatContainer = document.getElementById('chatContainer');
    const membersContainer = document.getElementById('membersContainer');
    if (chatContainer) chatContainer.style.display = 'flex';
    if (membersContainer) membersContainer.style.display = 'flex';
}

/**
 * Arkadaş modu - friend panel göster
 */
function showFriendsMode() {
    appMode = 'friends';
    currentDMFriend = null;

    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        renderFriendPanel(chatContainer);
    }

    // Members panelini gizle
    const membersContainer = document.getElementById('membersContainer');
    if (membersContainer) membersContainer.style.display = 'none';
}

/**
 * Mesaj dinleyicilerini temizle
 */
function cleanupMessageListeners() {
    if (currentMessageUnsubscribe) {
        currentMessageUnsubscribe();
        currentMessageUnsubscribe = null;
    }
    if (currentTypingUnsubscribe) {
        currentTypingUnsubscribe();
        currentTypingUnsubscribe = null;
    }
    if (dmMessagesUnsubscribe) {
        dmMessagesUnsubscribe();
        dmMessagesUnsubscribe = null;
    }
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

    // ====== ARKADAŞ SİSTEMİ EVENT'LERİ ======

    // Ana sayfa / Arkadaşlar moduna geç
    document.addEventListener('showFriends', () => {
        showFriendsMode();
    });

    // Arkadaş kodu ile istek gönder
    document.addEventListener('sendFriendRequest', async (e) => {
        const { code } = e.detail;
        const result = await sendFriendRequest(user.uid, code);
        showAddFriendResult(
            result.success,
            result.success
                ? `✅ ${result.targetName}'e arkadaşlık isteği gönderildi!`
                : `❌ ${result.error}`
        );
    });

    // Arkadaşlık isteğini kabul et
    document.addEventListener('acceptFriendRequest', async (e) => {
        const { requestId, fromUid } = e.detail;
        await acceptFriendRequest(requestId, user.uid, fromUid);
    });

    // Arkadaşlık isteğini reddet
    document.addEventListener('rejectFriendRequest', async (e) => {
        const { requestId } = e.detail;
        await rejectFriendRequest(requestId);
    });

    // DM aç
    document.addEventListener('openDM', (e) => {
        const { friendUid } = e.detail;
        openDM(friendUid);
    });

    // ====== MESAJ EVENT'LERİ ======

    // Mesaj gönder
    document.addEventListener('sendMessage', async (e) => {
        const { text } = e.detail;

        if (appMode === 'friends' && currentDMFriend) {
            // DM mesajı
            const chatId = getDMChatId(user.uid, currentDMFriend.uid);
            await sendDirectMessage(chatId, user, text);
        } else {
            // Sunucu mesajı
            const channelId = getState('currentChannel');
            if (!channelId) return;
            await sendMessage(serverId, channelId, user, text);
            setTypingStatus(serverId, channelId, user.uid, user.displayName, false);
        }
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
        if (appMode !== 'server') return; // DM'de henüz typing yok
        const { isTyping } = e.detail;
        const channelId = getState('currentChannel');
        if (!channelId) return;

        if (isTyping) {
            setTypingStatus(serverId, channelId, user.uid, user.displayName, true);
            typingDebounce();
        } else {
            setTypingStatus(serverId, channelId, user.uid, user.displayName, false);
        }
    });

    // ====== UI EVENT'LERİ ======

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

    // ====== SESLİ KANAL EVENT'LERİ ======

    document.addEventListener('voiceChannelJoin', async (e) => {
        const { id, name } = e.detail;
        const voice = getState('voice');

        if (voice.connected) {
            await leaveVoiceChannel(user);
        }

        const result = await joinVoiceChannel(serverId, id, name, user);
        if (!result.success) {
            alert(result.error);
        }
    });

    document.addEventListener('toggleMic', () => {
        toggleMicrophone();
    });

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
