// ========================================
// Global State Yönetimi
// ========================================
// Basit ama güçlü reactive state sistemi.
// Değişiklik olduğunda dinleyicileri otomatik tetikler.

const state = {
    // Kullanıcı bilgisi
    user: null,

    // Aktif sunucu
    currentServer: null,

    // Aktif kanal
    currentChannel: null,

    // Kanal türü ('text' veya 'voice')
    currentChannelType: 'text',

    // Mesaj listesi
    messages: [],

    // Sunucu listesi
    servers: [],

    // Kanallar
    channels: [],

    // Üyeler
    members: [],

    // Sesli kanal durumu
    voice: {
        connected: false,
        channelId: null,
        channelName: null,
        micEnabled: true,
        speakerEnabled: true,
        participants: []
    },

    // UI durumu
    ui: {
        showMembers: true,
        showSettings: false,
        settingsTab: 'profile',
        authPage: 'login', // 'login' veya 'register'
        loading: true
    }
};

// Dinleyiciler
const listeners = {};

/**
 * State değerini güncelle ve dinleyicileri tetikle
 * @param {string} key - State anahtarı (nokta notasyonu: 'voice.connected')
 * @param {*} value - Yeni değer
 */
export function setState(key, value) {
    const keys = key.split('.');
    let obj = state;

    for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
    }

    obj[keys[keys.length - 1]] = value;

    // Dinleyicileri tetikle
    notifyListeners(key, value);

    // Üst anahtarları da tetikle
    if (keys.length > 1) {
        notifyListeners(keys[0], state[keys[0]]);
    }
}

/**
 * State değerini oku
 * @param {string} key - State anahtarı
 * @returns {*} Değer
 */
export function getState(key) {
    const keys = key.split('.');
    let obj = state;

    for (const k of keys) {
        if (obj === undefined || obj === null) return undefined;
        obj = obj[k];
    }

    return obj;
}

/**
 * State değişikliğini dinle
 * @param {string} key - Dinlenecek anahtar
 * @param {Function} callback - Çağrılacak fonksiyon
 * @returns {Function} Dinlemeyi durdurma fonksiyonu
 */
export function onStateChange(key, callback) {
    if (!listeners[key]) {
        listeners[key] = [];
    }
    listeners[key].push(callback);

    // Dinlemeyi durdurma fonksiyonu
    return () => {
        listeners[key] = listeners[key].filter(cb => cb !== callback);
    };
}

/**
 * Dinleyicileri tetikle
 */
function notifyListeners(key, value) {
    if (listeners[key]) {
        listeners[key].forEach(cb => {
            try {
                cb(value);
            } catch (err) {
                console.error(`State listener error [${key}]:`, err);
            }
        });
    }
}

export default state;
