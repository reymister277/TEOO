// ========================================
// Firebase Yapılandırması
// ========================================
// .env dosyasından veya doğrudan config'den okur.
// Firebase henüz kurulmadıysa, kullanıcıya kurulum rehberi gösterir.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

// Firebase config - .env dosyasından veya doğrudan buradan okur
// Vite, import.meta.env ile .env dosyalarını destekler
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "BURAYA-API-KEY-GIRINIZ",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "proje-adi.firebaseapp.com",
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "proje-adi",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "proje-adi.appspot.com",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:0000000000000000"
};

/**
 * Firebase'in doğru yapılandırılıp yapılandırılmadığını kontrol et
 */
export function isFirebaseConfigured() {
    return (
        firebaseConfig.apiKey &&
        firebaseConfig.apiKey !== "BURAYA-API-KEY-GIRINIZ" &&
        !firebaseConfig.apiKey.includes('XXXX') &&
        firebaseConfig.projectId &&
        firebaseConfig.projectId !== "proje-adi"
    );
}

// Firebase başlat (config doğruysa)
let app = null;
let auth = null;
let db = null;
let storage = null;
let rtdb = null;

if (isFirebaseConfigured()) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        rtdb = getDatabase(app);
        console.log('✅ Firebase başarıyla bağlandı');
    } catch (error) {
        console.error('❌ Firebase başlatma hatası:', error);
    }
} else {
    console.warn('⚠️ Firebase henüz yapılandırılmamış. Kurulum rehberini takip edin.');
}

export { app, auth, db, storage, rtdb };
export default app;
