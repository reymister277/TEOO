// ========================================
// Ana Uygulama Bileşeni
// ========================================
// Tüm bileşenleri bir araya getirir ve olayları koordine eder

import { getState, setState, onStateChange } from '../utils/state.js';
import { renderSidebar, renderChannels, updateServerList } from './sidebar/Sidebar.js';
import { renderChatArea, updateChatHeader, renderMessages, updateTypingIndicator, startInlineEdit } from './chat/ChatArea.js';
import { renderMemberPanel, updateMembers } from './members/MemberPanel.js';
import { renderSettings } from './settings/UserSettings.js';
import { updateUserProfile } from '../services/auth.js';
import { renderFriendPanel, updateFriendContent, updatePendingBadge, showAddFriendResult } from './friends/FriendPanel.js';
import { renderHomePage } from './home/HomePage.js';
import { renderServerModal, showServerSuccess, showModalError } from './server/ServerModal.js';
import { renderServerSettings } from './server/ServerSettings.js';
import { showProfileCard } from './profile/ProfileCard.js';
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
    getUserServers,
    addReaction
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
import { joinVoiceChannel, leaveVoiceChannel, toggleMicrophone, toggleSpeaker, startScreenShare, stopScreenShare, isScreenSharing } from '../services/voice.js';
import { uploadChatFile, uploadProfileImage, getFileType } from '../services/storage.js';
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
/**
 * Ekran paylaşımı video viewer göster
 */
function showScreenViewer(stream, isLocal) {
    hideScreenViewer(); // Öncekini temizle

    const viewer = document.createElement('div');
    viewer.id = 'screenShareViewer';
    viewer.className = 'screen-share-overlay';
    viewer.innerHTML = `
        <div class="screen-share-header">
            <span>🖥️ ${isLocal ? 'Ekranınızı Paylaşıyorsunuz' : 'Ekran Paylaşımı'}</span>
            <div class="screen-share-header-actions">
                <button class="screen-share-fullscreen-btn" id="screenFullscreenBtn" title="Tam Ekran">⛶</button>
                ${isLocal ? '<button class="screen-share-stop-btn" id="screenStopBtn">Paylaşımı Durdur</button>' : ''}
            </div>
        </div>
        <div class="screen-share-video-container">
            <video id="screenShareVideo" autoplay playsinline></video>
        </div>
    `;

    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.style.position = 'relative';
        chatContainer.appendChild(viewer);
    } else {
        document.body.appendChild(viewer);
    }

    const video = document.getElementById('screenShareVideo');
    if (video) {
        video.srcObject = stream;
    }

    // Paylaşımı durdur butonu
    document.getElementById('screenStopBtn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('toggleScreenShare'));
    });

    // Tam ekran
    document.getElementById('screenFullscreenBtn')?.addEventListener('click', () => {
        const videoEl = document.getElementById('screenShareVideo');
        if (videoEl) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                videoEl.requestFullscreen().catch(() => { });
            }
        }
    });

    // Ekran paylaş butonunu aktif yap
    const btn = document.getElementById('screenShareBtn');
    if (btn) { btn.textContent = '🔴'; btn.classList.add('active'); }
}

/**
 * Ekran paylaşımı viewer'ı kaldır
 */
function hideScreenViewer() {
    const viewer = document.getElementById('screenShareViewer');
    if (viewer) viewer.remove();
}

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
        const { text, attachment } = e.detail;
        const serverId = currentServerId || getState('currentServer');

        if (appMode === 'friends' && currentDMFriend) {
            const chatId = getDMChatId(user.uid, currentDMFriend.uid);
            await sendDirectMessage(chatId, user, text);
        } else {
            const channelId = getState('currentChannel');
            if (!channelId) return;
            await sendMessage(serverId, channelId, user, text, attachment || null);
            setTypingStatus(serverId, channelId, user.uid, user.displayName, false);
        }
    });

    // Dosya yükleme
    document.addEventListener('uploadFile', async (e) => {
        const { file } = e.detail;
        const serverId = currentServerId || getState('currentServer');
        const channelId = getState('currentChannel');
        if (!channelId) return;

        // Yükleme göstergesi
        const input = document.getElementById('messageInput');
        const origPlaceholder = input?.placeholder || '';
        if (input) input.placeholder = 'Dosya yükleniyor... 0%';

        const result = await uploadChatFile(file, serverId, channelId, (progress) => {
            if (input) input.placeholder = `Dosya yükleniyor... ${progress}%`;
        });

        if (input) input.placeholder = origPlaceholder;

        if (result.success) {
            const fileType = getFileType(file.name);
            await sendMessage(serverId, channelId, user, '', {
                url: result.url,
                name: file.name,
                size: file.size,
                type: file.type,
                fileType
            });
        } else {
            alert(result.error || 'Dosya yüklenemedi!');
        }
    });

    // Profil resmi yükleme
    document.addEventListener('uploadProfileImage', async (e) => {
        const { file } = e.detail;
        const result = await uploadProfileImage(file, user.uid);
        if (result.success) {
            // Firestore kullanıcı dokümanını güncelle
            await updateUserProfile(user.uid, { photoURL: result.url });
            // Sidebar avatarı güncelle
            const sidebarAvatar = document.getElementById('sidebarAvatar');
            if (sidebarAvatar) {
                sidebarAvatar.innerHTML = `<img src="${result.url}" class="avatar-image" alt="Profil" />`;
            }
            setState('user', { ...getState('user'), photoURL: result.url });
        } else {
            alert(result.error || 'Profil resmi yüklenemedi!');
        }
    });

    // Hesap adı değiştirme
    document.addEventListener('changeDisplayName', async (e) => {
        const { newName } = e.detail;
        if (!newName || !newName.trim()) return;
        const result = await updateUserProfile(user.uid, { displayName: newName.trim() });
        if (result.success) {
            setState('user', { ...getState('user'), displayName: newName.trim() });
            // Sidebar güncelle
            const sidebarName = document.getElementById('sidebarUserName');
            if (sidebarName) sidebarName.textContent = newName.trim();
        } else {
            alert(result.error || 'Ad değiştirilemedi!');
        }
    });

    document.addEventListener('deleteMessage', async (e) => {
        const { messageId } = e.detail;
        const serverId = currentServerId || getState('currentServer');
        const channelId = getState('currentChannel');
        if (!channelId || !messageId) return;
        await deleteMessage(serverId, channelId, messageId);
    });

    // Inline edit başlat (edit butonuna tıklandığında)
    document.addEventListener('editMessage', (e) => {
        const { messageId } = e.detail;
        startInlineEdit(messageId);
    });

    // Inline edit kaydet
    document.addEventListener('saveEditMessage', async (e) => {
        const { messageId, newText } = e.detail;
        const serverId = currentServerId || getState('currentServer');
        const channelId = getState('currentChannel');
        if (!channelId || !messageId || !newText) return;
        await editMessage(serverId, channelId, messageId, newText);
    });

    // Emoji tepkisi
    document.addEventListener('addReaction', async (e) => {
        const { messageId, emoji } = e.detail;
        const serverId = currentServerId || getState('currentServer');
        const channelId = getState('currentChannel');
        if (!channelId || !messageId || !emoji) return;
        await addReaction(serverId, channelId, messageId, emoji, user.uid, user.displayName);
    });

    // Profil kartı göster
    document.addEventListener('showProfileCard', (e) => {
        const { uid, displayName, anchorEl } = e.detail;
        showProfileCard(uid, displayName, anchorEl);
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

    document.addEventListener('toggleMic', () => {
        const enabled = toggleMicrophone();
        const btn = document.getElementById('micToggleBtn');
        if (btn) {
            btn.textContent = enabled ? '🎤' : '🔇';
            btn.classList.toggle('muted', !enabled);
        }
    });
    document.addEventListener('toggleSpeaker', () => {
        const enabled = toggleSpeaker();
        const btn = document.getElementById('speakerToggleBtn');
        if (btn) {
            btn.textContent = enabled ? '🔊' : '🔈';
            btn.classList.toggle('muted', !enabled);
        }
    });

    // Konuşurken avatar ışığı
    document.addEventListener('speakingChanged', (e) => {
        const { speaking } = e.detail;
        const avatar = document.getElementById('sidebarAvatar');
        if (avatar) {
            avatar.classList.toggle('speaking', speaking);
        }
        // Voice room'daki kendi avatar'ımız
        const myParticipant = document.querySelector('.voice-participant.me');
        if (myParticipant) {
            myParticipant.classList.toggle('speaking', speaking);
        }
        // Sidebar'daki ses kanalı kullanıcı listesinde kendi ikonumuz
        const myVoiceUser = document.querySelector(`.voice-user-item[data-uid="${user.uid}"]`);
        if (myVoiceUser) {
            myVoiceUser.classList.toggle('speaking', speaking);
        }
    });

    // Mic toggle event (buton güncelleme)
    document.addEventListener('micToggled', (e) => {
        const btn = document.getElementById('micToggleBtn');
        if (btn) {
            btn.textContent = e.detail.enabled ? '🎤' : '🔇';
            btn.classList.toggle('muted', !e.detail.enabled);
        }
    });

    // Speaker toggle event
    document.addEventListener('speakerToggled', (e) => {
        const btn = document.getElementById('speakerToggleBtn');
        if (btn) {
            btn.textContent = e.detail.enabled ? '🔊' : '🔈';
            btn.classList.toggle('muted', !e.detail.enabled);
        }
    });

    // Ekran paylaşımı toggle
    document.addEventListener('toggleScreenShare', async () => {
        if (isScreenSharing()) {
            stopScreenShare();
        } else {
            const result = await startScreenShare();
            if (!result.success) {
                alert(result.error);
            }
        }
    });

    // Bağlantıyı kes
    document.addEventListener('disconnectVoice', () => {
        stopScreenShare();
        leaveVoiceChannel(user);
    });

    // Ekran paylaşımı başladı - video viewer göster
    document.addEventListener('screenShareStarted', (e) => {
        showScreenViewer(e.detail.stream, true);
    });

    // Uzaktan ekran paylaşımı geldi
    document.addEventListener('screenShareReceived', (e) => {
        showScreenViewer(e.detail.stream, false);
    });

    // Ekran paylaşımı durdu
    document.addEventListener('screenShareStopped', () => {
        hideScreenViewer();
        const btn = document.getElementById('screenShareBtn');
        if (btn) { btn.textContent = '🖥️'; btn.classList.remove('active'); }
    });

    document.addEventListener('createChannel', async () => {
        const name = prompt('Yeni kanal adı:');
        if (!name || !name.trim()) return;
        const type = confirm('Sesli kanal mı? (Tamam = Sesli, İptal = Metin)') ? 'voice' : 'text';
        const description = prompt('Kanal açıklaması (opsiyonel):') || '';
        const serverId = currentServerId || getState('currentServer');
        const result = await createChannel(serverId, name, type, description);
        if (!result.success) alert('Kanal oluşturulamadı: ' + result.error);
    });

    // ====== MOBİL SIDEBAR TOGGLE ======
    setupMobileSidebar();
}

/**
 * Mobil sidebar açma/kapama sistemi
 */
function setupMobileSidebar() {
    // Overlay oluştur
    let overlay = document.querySelector('.mobile-sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'mobile-sidebar-overlay';
        document.body.appendChild(overlay);
    }

    const sidebar = document.getElementById('sidebarContainer');
    const members = document.getElementById('membersContainer');

    // Hamburger menü — sidebar aç
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
        sidebar?.classList.toggle('mobile-open');
        overlay.classList.toggle('active', sidebar?.classList.contains('mobile-open'));
        // Members paneli kapat
        members?.classList.remove('mobile-open');
    });

    // Overlay'a tıklayınca hepsini kapat
    overlay.addEventListener('click', () => {
        sidebar?.classList.remove('mobile-open');
        members?.classList.remove('mobile-open');
        overlay.classList.remove('active');
    });

    // Üye paneli toggle — mobilde overlay
    document.addEventListener('toggleMembers', () => {
        if (window.innerWidth <= 768) {
            members?.classList.toggle('mobile-open');
            overlay.classList.toggle('active', members?.classList.contains('mobile-open'));
            sidebar?.classList.remove('mobile-open');
        }
    });

    // Kanal seçilince sidebar kapat (mobil)
    document.addEventListener('selectChannel', () => {
        if (window.innerWidth <= 768) {
            sidebar?.classList.remove('mobile-open');
            overlay.classList.remove('active');
        }
    });

    // ESC ile kapat
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.innerWidth <= 768) {
            sidebar?.classList.remove('mobile-open');
            members?.classList.remove('mobile-open');
            overlay.classList.remove('active');
        }
    });
}
