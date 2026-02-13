// ========================================
// Firebase Storage Dosya Yükleme Servisi
// ========================================

import { storage } from '../config/firebase.js';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Dosya yükle ve URL döndür
 * @param {File} file - Yüklenecek dosya
 * @param {string} path - Storage path (örn: 'chat/serverId/channelId/dosya.png')
 * @param {function} onProgress - İlerleme callback (0-100)
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export function uploadFile(file, path, onProgress) {
    return new Promise((resolve, reject) => {
        if (!storage) {
            resolve({ success: false, error: 'Storage yapılandırılmamış!' });
            return;
        }

        // Dosya boyutu kontrolü (25MB max)
        const MAX_SIZE = 25 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            resolve({ success: false, error: 'Dosya boyutu 25MB\'ı aşamaz!' });
            return;
        }

        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                if (onProgress) onProgress(progress);
            },
            (error) => {
                console.error('Dosya yükleme hatası:', error);
                resolve({ success: false, error: 'Dosya yüklenemedi: ' + error.message });
            },
            async () => {
                try {
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve({ success: true, url, name: file.name, size: file.size, type: file.type });
                } catch (error) {
                    resolve({ success: false, error: 'URL alınamadı: ' + error.message });
                }
            }
        );
    });
}

/**
 * Profil resmi yükle
 */
export async function uploadProfileImage(file, userId) {
    const ext = file.name.split('.').pop();
    const path = `profiles/${userId}/avatar.${ext}`;
    return uploadFile(file, path, null);
}

/**
 * Chat'e dosya/fotoğraf yükle
 */
export async function uploadChatFile(file, serverId, channelId, onProgress) {
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `chat/${serverId}/${channelId}/${timestamp}_${safeName}`;
    return uploadFile(file, path, onProgress);
}

/**
 * Dosyayı sil
 */
export async function deleteFile(url) {
    if (!storage) return;
    try {
        const fileRef = ref(storage, url);
        await deleteObject(fileRef);
    } catch (e) {
        console.warn('Dosya silme hatası:', e);
    }
}

/**
 * Dosya tipini kontrol et
 */
export function getFileType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const videoExts = ['mp4', 'webm', 'mov', 'avi'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac'];

    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    return 'file';
}

/**
 * Dosya boyutunu okunabilir formata çevir
 */
export function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
