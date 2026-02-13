// ========================================
// Sohbet Alanı Bileşeni
// ========================================

import { getState, onStateChange } from '../../utils/state.js';
import { formatTime, formatDate, escapeHtml, getInitials, getAvatarColor } from '../../utils/helpers.js';

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
                    <div class="message-avatar" style="background: ${avatarColor}">
                        ${msg.avatar || getInitials(msg.author)}
                    </div>
                ` : ''}
                <div class="message-body">
                    ${!isCompact ? `
                        <div class="message-header">
                            <span class="message-author">${escapeHtml(msg.author)}</span>
                            <span class="message-timestamp">${time}</span>
                        </div>
                    ` : ''}
                    <div class="message-text">${escapeHtml(msg.text)}${msg.edited ? '<span class="message-edited-tag">(düzenlenmiş)</span>' : ''}</div>
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
        if (!actionBtn) return;

        const messageGroup = actionBtn.closest('.message-group');
        const messageId = messageGroup?.dataset.messageId;
        const action = actionBtn.dataset.action;

        if (action === 'delete' && messageId) {
            if (confirm('Bu mesajı silmek istediğine emin misin?')) {
                document.dispatchEvent(new CustomEvent('deleteMessage', { detail: { messageId } }));
            }
        } else if (action === 'edit' && messageId) {
            document.dispatchEvent(new CustomEvent('editMessage', { detail: { messageId } }));
        }
    });
}
