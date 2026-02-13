// ========================================
// WebRTC Sesli Sohbet Servisi
// ========================================
// Firestore üzerinden sinyal iletimi ile peer-to-peer ses bağlantısı

import { db } from '../config/firebase.js';
import {
    doc,
    setDoc,
    deleteDoc,
    getDoc,
    collection,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { setState, getState } from '../utils/state.js';

let localStream = null;
let peerConnections = {};
let voiceUsersUnsubscribe = null;
let signalingUnsubscribes = {};

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

/**
 * Sesli kanala katıl
 */
export async function joinVoiceChannel(serverId, channelId, channelName, user) {
    try {
        // Mikrofon izni al
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });

        // Kendimizi sesli kanal kullanıcıları arasına ekle
        if (db) {
            await setDoc(
                doc(db, 'servers', serverId, 'channels', channelId, 'voiceUsers', user.uid),
                {
                    displayName: user.displayName,
                    avatar: user.avatar || '😀',
                    joinedAt: serverTimestamp(),
                    muted: false
                }
            );
        }

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
        if (db) {
            voiceUsersUnsubscribe = onSnapshot(
                collection(db, 'servers', serverId, 'channels', channelId, 'voiceUsers'),
                async (snapshot) => {
                    const participants = [];
                    snapshot.forEach((docSnap) => {
                        if (docSnap.id !== user.uid) {
                            participants.push({ uid: docSnap.id, ...docSnap.data() });
                        }
                    });

                    setState('voice.participants', participants);
                    setState('voiceParticipants', participants);

                    // Her yeni kullanıcı için peer bağlantısı kur
                    for (const participant of participants) {
                        if (!peerConnections[participant.uid]) {
                            await createPeerConnection(serverId, channelId, user.uid, participant.uid);
                        }
                    }

                    // Ayrılan kullanıcıların bağlantılarını temizle
                    const activeUids = participants.map(p => p.uid);
                    Object.keys(peerConnections).forEach(uid => {
                        if (!activeUids.includes(uid)) {
                            closePeerConnection(uid);
                        }
                    });
                }
            );

            // Sinyal mesajlarını dinle (diğer kullanıcılardan gelen offer/answer/ice)
            const signalingRef = collection(db, 'servers', serverId, 'channels', channelId, 'signaling', user.uid, 'messages');
            signalingUnsubscribes['main'] = onSnapshot(signalingRef, async (snapshot) => {
                snapshot.docChanges().forEach(async (change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        await handleSignalingMessage(serverId, channelId, user.uid, data);
                        // İşlenen mesajı sil
                        deleteDoc(change.doc.ref).catch(() => { });
                    }
                });
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Sesli kanala katılma hatası:', error);

        if (error.name === 'NotAllowedError') {
            return { success: false, error: 'Mikrofon izni reddedildi. Lütfen tarayıcı izinlerini kontrol edin.' };
        }
        if (error.name === 'NotFoundError') {
            return { success: false, error: 'Mikrofon bulunamadı.' };
        }

        return { success: false, error: 'Sesli kanala bağlanılamadı: ' + error.message };
    }
}

/**
 * Peer bağlantısı oluştur
 */
async function createPeerConnection(serverId, channelId, myUid, remoteUid) {
    try {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnections[remoteUid] = pc;

        // Kendi ses akışımızı ekle
        if (localStream) {
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
        }

        // Uzak ses geldiğinde çal
        pc.ontrack = (event) => {
            const audio = document.createElement('audio');
            audio.srcObject = event.streams[0];
            audio.autoplay = true;
            audio.className = 'remote-audio';
            audio.id = `audio-${remoteUid}`;

            // Mevcut aynı ID'li audio'yu kaldır
            const existing = document.getElementById(`audio-${remoteUid}`);
            if (existing) existing.remove();

            document.body.appendChild(audio);
        };

        // ICE adaylarını Firestore üzerinden karşı tarafa gönder
        pc.onicecandidate = (event) => {
            if (event.candidate && db) {
                const candidateId = Date.now().toString();
                setDoc(
                    doc(db, 'servers', serverId, 'channels', channelId, 'signaling', remoteUid, 'messages', candidateId),
                    {
                        type: 'ice-candidate',
                        candidate: event.candidate.toJSON(),
                        from: myUid,
                        timestamp: Date.now()
                    }
                ).catch(() => { });
            }
        };

        // Bağlantı durumu değişikliğini izle
        pc.onconnectionstatechange = () => {
            console.log(`Peer ${remoteUid} bağlantı durumu: ${pc.connectionState}`);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                closePeerConnection(remoteUid);
            }
        };

        // Offer oluştur ve gönder (ID karşılaştırması ile sadece bir taraf offer gönderir)
        if (myUid < remoteUid) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            if (db) {
                await setDoc(
                    doc(db, 'servers', serverId, 'channels', channelId, 'signaling', remoteUid, 'messages', `offer-${myUid}`),
                    {
                        type: 'offer',
                        sdp: offer.sdp,
                        from: myUid,
                        timestamp: Date.now()
                    }
                );
            }
        }
    } catch (error) {
        console.error('Peer bağlantısı oluşturma hatası:', error);
    }
}

/**
 * Sinyal mesajını işle
 */
async function handleSignalingMessage(serverId, channelId, myUid, data) {
    try {
        const { type, from } = data;

        if (type === 'offer') {
            // Karşı taraftan offer geldi, answer oluştur
            if (!peerConnections[from]) {
                await createPeerConnection(serverId, channelId, myUid, from);
            }
            const pc = peerConnections[from];
            if (!pc) return;

            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (db) {
                await setDoc(
                    doc(db, 'servers', serverId, 'channels', channelId, 'signaling', from, 'messages', `answer-${myUid}`),
                    {
                        type: 'answer',
                        sdp: answer.sdp,
                        from: myUid,
                        timestamp: Date.now()
                    }
                );
            }
        } else if (type === 'answer') {
            // Answer geldi, remote description ayarla
            const pc = peerConnections[from];
            if (pc && pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
            }
        } else if (type === 'ice-candidate') {
            // ICE adayı geldi
            const pc = peerConnections[from];
            if (pc && data.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        }
    } catch (error) {
        console.error('Sinyal mesajı işleme hatası:', error);
    }
}

/**
 * Bir peer bağlantısını kapat
 */
function closePeerConnection(uid) {
    if (peerConnections[uid]) {
        peerConnections[uid].close();
        delete peerConnections[uid];
    }
    // İlgili audio elementini kaldır
    const audio = document.getElementById(`audio-${uid}`);
    if (audio) audio.remove();
}

/**
 * Sesli kanaldan ayrıl
 */
export async function leaveVoiceChannel(user) {
    try {
        const voice = getState('voice');

        if (voice.connected && voice.serverId && voice.channelId && db) {
            // Kendimizi sesli kanal listesinden çıkar
            await deleteDoc(
                doc(db, 'servers', voice.serverId, 'channels', voice.channelId, 'voiceUsers', user.uid)
            ).catch(() => { });
        }

        // Mikrofonu kapat
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        // Tüm peer bağlantılarını kapat
        Object.keys(peerConnections).forEach(uid => closePeerConnection(uid));
        peerConnections = {};

        // Cleanup listener'lar
        if (voiceUsersUnsubscribe) {
            voiceUsersUnsubscribe();
            voiceUsersUnsubscribe = null;
        }
        Object.values(signalingUnsubscribes).forEach(unsub => unsub());
        signalingUnsubscribes = {};

        // Remote audio elementlerini temizle
        document.querySelectorAll('.remote-audio').forEach(el => el.remove());

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
        setState('voiceParticipants', []);

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
