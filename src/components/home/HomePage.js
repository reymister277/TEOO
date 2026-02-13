// ========================================
// Karşılama Sayfası Bileşeni
// ========================================
// Giriş sonrası gösterilen tanıtım sayfası

import { getState } from '../../utils/state.js';

export function renderHomePage(container) {
    if (!container) return;

    const user = getState('user');

    container.innerHTML = `
        <div class="home-page">
            <div class="home-bg">
                <img src="/fire-warrior.jpg" alt="" class="home-bg-img" />
                <div class="home-bg-overlay"></div>
            </div>

            <div class="home-content">
                <div class="home-hero">
                    <div class="home-logo-section">
                        <div class="home-logo">T</div>
                        <h1 class="home-title">TEOO</h1>
                        <p class="home-subtitle">Savaşçıların Buluşma Noktası</p>
                    </div>

                    <p class="home-desc">
                        Sesli sohbet, mesajlaşma ve arkadaşlık sistemiyle gerçek zamanlı iletişim platformu. 
                        Kendi sunucunu oluştur, arkadaşlarını davet et, birlikte konuş!
                    </p>

                    <div class="home-features">
                        <div class="home-feature">
                            <span class="home-feature-icon">💬</span>
                            <span class="home-feature-text">Anlık Mesajlaşma</span>
                        </div>
                        <div class="home-feature">
                            <span class="home-feature-icon">🎙️</span>
                            <span class="home-feature-text">Sesli Sohbet</span>
                        </div>
                        <div class="home-feature">
                            <span class="home-feature-icon">👥</span>
                            <span class="home-feature-text">Arkadaş Sistemi</span>
                        </div>
                        <div class="home-feature">
                            <span class="home-feature-icon">🌐</span>
                            <span class="home-feature-text">Özel Sunucular</span>
                        </div>
                    </div>
                </div>

                <div class="home-actions">
                    <button class="home-action-btn primary" id="homeCreateServer">
                        <span class="home-action-icon">✨</span>
                        <div>
                            <div class="home-action-title">Sunucu Oluştur</div>
                            <div class="home-action-desc">Kendi topluluğunu kur</div>
                        </div>
                    </button>
                    
                    <button class="home-action-btn secondary" id="homeJoinServer">
                        <span class="home-action-icon">🔗</span>
                        <div>
                            <div class="home-action-title">Sunucuya Katıl</div>
                            <div class="home-action-desc">Davet kodu ile gir</div>
                        </div>
                    </button>

                    <button class="home-action-btn accent" id="homeFriends">
                        <span class="home-action-icon">👥</span>
                        <div>
                            <div class="home-action-title">Arkadaşlar</div>
                            <div class="home-action-desc">Arkadaşlarını gör</div>
                        </div>
                    </button>
                </div>

                <div class="home-user-card">
                    <div class="home-user-avatar">${user?.avatar || '😀'}</div>
                    <div class="home-user-info">
                        <div class="home-user-name">${user?.displayName || 'Kullanıcı'}</div>
                        <div class="home-user-code">Arkadaş Kodu: <strong>#${user?.friendCode || '...'}</strong></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event'ler
    document.getElementById('homeCreateServer')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('openServerModal', { detail: { mode: 'create' } }));
    });

    document.getElementById('homeJoinServer')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('openServerModal', { detail: { mode: 'join' } }));
    });

    document.getElementById('homeFriends')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('showFriends'));
    });
}
