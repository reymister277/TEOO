// ========================================
// Veritabanı Servisi
// ========================================
// Firestore ile mesajlar, kanallar, sunucular CRUD

import { db } from '../config/firebase.js';
import {
    collection,
    doc,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';

// ============ Sunucu (Server) İşlemleri ============

/**
 * Varsayılan sunucu oluştur (ilk kez)
 */
export async function createDefaultServer(userId) {
    if (!db) return 'teoo-main';

    try {
        const serverRef = doc(db, 'servers', 'teoo-main');
        const serverSnap = await getDoc(serverRef);

        if (!serverSnap.exists()) {
            await setDoc(serverRef, {
                name: 'TEOO',
                icon: '🚀',
                ownerId: userId,
                createdAt: serverTimestamp(),
                members: [userId]
            });

            // Varsayılan kanallar
            const channels = [
                { name: 'genel', type: 'text', description: 'Genel sohbet kanalı', order: 0 },
                { name: 'yardım', type: 'text', description: 'Yardım ve destek', order: 1 },
                { name: 'duyurular', type: 'text', description: 'Önemli duyurular', order: 2 },
                { name: 'Genel Ses', type: 'voice', description: 'Ana sesli kanal', order: 3 },
                { name: 'Müzik', type: 'voice', description: 'Müzik odası', order: 4 },
                { name: 'Oyun', type: 'voice', description: 'Oyun sohbeti', order: 5 }
            ];

            for (const channel of channels) {
                await addDoc(collection(db, 'servers', 'teoo-main', 'channels'), {
                    ...channel,
                    serverId: 'teoo-main',
                    createdAt: serverTimestamp()
                });
            }
        }
    } catch (error) {
        console.error('Sunucu oluşturma hatası:', error);
    }

    return 'teoo-main';
}

/**
 * Sunucu kanallarını dinle
 */
export function watchChannels(serverId, callback) {
    const q = query(
        collection(db, 'servers', serverId, 'channels'),
        orderBy('order', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
        const channels = [];
        snapshot.forEach((doc) => {
            channels.push({ id: doc.id, ...doc.data() });
        });
        callback(channels);
    });
}

// ============ Mesaj İşlemleri ============

/**
 * Mesaj gönder
 */
export async function sendMessage(serverId, channelId, user, text) {
    if (!text.trim()) return;

    try {
        await addDoc(
            collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
            {
                text: text.trim(),
                author: user.displayName,
                authorId: user.uid,
                avatar: user.avatar,
                timestamp: serverTimestamp(),
                edited: false
            }
        );
        return { success: true };
    } catch (error) {
        console.error('Mesaj gönderme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mesajları dinle (gerçek zamanlı)
 */
export function watchMessages(serverId, channelId, callback) {
    const q = query(
        collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
        orderBy('timestamp', 'asc'),
        limit(100)
    );

    return onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...doc.data() });
        });
        callback(messages);
    });
}

/**
 * Mesaj düzenle
 */
export async function editMessage(serverId, channelId, messageId, newText) {
    try {
        await updateDoc(
            doc(db, 'servers', serverId, 'channels', channelId, 'messages', messageId),
            {
                text: newText,
                edited: true,
                editedAt: serverTimestamp()
            }
        );
        return { success: true };
    } catch (error) {
        console.error('Mesaj düzenleme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mesaj sil
 */
export async function deleteMessage(serverId, channelId, messageId) {
    try {
        await deleteDoc(
            doc(db, 'servers', serverId, 'channels', channelId, 'messages', messageId)
        );
        return { success: true };
    } catch (error) {
        console.error('Mesaj silme hatası:', error);
        return { success: false, error: error.message };
    }
}

// ============ Üye İşlemleri ============

/**
 * Çevrimiçi üyeleri dinle
 */
export function watchMembers(callback) {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
        const members = [];
        snapshot.forEach((doc) => {
            members.push({ id: doc.id, ...doc.data() });
        });
        // Online olanlar üstte
        members.sort((a, b) => {
            if (a.status === 'online' && b.status !== 'online') return -1;
            if (a.status !== 'online' && b.status === 'online') return 1;
            return 0;
        });
        callback(members);
    });
}

// ============ Kanal İşlemleri ============

/**
 * Yeni kanal oluştur
 */
export async function createChannel(serverId, name, type = 'text', description = '') {
    try {
        // Mevcut kanal sayısını al (sıralama için)
        const channelsSnap = await getDocs(
            collection(db, 'servers', serverId, 'channels')
        );

        const docRef = await addDoc(
            collection(db, 'servers', serverId, 'channels'),
            {
                name: name.toLowerCase().replace(/\s+/g, '-'),
                type,
                description,
                serverId,
                order: channelsSnap.size,
                createdAt: serverTimestamp()
            }
        );
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Kanal oluşturma hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Kanal sil
 */
export async function deleteChannel(serverId, channelId) {
    try {
        await deleteDoc(doc(db, 'servers', serverId, 'channels', channelId));
        return { success: true };
    } catch (error) {
        console.error('Kanal silme hatası:', error);
        return { success: false, error: error.message };
    }
}

// ============ Yazılıyor Göstergesi ============

/**
 * "Yazılıyor..." durumunu güncelle
 */
export async function setTypingStatus(serverId, channelId, userId, displayName, isTyping) {
    try {
        if (isTyping) {
            await setDoc(
                doc(db, 'servers', serverId, 'channels', channelId, 'typing', userId),
                { displayName, timestamp: serverTimestamp() }
            );
        } else {
            await deleteDoc(
                doc(db, 'servers', serverId, 'channels', channelId, 'typing', userId)
            );
        }
    } catch (error) {
        // Sessiz hata - typing critical değil
    }
}

/**
 * "Yazılıyor..." durumunu dinle
 */
export function watchTyping(serverId, channelId, currentUserId, callback) {
    return onSnapshot(
        collection(db, 'servers', serverId, 'channels', channelId, 'typing'),
        (snapshot) => {
            const typing = [];
            snapshot.forEach((doc) => {
                if (doc.id !== currentUserId) {
                    typing.push(doc.data().displayName);
                }
            });
            callback(typing);
        }
    );
}
