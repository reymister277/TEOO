// ========================================
// Sohbet Alanı Bileşeni
// ========================================

import { getState, onStateChange } from '../../utils/state.js';
import { formatTime, formatDate, escapeHtml, getInitials, getAvatarColor } from '../../utils/helpers.js';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '💀', '😮', '🎉', '💯'];

export function renderChatArea(container) {
    container.innerHTML = `
        <div class="main-content">
            <!-- Chat Başlık -->
            <div class="chat-header">
                <div class="chat-header-left">
                    <span class="chat-header-icon">#</span>
                    <span class="chat-header-name" id="chatChannelName">genel</span>
                    <div class="chat-header-divider"></div>
                    <span class="chat-header-topic" id="chatChannelTopic">Genel sohbet kanalı</span>
                </div>
                <div class="chat-header-actions">
                    <button class="header-action-btn" title="Bildirimler">🔔</button>
                    <button class="header-action-btn" title="Sabitlenenler">📌</button>
                    <button class="header-action-btn" title="Üyeler" id="toggleMembersBtn">👥</button>
                    <button class="header-action-btn" title="Ara">🔍</button>
                </div>
            </div>
            
            <!-- Mesaj Alanı -->
            <div class="messages-area" id="messagesArea">
                <div class="welcome-message">
                    <div class="welcome-icon">#</div>
                    <div class="welcome-title">genel kanalına hoş geldin!</div>
                    <div class="welcome-desc">Bu kanalın başlangıcı. Konuşmaya başla!</div>
                </div>
            </div>
            
            <!-- Yazılıyor Göstergesi -->
            <div class="typing-indicator" id="typingIndicator"></div>
            
            <!-- Mesaj Girişi -->
            <div class="message-input-area">
                <div class="message-input-wrapper">
                    <div class="input-actions-left">
                        <button class="input-action-btn" title="Dosya Ekle" id="attachFileBtn">📎</button>
                    </div>
                    <textarea class="message-textarea" id="messageInput" 
                        placeholder="Mesaj gönder..." 
                        rows="1" 
                        maxlength="2000"></textarea>
                    <div class="input-actions-right">
                        <button class="input-action-btn" title="Emoji" id="emojiBtn">😊</button>
                        <button class="send-button" id="sendBtn" title="Gönder">➤</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupChatEvents();
}

/**
 * Chat header'ı güncelle
 */
export function updateChatHeader(channelName, description) {
    const nameEl = document.getElementById('chatChannelName');
    const topicEl = document.getElementById('chatChannelTopic');
    const welcomeTitle = document.querySelector('.welcome-title');

    if (nameEl) nameEl.textContent = channelName;
    if (topicEl) topicEl.textContent = description || '';
    if (welcomeTitle) welcomeTitle.textContent = `${channelName} kanalına hoş geldin!`;

    // Input placeholder'ı güncelle
    const input = document.getElementById('messageInput');
    if (input) input.placeholder = `#${channelName} kanalına mesaj gönder...`;
}

/**
 * Emoji tepkilerini render et
 */
function renderReactions(reactions, msgId) {
    if (!reactions || Object.keys(reactions).length === 0) return '';

    const user = getState('user');
    return `
        <div class="message-reactions">
            ${Object.entries(reactions).map(([emoji, users]) => {
        const hasReacted = users.some(u => u.uid === user?.uid);
        const names = users.map(u => u.name).join(', ');
        return `
                    <button class="reaction-btn ${hasReacted ? 'reacted' : ''}" 
                            data-emoji="${emoji}" data-msg-id="${msgId}" title="${names}">
                        ${emoji} <span class="reaction-count">${users.length}</span>
                    </button>
                `;
    }).join('')}
        </div>
    `;
}

/**
 * Mesajları render et
 */
export function renderMessages(messages) {
    const container = document.getElementById('messagesArea');
    if (!container) return;

    // Hoş geldin mesajını koru, gerisini temizle
    const welcome = container.querySelector('.welcome-message');
    container.innerHTML = '';
    if (welcome) container.appendChild(welcome);

    let lastAuthor = null;
    let lastDate = null;

    messages.forEach((msg) => {
        const msgDate = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp?.seconds * 1000 || Date.now());
        const dateStr = formatDate(msgDate);

        // Tarih ayracı
        if (dateStr !== lastDate) {
            lastDate = dateStr;
            const separator = document.createElement('div');
            separator.className = 'date-separator';
            separator.textContent = dateStr;
            container.appendChild(separator);
            lastAuthor = null;
        }

        const group = document.createElement('div');
        group.className = 'message-group';
        group.dataset.messageId = msg.id;

        const isCompact = lastAuthor === msg.authorId;
        const avatarColor = getAvatarColor(msg.author);
        const time = formatTime(msgDate);

        group.innerHTML = `
            <div class="message ${isCompact ? 'compact' : ''}">
                ${!isCompact ? `
                    <div class="message-avatar clickable-user" data-uid="${msg.authorId}" data-uname="${escapeHtml(msg.author)}" style="background: ${avatarColor}">
                        ${msg.avatar || getInitials(msg.author)}
                    </div>
                ` : ''}
                <div class="message-body">
                    ${!isCompact ? `
                        <div class="message-header">
                            <span class="message-author clickable-user" data-uid="${msg.authorId}" data-uname="${escapeHtml(msg.author)}">${escapeHtml(msg.author)}</span>
                            <span class="message-timestamp">${time}</span>
                        </div>
                    ` : ''}
                    <div class="message-text">${escapeHtml(msg.text)}${msg.edited ? '<span class="message-edited-tag">(düzenlenmiş)</span>' : ''}</div>
                    ${renderReactions(msg.reactions, msg.id)}
                </div>
            </div>
            <div class="message-actions">
                ${msg.authorId === getState('user')?.uid ? `
                    <button class="message-action-btn" data-action="edit" title="Düzenle">✏️</button>
                    <button class="message-action-btn delete" data-action="delete" title="Sil">🗑️</button>
                ` : ''}
                <button class="message-action-btn" data-action="react" title="Tepki">😀</button>
            </div>
        `;

        container.appendChild(group);
        lastAuthor = msg.authorId;
    });

    // En alta kaydır
    container.scrollTop = container.scrollHeight;
}

/**
 * Inline edit modunu başlat
 */
export function startInlineEdit(messageId) {
    const messages = getState('messages') || [];
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    const group = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!group) return;

    const textEl = group.querySelector('.message-text');
    if (!textEl) return;

    const originalText = msg.text;
    textEl.innerHTML = `
        <div class="inline-edit-container">
            <textarea class="inline-edit-input" rows="1">${escapeHtml(originalText)}</textarea>
            <div class="inline-edit-actions">
                <span class="inline-edit-hint">Esc ile iptal • Enter ile kaydet</span>
                <button class="inline-edit-cancel">İptal</button>
                <button class="inline-edit-save">Kaydet</button>
            </div>
        </div>
    `;

    const textarea = textEl.querySelector('.inline-edit-input');
    textarea.focus();
    textarea.selectionStart = textarea.value.length;

    // Auto-resize
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';

    // Kaydet
    const save = () => {
        const newText = textarea.value.trim();
        if (newText && newText !== originalText) {
            document.dispatchEvent(new CustomEvent('saveEditMessage', {
                detail: { messageId, newText }
            }));
        } else {
            // İptal - geri yükle
            textEl.innerHTML = `${escapeHtml(originalText)}${msg.edited ? '<span class="message-edited-tag">(düzenlenmiş)</span>' : ''}`;
        }
    };

    const cancel = () => {
        textEl.innerHTML = `${escapeHtml(originalText)}${msg.edited ? '<span class="message-edited-tag">(düzenlenmiş)</span>' : ''}`;
    };

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
        if (e.key === 'Escape') cancel();
    });

    textEl.querySelector('.inline-edit-save')?.addEventListener('click', save);
    textEl.querySelector('.inline-edit-cancel')?.addEventListener('click', cancel);
}

/**
 * Emoji picker göster
 */
function showEmojiPicker(messageId, anchorEl) {
    // Mevcut picker'ı kaldır
    document.querySelector('.emoji-picker-popup')?.remove();

    const picker = document.createElement('div');
    picker.className = 'emoji-picker-popup';
    picker.innerHTML = `
        <div class="emoji-picker-grid">
            ${QUICK_EMOJIS.map(e => `<button class="emoji-pick-btn" data-emoji="${e}">${e}</button>`).join('')}
        </div>
    `;

    // Pozisyon
    const rect = anchorEl.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    picker.style.left = rect.left + 'px';
    picker.style.zIndex = '9999';

    document.body.appendChild(picker);

    picker.querySelectorAll('.emoji-pick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('addReaction', {
                detail: { messageId, emoji: btn.dataset.emoji }
            }));
            picker.remove();
        });
    });

    // Dışarı tıklayınca kapat
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', handler);
            }
        });
    }, 0);
}

/**
 * Yazılıyor göstergesini güncelle
 */
export function updateTypingIndicator(typingUsers) {
    const indicator = document.getElementById('typingIndicator');
    if (!indicator) return;

    if (typingUsers.length === 0) {
        indicator.innerHTML = '';
    } else if (typingUsers.length === 1) {
        indicator.innerHTML = `
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
            <strong>${typingUsers[0]}</strong> yazıyor...
        `;
    } else {
        indicator.innerHTML = `
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
            <strong>${typingUsers.length} kişi</strong> yazıyor...
        `;
    }
}

function setupChatEvents() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    if (!input || !sendBtn) return;

    // Mesaj gönder
    sendBtn.addEventListener('click', () => {
        const text = input.value.trim();
        if (text) {
            document.dispatchEvent(new CustomEvent('sendMessage', { detail: { text } }));
            input.value = '';
            input.style.height = 'auto';
            sendBtn.classList.remove('active');
        }
    });

    // Enter ile gönder (Shift+Enter yeni satır)
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

    // Input güncellemeleri
    input.addEventListener('input', () => {
        // Textarea yüksekliğini otomatik ayarla
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 200) + 'px';

        // Gönder butonunu aktif/pasif yap
        sendBtn.classList.toggle('active', input.value.trim().length > 0);

        // Yazılıyor durumu bildir
        document.dispatchEvent(new CustomEvent('typing', {
            detail: { isTyping: input.value.trim().length > 0 }
        }));
    });

    // Üye paneli toggle
    document.getElementById('toggleMembersBtn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('toggleMembers'));
    });

    // Mesaj aksiyonları (event delegation)
    document.getElementById('messagesArea')?.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('.message-action-btn');
        if (actionBtn) {
            const messageGroup = actionBtn.closest('.message-group');
            const messageId = messageGroup?.dataset.messageId;
            const action = actionBtn.dataset.action;

            if (action === 'delete' && messageId) {
                if (confirm('Bu mesajı silmek istediğine emin misin?')) {
                    document.dispatchEvent(new CustomEvent('deleteMessage', { detail: { messageId } }));
                }
            } else if (action === 'edit' && messageId) {
                startInlineEdit(messageId);
            } else if (action === 'react' && messageId) {
                showEmojiPicker(messageId, actionBtn);
            }
            return;
        }

        // Tepki butonlarına tıklama
        const reactionBtn = e.target.closest('.reaction-btn');
        if (reactionBtn) {
            const msgId = reactionBtn.dataset.msgId;
            const emoji = reactionBtn.dataset.emoji;
            if (msgId && emoji) {
                document.dispatchEvent(new CustomEvent('addReaction', {
                    detail: { messageId: msgId, emoji }
                }));
            }
            return;
        }

        // Kullanıcı profil kartı tıklama
        const clickableUser = e.target.closest('.clickable-user');
        if (clickableUser) {
            const uid = clickableUser.dataset.uid;
            const uname = clickableUser.dataset.uname;
            if (uid) {
                document.dispatchEvent(new CustomEvent('showProfileCard', {
                    detail: { uid, displayName: uname, anchorEl: clickableUser }
                }));
            }
        }
    });
}
