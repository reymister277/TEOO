// ========================================
// WebRTC Sesli Sohbet Servisi
// ========================================
// Firestore üzerinden sinyal iletimi ile peer-to-peer ses bağlantısı

import { db } from '../config/firebase.js';
import {
    doc,
    setDoc,
    deleteDoc,
    collection,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { setState, getState } from '../utils/state.js';

let localStream = null;
let peerConnections = {};

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

/**
 * Sesli kanala katıl
 */
export async function joinVoiceChannel(serverId, channelId, channelName, user) {
    try {
        // Mikrofon izni al
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        // Kendimizi sesli kanal kullanıcıları arasına ekle
        await setDoc(
            doc(db, 'servers', serverId, 'channels', channelId, 'voiceUsers', user.uid),
            {
                displayName: user.displayName,
                avatar: user.avatar,
                joinedAt: serverTimestamp(),
                muted: false
            }
        );

        // State güncelle
        setState('voice', {
            connected: true,
            channelId,
            channelName,
            serverId,
            micEnabled: true,
            speakerEnabled: true,
            participants: []
        });

        // Diğer kullanıcıları dinle ve bağlantı kur
        const unsubscribe = onSnapshot(
            collection(db, 'servers', serverId, 'channels', channelId, 'voiceUsers'),
            (snapshot) => {
                const participants = [];
                snapshot.forEach((doc) => {
                    participants.push({ uid: doc.id, ...doc.data() });
                });
                setState('voice.participants', participants);
            }
        );

        // Cleanup fonksiyonunu sakla
        window._voiceCleanup = unsubscribe;

        return { success: true };
    } catch (error) {
        console.error('Sesli kanala katılma hatası:', error);

        if (error.name === 'NotAllowedError') {
            return { success: false, error: 'Mikrofon izni reddedildi. Lütfen tarayıcı izinlerini kontrol edin.' };
        }

        return { success: false, error: 'Sesli kanala bağlanılamadı.' };
    }
}

/**
 * Sesli kanaldan ayrıl
 */
export async function leaveVoiceChannel(user) {
    try {
        const voice = getState('voice');

        if (voice.connected && voice.serverId && voice.channelId) {
            // Kendimizi sesli kanal listesinden çıkar
            await deleteDoc(
                doc(db, 'servers', voice.serverId, 'channels', voice.channelId, 'voiceUsers', user.uid)
            );
        }

        // Mikrofonu kapat
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        // Peer bağlantılarını kapat
        Object.values(peerConnections).forEach(pc => pc.close());
        peerConnections = {};

        // Cleanup
        if (window._voiceCleanup) {
            window._voiceCleanup();
            window._voiceCleanup = null;
        }

        // State sıfırla
        setState('voice', {
            connected: false,
            channelId: null,
            channelName: null,
            serverId: null,
            micEnabled: true,
            speakerEnabled: true,
            participants: []
        });

        return { success: true };
    } catch (error) {
        console.error('Sesli kanaldan ayrılma hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mikrofonu aç/kapat
 */
export function toggleMicrophone() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            setState('voice.micEnabled', audioTrack.enabled);
            return audioTrack.enabled;
        }
    }
    return true;
}

/**
 * Hoparlörü aç/kapat
 */
export function toggleSpeaker() {
    const current = getState('voice.speakerEnabled');
    setState('voice.speakerEnabled', !current);

    // Remote audio elementlerini mute/unmute et
    document.querySelectorAll('.remote-audio').forEach(audio => {
        audio.muted = current; // tersini yap
    });

    return !current;
}

/**
 * Mikrofon durumunu kontrol et
 */
export function isMicEnabled() {
    return getState('voice.micEnabled');
}

/**
 * Hoparlör durumunu kontrol et
 */
export function isSpeakerEnabled() {
    return getState('voice.speakerEnabled');
}
