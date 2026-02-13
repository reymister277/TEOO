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
    serverTimestamp,
    arrayUnion
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
 * Mesaj gönder (opsiyonel dosya eki)
 */
export async function sendMessage(serverId, channelId, user, text, attachment = null) {
    if (!text.trim() && !attachment) return;

    try {
        const msgData = {
            text: text.trim(),
            author: user.displayName,
            authorId: user.uid,
            avatar: user.avatar,
            timestamp: serverTimestamp(),
            edited: false
        };

        // Dosya eki varsa ekle
        if (attachment) {
            msgData.attachment = {
                url: attachment.url,
                name: attachment.name,
                size: attachment.size,
                type: attachment.type,
                fileType: attachment.fileType // 'image', 'video', 'audio', 'file'
            };
        }

        await addDoc(
            collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
            msgData
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

/**
 * Mesaja tepki ekle
 */
export async function addReaction(serverId, channelId, messageId, emoji, userId, userName) {
    try {
        const msgRef = doc(db, 'servers', serverId, 'channels', channelId, 'messages', messageId);
        const msgSnap = await getDoc(msgRef);
        if (!msgSnap.exists()) return;

        const reactions = msgSnap.data().reactions || {};
        const emojiReactions = reactions[emoji] || [];

        // Zaten tepki verdiyse kaldır
        const existing = emojiReactions.find(r => r.uid === userId);
        if (existing) {
            reactions[emoji] = emojiReactions.filter(r => r.uid !== userId);
            if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
            reactions[emoji] = [...emojiReactions, { uid: userId, name: userName }];
        }

        await updateDoc(msgRef, { reactions });
        return { success: true };
    } catch (error) {
        console.error('Tepki hatası:', error);
        return { success: false, error: error.message };
    }
}


// ============ Üye İşlemleri ============

/**
 * Sunucu üyelerini dinle (sunucu bazlı filtreleme)
 */
export function watchMembers(serverId, callback) {
    // Önce sunucu üyelerini al, sonra kullanıcı bilgilerini dinle
    return onSnapshot(doc(db, 'servers', serverId), async (serverSnap) => {
        if (!serverSnap.exists()) { callback([]); return; }

        const memberIds = serverSnap.data().members || [];
        if (memberIds.length === 0) { callback([]); return; }

        // Tüm kullanıcıları dinle ama sadece sunucu üyelerini filtrele
        const unsubUsers = onSnapshot(collection(db, 'users'), (usersSnap) => {
            const members = [];
            usersSnap.forEach((userDoc) => {
                if (memberIds.includes(userDoc.id)) {
                    members.push({ id: userDoc.id, ...userDoc.data() });
                }
            });
            // Online olanlar üstte
            members.sort((a, b) => {
                if (a.status === 'online' && b.status !== 'online') return -1;
                if (a.status !== 'online' && b.status === 'online') return 1;
                return 0;
            });
            callback(members);
        });

        // Cleanup fonksiyonu dönecek
        return unsubUsers;
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

// ============ Özel Sunucu İşlemleri ============

/**
 * 6 haneli benzersiz sunucu davet kodu üret
 */
async function generateServerInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    let attempts = 0;

    while (attempts < 50) {
        code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (db) {
            const codeDoc = await getDoc(doc(db, 'serverInvites', code));
            if (!codeDoc.exists()) return code;
        } else {
            return code;
        }
        attempts++;
    }
    return code;
}

/**
 * Yeni sunucu oluştur
 */
export async function createServer(name, icon, userId, userName) {
    if (!db) return { success: false, error: 'Veritabanı bağlantısı yok.' };

    try {
        // Davet kodu üret
        const inviteCode = await generateServerInviteCode();

        // Sunucuyu oluştur
        const serverRef = await addDoc(collection(db, 'servers'), {
            name,
            icon: icon || '🎮',
            ownerId: userId,
            ownerName: userName,
            inviteCode,
            memberCount: 1,
            members: [userId],
            createdAt: serverTimestamp()
        });

        const serverId = serverRef.id;

        // Davet kodu eşleştirmesi
        await setDoc(doc(db, 'serverInvites', inviteCode), {
            serverId,
            serverName: name,
            createdBy: userId
        });

        // Varsayılan kanallar oluştur
        const defaultChannels = [
            { name: 'genel', type: 'text', description: 'Genel sohbet kanalı', order: 0 },
            { name: 'duyurular', type: 'text', description: 'Önemli duyurular', order: 1 },
            { name: 'Genel Ses', type: 'voice', description: 'Sesli sohbet', order: 2 }
        ];

        for (const channel of defaultChannels) {
            await addDoc(collection(db, 'servers', serverId, 'channels'), {
                ...channel,
                serverId,
                createdAt: serverTimestamp()
            });
        }

        // Kullanıcının sunucu listesine ekle
        await updateDoc(doc(db, 'users', userId), {
            servers: arrayUnion(serverId)
        });

        return { success: true, serverId, inviteCode };
    } catch (error) {
        console.error('Sunucu oluşturma hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Sunucuya davet kodu ile katıl
 */
export async function joinServerByCode(inviteCode, userId, userName) {
    if (!db) return { success: false, error: 'Veritabanı bağlantısı yok.' };

    try {
        // Davet kodunu kontrol et
        const inviteDoc = await getDoc(doc(db, 'serverInvites', inviteCode.toUpperCase()));
        if (!inviteDoc.exists()) {
            return { success: false, error: 'Geçersiz davet kodu!' };
        }

        const { serverId, serverName } = inviteDoc.data();

        // Sunucu var mı kontrol et
        const serverDoc = await getDoc(doc(db, 'servers', serverId));
        if (!serverDoc.exists()) {
            return { success: false, error: 'Bu sunucu artık mevcut değil.' };
        }

        // Zaten üye mi?
        const serverData = serverDoc.data();
        if (serverData.members?.includes(userId)) {
            return { success: false, error: 'Bu sunucuya zaten katılmışsın!' };
        }

        // Sunucuya üye olarak ekle
        await updateDoc(doc(db, 'servers', serverId), {
            members: arrayUnion(userId),
            memberCount: (serverData.memberCount || 1) + 1
        });

        // Kullanıcının sunucu listesine ekle
        await updateDoc(doc(db, 'users', userId), {
            servers: arrayUnion(serverId)
        });

        return { success: true, serverId, serverName };
    } catch (error) {
        console.error('Sunucuya katılma hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Kullanıcının sunucu bilgilerini getir
 */
export async function getUserServers(userId) {
    if (!db) return [];

    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return [];

        const serverIds = userDoc.data().servers || [];
        const servers = [];

        // teoo-main her zaman ilk olmalı
        const mainDoc = await getDoc(doc(db, 'servers', 'teoo-main'));
        if (mainDoc.exists()) {
            servers.push({ id: 'teoo-main', ...mainDoc.data() });
        }

        for (const id of serverIds) {
            if (id === 'teoo-main') continue;
            try {
                const serverDoc = await getDoc(doc(db, 'servers', id));
                if (serverDoc.exists()) {
                    servers.push({ id, ...serverDoc.data() });
                }
            } catch (e) {
                // Sessiz hata
            }
        }

        return servers;
    } catch (error) {
        console.error('Sunucu listesi hatası:', error);
        return [];
    }
}

/**
 * Sunucu bilgisini getir
 */
export async function getServerInfo(serverId) {
    if (!db) return null;
    try {
        const serverDoc = await getDoc(doc(db, 'servers', serverId));
        if (serverDoc.exists()) {
            return { id: serverId, ...serverDoc.data() };
        }
        return null;
    } catch (error) {
        return null;
    }
}
