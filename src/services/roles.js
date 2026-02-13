// ========================================
// Rol Yönetimi Servisi
// ========================================
// Sunucu rolleri: oluşturma, atama, yetki yönetimi

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
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';

// Varsayılan yetki tipleri
export const PERMISSIONS = {
    MANAGE_CHANNELS: 'manage_channels',   // Kanal oluştur/sil
    MANAGE_ROLES: 'manage_roles',         // Rol oluştur/düzenle
    MANAGE_MESSAGES: 'manage_messages',   // Mesaj sil (başkalarının)
    KICK_MEMBERS: 'kick_members',         // Üye at
    MANAGE_SERVER: 'manage_server',       // Sunucu ayarları
    SEND_MESSAGES: 'send_messages',       // Mesaj gönder
    CONNECT_VOICE: 'connect_voice'        // Sesli kanala katıl
};

// Varsayılan roller
const DEFAULT_ROLES = [
    {
        name: 'Sahip',
        color: '#ff6b35',
        position: 0,
        isDefault: true,
        permissions: Object.values(PERMISSIONS)
    },
    {
        name: 'Moderatör',
        color: '#43b581',
        position: 1,
        isDefault: true,
        permissions: [
            PERMISSIONS.MANAGE_CHANNELS,
            PERMISSIONS.MANAGE_MESSAGES,
            PERMISSIONS.KICK_MEMBERS,
            PERMISSIONS.SEND_MESSAGES,
            PERMISSIONS.CONNECT_VOICE
        ]
    },
    {
        name: 'Üye',
        color: '#99aab5',
        position: 2,
        isDefault: true,
        permissions: [
            PERMISSIONS.SEND_MESSAGES,
            PERMISSIONS.CONNECT_VOICE
        ]
    }
];

/**
 * Sunucu için varsayılan rolleri oluştur
 */
export async function createDefaultRoles(serverId, ownerId) {
    if (!db) return;

    try {
        for (const role of DEFAULT_ROLES) {
            const roleRef = await addDoc(collection(db, 'servers', serverId, 'roles'), {
                ...role,
                serverId,
                createdAt: serverTimestamp()
            });

            // Sahip rolünü otomatik ata
            if (role.name === 'Sahip') {
                await updateDoc(doc(db, 'servers', serverId), {
                    [`memberRoles.${ownerId}`]: arrayUnion(roleRef.id)
                });
            }
        }
    } catch (error) {
        console.error('Varsayılan roller oluşturma hatası:', error);
    }
}

/**
 * Yeni rol oluştur
 */
export async function createRole(serverId, name, color, permissions = []) {
    if (!db) return { success: false, error: 'DB bağlantısı yok.' };

    try {
        // Mevcut rol sayısını al (pozisyon için)
        const rolesSnap = await getDocs(collection(db, 'servers', serverId, 'roles'));

        const roleRef = await addDoc(collection(db, 'servers', serverId, 'roles'), {
            name,
            color: color || '#99aab5',
            position: rolesSnap.size,
            isDefault: false,
            permissions: permissions.length > 0 ? permissions : [PERMISSIONS.SEND_MESSAGES, PERMISSIONS.CONNECT_VOICE],
            serverId,
            createdAt: serverTimestamp()
        });

        return { success: true, roleId: roleRef.id };
    } catch (error) {
        console.error('Rol oluşturma hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Rol düzenle
 */
export async function updateRole(serverId, roleId, data) {
    if (!db) return { success: false, error: 'DB bağlantısı yok.' };

    try {
        await updateDoc(doc(db, 'servers', serverId, 'roles', roleId), data);
        return { success: true };
    } catch (error) {
        console.error('Rol düzenleme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Rol sil
 */
export async function deleteRole(serverId, roleId) {
    if (!db) return { success: false, error: 'DB bağlantısı yok.' };

    try {
        await deleteDoc(doc(db, 'servers', serverId, 'roles', roleId));
        return { success: true };
    } catch (error) {
        console.error('Rol silme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Kullanıcıya rol ata
 */
export async function assignRole(serverId, userId, roleId) {
    if (!db) return { success: false, error: 'DB bağlantısı yok.' };

    try {
        await updateDoc(doc(db, 'servers', serverId), {
            [`memberRoles.${userId}`]: arrayUnion(roleId)
        });
        return { success: true };
    } catch (error) {
        console.error('Rol atama hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Kullanıcıdan rol kaldır
 */
export async function removeRole(serverId, userId, roleId) {
    if (!db) return { success: false, error: 'DB bağlantısı yok.' };

    try {
        await updateDoc(doc(db, 'servers', serverId), {
            [`memberRoles.${userId}`]: arrayRemove(roleId)
        });
        return { success: true };
    } catch (error) {
        console.error('Rol kaldırma hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Sunucu rollerini dinle
 */
export function watchRoles(serverId, callback) {
    return onSnapshot(collection(db, 'servers', serverId, 'roles'), (snapshot) => {
        const roles = [];
        snapshot.forEach((doc) => {
            roles.push({ id: doc.id, ...doc.data() });
        });
        // Pozisyona göre sırala
        roles.sort((a, b) => (a.position || 0) - (b.position || 0));
        callback(roles);
    });
}

/**
 * Sunucu rollerini getir (bir kerelik)
 */
export async function getServerRoles(serverId) {
    if (!db) return [];

    try {
        const rolesSnap = await getDocs(collection(db, 'servers', serverId, 'roles'));
        const roles = [];
        rolesSnap.forEach((doc) => {
            roles.push({ id: doc.id, ...doc.data() });
        });
        roles.sort((a, b) => (a.position || 0) - (b.position || 0));
        return roles;
    } catch (error) {
        console.error('Roller getirme hatası:', error);
        return [];
    }
}

/**
 * Kullanıcının rollerini getir
 */
export async function getUserRoles(serverId, userId) {
    if (!db) return [];

    try {
        const serverDoc = await getDoc(doc(db, 'servers', serverId));
        if (!serverDoc.exists()) return [];

        const memberRoles = serverDoc.data().memberRoles || {};
        const userRoleIds = memberRoles[userId] || [];

        if (userRoleIds.length === 0) return [];

        const allRoles = await getServerRoles(serverId);
        return allRoles.filter(r => userRoleIds.includes(r.id));
    } catch (error) {
        console.error('Kullanıcı rolleri hatası:', error);
        return [];
    }
}

/**
 * Kullanıcının bir yetkiye sahip olup olmadığını kontrol et
 */
export async function hasPermission(serverId, userId, permission) {
    // Sunucu sahibi her zaman tüm yetkilere sahip
    try {
        const serverDoc = await getDoc(doc(db, 'servers', serverId));
        if (!serverDoc.exists()) return false;
        if (serverDoc.data().ownerId === userId) return true;

        const userRoles = await getUserRoles(serverId, userId);
        return userRoles.some(role => role.permissions?.includes(permission));
    } catch (error) {
        return false;
    }
}
