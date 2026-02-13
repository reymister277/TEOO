// ========================================
// Kimlik Doğrulama Servisi
// ========================================
// Firebase Auth ile gerçek hesap yönetimi

import { auth, db } from '../config/firebase.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from 'firebase/auth';
import {
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    collection,
    serverTimestamp
} from 'firebase/firestore';
import { setState } from '../utils/state.js';

/**
 * Hesap oluştur (Kayıt Ol)
 */
export async function register(email, password, displayName, avatar = '😀') {
    if (!auth) return { success: false, error: 'Firebase yapılandırılmamış.' };

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Profil adını güncelle
        await updateProfile(user, { displayName });

        // Benzersiz 4 haneli arkadaş kodu üret
        const friendCode = await generateUniqueFriendCode();

        // Firestore'a kullanıcı bilgisi yaz
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            displayName,
            email,
            avatar,
            friendCode,
            status: 'online',
            bio: '',
            friends: [],
            createdAt: serverTimestamp(),
            lastSeen: serverTimestamp()
        });

        // Friend code → uid eşleştirmesi (hızlı arama için)
        await setDoc(doc(db, 'friendCodes', friendCode), {
            uid: user.uid,
            displayName
        });

        return { success: true, user };
    } catch (error) {
        console.error('Kayıt hatası:', error);
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * Giriş yap
 */
export async function login(email, password) {
    if (!auth) return { success: false, error: 'Firebase yapılandırılmamış.' };

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // Durumu online yap
        try {
            await updateDoc(doc(db, 'users', userCredential.user.uid), {
                status: 'online',
                lastSeen: serverTimestamp()
            });
        } catch (e) {
            // İlk kez giriş yapan kullanıcı Firestore'da olmayabilir
            const friendCode = await generateUniqueFriendCode();
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                uid: userCredential.user.uid,
                displayName: userCredential.user.displayName || 'Kullanıcı',
                email: userCredential.user.email,
                avatar: '😀',
                friendCode,
                status: 'online',
                bio: '',
                friends: [],
                createdAt: serverTimestamp(),
                lastSeen: serverTimestamp()
            });
            await setDoc(doc(db, 'friendCodes', friendCode), {
                uid: userCredential.user.uid,
                displayName: userCredential.user.displayName || 'Kullanıcı'
            });
        }

        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Giriş hatası:', error);
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * Çıkış yap
 */
export async function logout() {
    if (!auth) return { success: false, error: 'Firebase yapılandırılmamış.' };

    try {
        const user = auth.currentUser;
        if (user && db) {
            try {
                await updateDoc(doc(db, 'users', user.uid), {
                    status: 'offline',
                    lastSeen: serverTimestamp()
                });
            } catch (e) {
                // Sessiz hata
            }
        }
        await signOut(auth);
        setState('user', null);
        return { success: true };
    } catch (error) {
        console.error('Çıkış hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Kullanıcı profilini getir
 */
export async function getUserProfile(uid) {
    if (!db) return null;

    try {
        const docSnap = await getDoc(doc(db, 'users', uid));
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error('Profil getirme hatası:', error);
        return null;
    }
}

/**
 * Oturum durumunu dinle
 */
export function watchAuthState(callback) {
    if (!auth) {
        callback(null);
        return () => { };
    }

    return onAuthStateChanged(auth, async (user) => {
        if (user) {
            const profile = await getUserProfile(user.uid);
            const userData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || profile?.displayName || 'Kullanıcı',
                avatar: profile?.avatar || '😀',
                friendCode: profile?.friendCode || '',
                status: profile?.status || 'online',
                bio: profile?.bio || '',
                friends: profile?.friends || []
            };
            setState('user', userData);
            callback(userData);
        } else {
            setState('user', null);
            callback(null);
        }
    });
}

/**
 * Profili güncelle
 */
export async function updateUserProfile(uid, data) {
    if (!db) return { success: false, error: 'Firebase yapılandırılmamış.' };

    try {
        await updateDoc(doc(db, 'users', uid), {
            ...data,
            lastSeen: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Profil güncelleme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Firebase auth hata mesajlarını Türkçe'ye çevir
 */
function getAuthErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanımda.',
        'auth/weak-password': 'Şifre en az 6 karakter olmalıdır.',
        'auth/invalid-email': 'Geçersiz e-posta adresi.',
        'auth/user-not-found': 'Bu e-posta ile kayıtlı hesap bulunamadı.',
        'auth/wrong-password': 'Yanlış şifre girdiniz.',
        'auth/too-many-requests': 'Çok fazla deneme yaptınız. Lütfen biraz bekleyin.',
        'auth/user-disabled': 'Bu hesap devre dışı bırakılmış.',
        'auth/invalid-credential': 'E-posta veya şifre hatalı.',
        'auth/network-request-failed': 'İnternet bağlantınızı kontrol edin.',
        'auth/operation-not-allowed': 'E-posta/şifre girişi etkin değil. Firebase Console\'dan aktifleştirin.'
    };
    return messages[code] || `Bir hata oluştu (${code}). Lütfen tekrar deneyin.`;
}

/**
 * 4 haneli benzersiz arkadaş kodu üret
 * Örnek: A7K9, X3M2, B5P1
 */
async function generateUniqueFriendCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Karıştırılabilecek karakterler çıkartıldı (0/O, 1/I)
    let code = '';
    let attempts = 0;

    while (attempts < 50) {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Bu kod zaten var mı kontrol et
        if (db) {
            const codeDoc = await getDoc(doc(db, 'friendCodes', code));
            if (!codeDoc.exists()) {
                return code; // Benzersiz kod bulundu!
            }
        } else {
            return code; // DB yoksa kontrol etmeden dön
        }
        attempts++;
    }

    // 50 denemede benzersiz bulunamazsa 6 haneli üret
    for (let i = 0; i < 2; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
