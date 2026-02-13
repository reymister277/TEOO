// ========================================
// Ana Uygulama Bileşeni
// ========================================
// Tüm bileşenleri bir araya getirir ve olayları koordine eder

import { getState, setState, onStateChange } from '../utils/state.js';
import { renderSidebar, renderChannels, updateServerList } from './sidebar/Sidebar.js';
import { renderChatArea, updateChatHeader, renderMessages, updateTypingIndicator } from './chat/ChatArea.js';
import { renderMemberPanel, updateMembers } from './members/MemberPanel.js';
import { renderSettings } from './settings/UserSettings.js';
import { renderFriendPanel, updateFriendContent, updatePendingBadge, showAddFriendResult } from './friends/FriendPanel.js';
import { renderHomePage } from './home/HomePage.js';
import { renderServerModal, showServerSuccess, showModalError } from './server/ServerModal.js';
import { renderServerSettings } from './server/ServerSettings.js';
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
    watchTyping,
    createServer,
    joinServerByCode,
    getUserServers
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
let currentChannelUnsubscribe = null;
let friendRequestsUnsubscribe = null;
let friendsUnsubscribe = null;
let dmMessagesUnsubscribe = null;

// Uygulama modu: 'home' | 'server' | 'friends'
let appMode = 'home';
let currentDMFriend = null;
let currentServerId = null;

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

    // Varsayılan sunucuyu oluştur/yükle
    const serverId = await createDefaultServer(user.uid);
    currentServerId = serverId;
    setState('currentServer', serverId);

    // Sunucu listesini yükle
    const servers = await getUserServers(user.uid);
    setState('serverList', servers);
    updateServerList(servers);

    // Üyeleri dinle (sunucu bazlı)
    watchMembers(currentServerId, (members) => {
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

    // Karşılama sayfasını göster
    showHomeMode();
}

/**
 * Karşılama sayfası modu
 */
function showHomeMode() {
    appMode = 'home';
    currentDMFriend = null;

    const chatContainer = document.getElementById('chatContainer');
    const membersContainer = document.getElementById('membersContainer');

    if (chatContainer) {
        renderHomePage(chatContainer);
    }
    if (membersContainer) membersContainer.style.display = 'none';
}

/**
 * Sunucu seç ve kanallarını yükle
 */
function selectServer(serverId) {
    currentServerId = serverId;
    setState('currentServer', serverId);
    setState('currentChannel', null);

    // Önceki kanal dinleyicisini temizle
    if (currentChannelUnsubscribe) {
        currentChannelUnsubscribe();
        currentChannelUnsubscribe = null;
    }

    // Kanalları dinle
    currentChannelUnsubscribe = watchChannels(serverId, (channels) => {
        setState('channels', channels);
        renderChannels(channels);

        // İlk metin kanalını seç
        if (channels.length > 0 && !getState('currentChannel')) {
            const firstTextChannel = channels.find(c => c.type === 'text');
            if (firstTextChannel) {
                selectChannel(firstTextChannel);
            }
        }
    });

    // Üyeleri sunucu bazlı dinle
    watchMembers(serverId, (members) => {
        setState('members', members);
        updateMembers(members);
    });
}

/**
 * Kanal seç (sunucu modu)
 */
function selectChannel(channel) {
    appMode = 'server';
    currentDMFriend = null;
    setState('currentChannel', channel.id);
    setState('currentChannelType', channel.type);

    // Chat alanını göster
    showChatMode();

    updateChatHeader(channel.name, channel.description);

    const serverId = currentServerId || getState('currentServer');

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

    showChatMode();
    updateChatHeader(`@${friend.displayName}`, 'Direkt Mesaj');

    cleanupMessageListeners();

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

    if (chatContainer) {
        renderChatArea(chatContainer);
        chatContainer.style.display = 'flex';
    }
    if (membersContainer) membersContainer.style.display = 'flex';
    renderMemberPanel(document.getElementById('membersContainer'));
}

/**
 * Arkadaş modu
 */
function showFriendsMode() {
    appMode = 'friends';
    currentDMFriend = null;

    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        renderFriendPanel(chatContainer);
    }
    const membersContainer = document.getElementById('membersContainer');
    if (membersContainer) membersContainer.style.display = 'none';
}

/**
 * Mesaj dinleyicilerini temizle
 */
function cleanupMessageListeners() {
    if (currentMessageUnsubscribe) { currentMessageUnsubscribe(); currentMessageUnsubscribe = null; }
    if (currentTypingUnsubscribe) { currentTypingUnsubscribe(); currentTypingUnsubscribe = null; }
    if (dmMessagesUnsubscribe) { dmMessagesUnsubscribe(); dmMessagesUnsubscribe = null; }
}

/**
 * Uygulama event'lerini kur
 */
function setupAppEvents() {
    const user = getState('user');

    // ====== SUNUCU EVENT'LERİ ======

    // Sunucu değiştir
    document.addEventListener('switchServer', (e) => {
        const { serverId } = e.detail;
        selectServer(serverId);
    });

    // Ana sayfa
    document.addEventListener('showHome', () => {
        showHomeMode();
    });

    // Sunucu modal aç
    document.addEventListener('openServerModal', (e) => {
        const mode = e.detail?.mode || 'choose';
        renderServerModal(mode);
    });

    // Sunucu ayarları aç
    document.addEventListener('openServerSettings', () => {
        if (currentServerId && currentServerId !== 'teoo-main') {
            renderServerSettings(currentServerId);
        }
    });

    // Sunucu oluştur
    document.addEventListener('createServerRequest', async (e) => {
        const { name, icon } = e.detail;
        const result = await createServer(name, icon, user.uid, user.displayName);
        if (result.success) {
            // Sunucu listesini güncelle
            const servers = await getUserServers(user.uid);
            setState('serverList', servers);
            updateServerList(servers);
            showServerSuccess('created', { serverId: result.serverId, inviteCode: result.inviteCode });
        } else {
            showModalError('createStatus', `❌ ${result.error}`);
        }
    });

    // Sunucuya katıl
    document.addEventListener('joinServerRequest', async (e) => {
        const { inviteCode } = e.detail;
        const result = await joinServerByCode(inviteCode, user.uid, user.displayName);
        if (result.success) {
            const servers = await getUserServers(user.uid);
            setState('serverList', servers);
            updateServerList(servers);
            showServerSuccess('joined', { serverId: result.serverId, serverName: result.serverName });
        } else {
            showModalError('joinStatus', `❌ ${result.error}`);
        }
    });

    // Kanal değişimi
    document.addEventListener('channelChange', (e) => {
        selectChannel(e.detail);
    });

    // ====== ARKADAŞ SİSTEMİ EVENT'LERİ ======

    document.addEventListener('showFriends', () => {
        showFriendsMode();
    });

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

    document.addEventListener('acceptFriendRequest', async (e) => {
        const { requestId, fromUid } = e.detail;
        await acceptFriendRequest(requestId, user.uid, fromUid);
    });

    document.addEventListener('rejectFriendRequest', async (e) => {
        const { requestId } = e.detail;
        await rejectFriendRequest(requestId);
    });

    document.addEventListener('openDM', (e) => {
        openDM(e.detail.friendUid);
    });

    // ====== MESAJ EVENT'LERİ ======

    document.addEventListener('sendMessage', async (e) => {
        const { text } = e.detail;
        const serverId = currentServerId || getState('currentServer');

        if (appMode === 'friends' && currentDMFriend) {
            const chatId = getDMChatId(user.uid, currentDMFriend.uid);
            await sendDirectMessage(chatId, user, text);
        } else {
            const channelId = getState('currentChannel');
            if (!channelId) return;
            await sendMessage(serverId, channelId, user, text);
            setTypingStatus(serverId, channelId, user.uid, user.displayName, false);
        }
    });

    document.addEventListener('deleteMessage', async (e) => {
        const { messageId } = e.detail;
        const serverId = currentServerId || getState('currentServer');
        const channelId = getState('currentChannel');
        if (!channelId || !messageId) return;
        await deleteMessage(serverId, channelId, messageId);
    });

    document.addEventListener('editMessage', async (e) => {
        const { messageId } = e.detail;
        const serverId = currentServerId || getState('currentServer');
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

    const typingDebounce = debounce(() => {
        const serverId = currentServerId || getState('currentServer');
        const channelId = getState('currentChannel');
        if (channelId) {
            setTypingStatus(serverId, channelId, user.uid, user.displayName, false);
        }
    }, 3000);

    document.addEventListener('typing', (e) => {
        if (appMode !== 'server') return;
        const { isTyping } = e.detail;
        const serverId = currentServerId || getState('currentServer');
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

    document.addEventListener('toggleMembers', () => {
        const panel = document.getElementById('membersContainer');
        if (panel) {
            panel.classList.toggle('hidden');
            const btn = document.getElementById('toggleMembersBtn');
            if (btn) btn.classList.toggle('active');
        }
    });

    document.addEventListener('openSettings', () => {
        setState('ui.showSettings', true);
        renderSettings();
    });

    // ====== SESLİ KANAL EVENT'LERİ ======

    document.addEventListener('voiceChannelJoin', async (e) => {
        const { id, name } = e.detail;
        const voice = getState('voice');
        const serverId = currentServerId || getState('currentServer');
        if (voice.connected) await leaveVoiceChannel(user);
        const result = await joinVoiceChannel(serverId, id, name, user);
        if (!result.success) alert(result.error);
    });

    document.addEventListener('toggleMic', () => toggleMicrophone());
    document.addEventListener('toggleSpeaker', () => toggleSpeaker());

    document.addEventListener('createChannel', async () => {
        const name = prompt('Yeni kanal adı:');
        if (!name || !name.trim()) return;
        const type = confirm('Sesli kanal mı? (Tamam = Sesli, İptal = Metin)') ? 'voice' : 'text';
        const description = prompt('Kanal açıklaması (opsiyonel):') || '';
        const serverId = currentServerId || getState('currentServer');
        const result = await createChannel(serverId, name, type, description);
        if (!result.success) alert('Kanal oluşturulamadı: ' + result.error);
    });
}
