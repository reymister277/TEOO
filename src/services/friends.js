// ========================================
// Arkadaş Sistemi Servisi
// ========================================
// Arkadaş kodu ile ekleme, istek yönetimi ve DM

import { db } from '../config/firebase.js';
import {
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    addDoc,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';
import { setState, getState } from '../utils/state.js';

/**
 * Arkadaş kodu ile istek gönder
 */
export async function sendFriendRequest(myUid, friendCode) {
    if (!db) return { success: false, error: 'Veritabanı bağlantısı yok.' };

    try {
        // Friend code ile kullanıcıyı bul
        const codeDoc = await getDoc(doc(db, 'friendCodes', friendCode.toUpperCase()));
        if (!codeDoc.exists()) {
            return { success: false, error: 'Bu kodla kullanıcı bulunamadı!' };
        }

        const targetUid = codeDoc.data().uid;

        // Kendine ekleyemezsin
        if (targetUid === myUid) {
            return { success: false, error: 'Kendinize arkadaşlık isteği gönderemezsiniz!' };
        }

        // Zaten arkadaş mı kontrol et
        const myProfile = await getDoc(doc(db, 'users', myUid));
        if (myProfile.exists()) {
            const friends = myProfile.data().friends || [];
            if (friends.includes(targetUid)) {
                return { success: false, error: 'Bu kullanıcı zaten arkadaşınız!' };
            }
        }

        // Zaten bekleyen istek var mı kontrol et
        const pendingQuery = query(
            collection(db, 'friendRequests'),
            where('from', '==', myUid),
            where('to', '==', targetUid),
            where('status', '==', 'pending')
        );
        const pendingDocs = await getDocs(pendingQuery);
        if (!pendingDocs.empty) {
            return { success: false, error: 'Zaten bir arkadaşlık isteği gönderilmiş!' };
        }

        // Karşı taraftan bize gelen istek var mı? Varsa otomatik kabul et
        const reverseQuery = query(
            collection(db, 'friendRequests'),
            where('from', '==', targetUid),
            where('to', '==', myUid),
            where('status', '==', 'pending')
        );
        const reverseDocs = await getDocs(reverseQuery);
        if (!reverseDocs.empty) {
            // Otomatik kabul et
            const requestDoc = reverseDocs.docs[0];
            return await acceptFriendRequest(requestDoc.id, myUid, targetUid);
        }

        // Hedef kullanıcı bilgisi al
        const targetProfile = await getDoc(doc(db, 'users', targetUid));
        const myProfileData = myProfile.exists() ? myProfile.data() : {};
        const targetProfileData = targetProfile.exists() ? targetProfile.data() : {};

        // İstek gönder
        await addDoc(collection(db, 'friendRequests'), {
            from: myUid,
            fromName: myProfileData.displayName || 'Kullanıcı',
            fromAvatar: myProfileData.avatar || '😀',
            to: targetUid,
            toName: targetProfileData.displayName || 'Kullanıcı',
            toAvatar: targetProfileData.avatar || '😀',
            status: 'pending',
            createdAt: serverTimestamp()
        });

        return { success: true, targetName: targetProfileData.displayName };
    } catch (error) {
        console.error('Arkadaşlık isteği gönderme hatası:', error);
        return { success: false, error: 'İstek gönderilemedi: ' + error.message };
    }
}

/**
 * Arkadaşlık isteğini kabul et
 */
export async function acceptFriendRequest(requestId, myUid, fromUid) {
    if (!db) return { success: false, error: 'Veritabanı bağlantısı yok.' };

    try {
        // İstek durumunu güncelle
        await updateDoc(doc(db, 'friendRequests', requestId), {
            status: 'accepted'
        });

        // Her iki tarafa da arkadaş ekle
        await updateDoc(doc(db, 'users', myUid), {
            friends: arrayUnion(fromUid)
        });
        await updateDoc(doc(db, 'users', fromUid), {
            friends: arrayUnion(myUid)
        });

        // DM kanalı oluştur
        const chatId = getDMChatId(myUid, fromUid);
        const chatDoc = await getDoc(doc(db, 'directMessages', chatId));
        if (!chatDoc.exists()) {
            await setDoc(doc(db, 'directMessages', chatId), {
                participants: [myUid, fromUid],
                createdAt: serverTimestamp(),
                lastMessage: null,
                lastMessageTime: serverTimestamp()
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Arkadaşlık kabul hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Arkadaşlık isteğini reddet
 */
export async function rejectFriendRequest(requestId) {
    if (!db) return { success: false, error: 'Veritabanı bağlantısı yok.' };

    try {
        await updateDoc(doc(db, 'friendRequests', requestId), {
            status: 'rejected'
        });
        return { success: true };
    } catch (error) {
        console.error('Arkadaşlık reddetme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Arkadaşı sil
 */
export async function removeFriend(myUid, friendUid) {
    if (!db) return { success: false, error: 'Veritabanı bağlantısı yok.' };

    try {
        await updateDoc(doc(db, 'users', myUid), {
            friends: arrayRemove(friendUid)
        });
        await updateDoc(doc(db, 'users', friendUid), {
            friends: arrayRemove(myUid)
        });
        return { success: true };
    } catch (error) {
        console.error('Arkadaş silme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Gelen arkadaşlık isteklerini dinle
 */
export function watchFriendRequests(myUid, callback) {
    if (!db) return () => { };

    const q = query(
        collection(db, 'friendRequests'),
        where('to', '==', myUid),
        where('status', '==', 'pending')
    );

    return onSnapshot(q, (snapshot) => {
        const requests = [];
        snapshot.forEach((doc) => {
            requests.push({ id: doc.id, ...doc.data() });
        });
        callback(requests);
    });
}

/**
 * Arkadaş listesini dinle (profil bilgileriyle)
 */
export function watchFriends(myUid, callback) {
    if (!db) return () => { };

    return onSnapshot(doc(db, 'users', myUid), async (docSnap) => {
        if (!docSnap.exists()) return;

        const friendUids = docSnap.data().friends || [];
        const friends = [];

        for (const uid of friendUids) {
            try {
                const friendDoc = await getDoc(doc(db, 'users', uid));
                if (friendDoc.exists()) {
                    friends.push({ uid, ...friendDoc.data() });
                }
            } catch (e) {
                // Sessiz hata
            }
        }

        callback(friends);
    });
}

/**
 * DM mesajı gönder
 */
export async function sendDirectMessage(chatId, user, text) {
    if (!db) return { success: false };

    try {
        await addDoc(collection(db, 'directMessages', chatId, 'messages'), {
            text,
            userId: user.uid,
            userName: user.displayName,
            userAvatar: user.avatar || '😀',
            timestamp: serverTimestamp()
        });

        // Son mesaj bilgisini güncelle
        await updateDoc(doc(db, 'directMessages', chatId), {
            lastMessage: text,
            lastMessageTime: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('DM gönderme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * DM mesajlarını dinle
 */
export function watchDirectMessages(chatId, callback) {
    if (!db) return () => { };

    const q = query(
        collection(db, 'directMessages', chatId, 'messages'),
        orderBy('timestamp', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            messages.push({
                id: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate?.() || new Date()
            });
        });
        callback(messages);
    });
}

/**
 * İki kullanıcının DM chatId'sini oluştur (sıralı birleşim)
 */
export function getDMChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
}
