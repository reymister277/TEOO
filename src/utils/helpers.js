// ========================================
// Yardımcı Fonksiyonlar
// ========================================

/**
 * Tarihi okunabilir formata çevir
 */
export function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Tam tarih formatı
 */
export function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Bugün';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Dün';
    } else {
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
}

/**
 * Rastgele ID oluştur
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * İsmin baş harfini al (avatar için)
 */
export function getInitials(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
}

/**
 * HTML kaçış (XSS koruması)
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Metin kısaltma
 */
export function truncate(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

/**
 * Debounce (performans için)
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Avatar renkleri (kullanıcı adına göre)
 */
const AVATAR_COLORS = [
    'linear-gradient(135deg, #7c5cfc, #5e8bff)',
    'linear-gradient(135deg, #f04747, #ff6b6b)',
    'linear-gradient(135deg, #43b581, #00d4aa)',
    'linear-gradient(135deg, #faa61a, #ffcc4d)',
    'linear-gradient(135deg, #e91e8c, #ff6bae)',
    'linear-gradient(135deg, #5e8bff, #00d4ff)',
    'linear-gradient(135deg, #9b59b6, #c084fc)',
    'linear-gradient(135deg, #00b4d8, #48cae4)',
];

export function getAvatarColor(name) {
    if (!name) return AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Emoji avatarları
 */
export const AVATAR_EMOJIS = ['😀', '😎', '🤖', '👾', '🎮', '🚀', '⚡', '🔥', '💎', '🦊', '🐱', '🦁', '🐺', '🦄', '🐉', '🌟'];
