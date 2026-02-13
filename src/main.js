// ========================================
// TEOO - Ana Giriş Noktası
// ========================================
// Stilleri yükler, Firebase durumunu kontrol eder,
// doğru sayfayı gösterir.

// Stiller
import './styles/main.css';
import './styles/animations.css';
import './styles/auth.css';
import './styles/sidebar.css';
import './styles/chat.css';
import './styles/voice.css';
import './styles/members.css';
import './styles/settings.css';
import './styles/friends.css';
import './styles/home.css';

// Modüller
import { isFirebaseConfigured } from './config/firebase.js';
import { setState } from './utils/state.js';

// ========================================
// Uygulama Başlatma
// ========================================

console.log('%c🚀 TEOO Chat Platform v2.0', 'color: #7c5cfc; font-size: 20px; font-weight: bold;');
console.log('%cDiscord alternatifi - Modern sohbet platformu', 'color: #b9bbbe; font-size: 12px;');

// Firebase yapılandırma kontrolü
if (!isFirebaseConfigured()) {
    showSetupGuide();
} else {
    showLoading();
    startApp();
}

/**
 * Uygulamayı başlat (Firebase yapılandırılmışsa)
 */
async function startApp() {
    // Dinamik import - Firebase modüllerini sadece gerektiğinde yükle
    const { watchAuthState } = await import('./services/auth.js');
    const { renderLoginPage } = await import('./components/auth/LoginPage.js');
    const { renderApp } = await import('./components/App.js');

    watchAuthState((user) => {
        setState('ui.loading', false);

        if (user) {
            console.log('✅ Giriş yapıldı:', user.displayName);
            renderApp();
        } else {
            console.log('🔒 Giriş gerekli');
            renderLoginPage();
        }
    });
}

/**
 * Yükleniyor ekranı
 */
function showLoading() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="auth-screen">
            <div style="text-align: center;">
                <div style="
                    width: 80px; height: 80px;
                    background: var(--accent-gradient);
                    border-radius: 24px;
                    display: inline-flex; align-items: center; justify-content: center;
                    font-size: 36px; font-weight: 800; color: white;
                    margin-bottom: 24px;
                    box-shadow: var(--accent-glow);
                    animation: pulse 1.5s infinite;
                ">T</div>
                <div style="color: var(--text-muted); font-size: 14px;">Yükleniyor...</div>
            </div>
        </div>
    `;
}

/**
 * Firebase kurulum rehberi (config girilmemişse gösterilir)
 */
function showSetupGuide() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="auth-screen" style="overflow-y: auto;">
            <div style="max-width: 680px; padding: 40px 24px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 48px;">
                    <div style="
                        width: 80px; height: 80px;
                        background: var(--accent-gradient);
                        border-radius: 24px;
                        display: inline-flex; align-items: center; justify-content: center;
                        font-size: 36px; font-weight: 800; color: white;
                        margin-bottom: 16px;
                        box-shadow: var(--accent-glow);
                    ">T</div>
                    <h1 style="font-size: 32px; font-weight: 800; background: var(--accent-gradient);
                        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                        background-clip: text; margin-bottom: 8px;">TEOO</h1>
                    <p style="color: var(--text-muted); font-size: 16px;">Modern Chat Platform</p>
                </div>
                
                <div style="background: var(--bg-secondary); border: 1px solid var(--border);
                    border-radius: 16px; padding: 32px; margin-bottom: 24px;">
                    <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: var(--warning);">
                        ⚙️ Firebase Kurulumu Gerekli
                    </h2>
                    <p style="color: var(--text-secondary); margin-bottom: 24px; line-height: 1.6;">
                        TEOO'nun çalışması için bir Firebase projesi oluşturmanız gerekiyor. 
                        Firebase ücretsiz katmanı ile başlayabilirsiniz — kredi kartı gerekmez!
                    </p>
                    
                    <div class="setup-steps">
                        <div class="setup-step">
                            <div class="step-number">1</div>
                            <div class="step-content">
                                <h3>Firebase Projesi Oluştur</h3>
                                <p><a href="https://console.firebase.google.com/" target="_blank" 
                                    style="color: var(--accent-secondary);">Firebase Console</a> 
                                    sayfasına git → <strong>"Add project"</strong> → Proje adı: <code>teoo-chat</code></p>
                            </div>
                        </div>
                        
                        <div class="setup-step">
                            <div class="step-number">2</div>
                            <div class="step-content">
                                <h3>Authentication Aktifleştir</h3>
                                <p>Sol menü → <strong>Authentication</strong> → <strong>Get started</strong> → 
                                   Sign-in method → <strong>Email/Password</strong> → Enable</p>
                            </div>
                        </div>
                        
                        <div class="setup-step">
                            <div class="step-number">3</div>
                            <div class="step-content">
                                <h3>Firestore Database Oluştur</h3>
                                <p>Sol menü → <strong>Firestore Database</strong> → <strong>Create database</strong> → 
                                   <strong>Start in test mode</strong> → Bölge seç (europe-west) → Enable</p>
                            </div>
                        </div>
                        
                        <div class="setup-step">
                            <div class="step-number">4</div>
                            <div class="step-content">
                                <h3>Web App Oluştur ve Config Al</h3>
                                <p>⚙️ Project settings → <strong>Your apps</strong> → Web (<strong>&lt;/&gt;</strong>) ikonu → 
                                   App adı: <code>TEOO</code> → Register → <strong>firebaseConfig</strong> nesnesini kopyala</p>
                            </div>
                        </div>
                        
                        <div class="setup-step">
                            <div class="step-number">5</div>
                            <div class="step-content">
                                <h3>Config'i Projeye Ekle</h3>
                                <p>İki yöntem var:</p>
                                <div style="margin-top: 12px;">
                                    <strong style="color: var(--success);">Yöntem A: .env.local dosyası (önerilen)</strong>
                                    <pre style="background: var(--bg-primary); padding: 16px; border-radius: 8px; 
                                        margin-top: 8px; font-size: 13px; color: var(--text-secondary);
                                        overflow-x: auto; font-family: var(--font-mono);">VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=teoo-chat.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://teoo-chat-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=teoo-chat
VITE_FIREBASE_STORAGE_BUCKET=teoo-chat.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123</pre>
                                </div>
                                <div style="margin-top: 16px;">
                                    <strong style="color: var(--info);">Yöntem B: Doğrudan firebase.js</strong>
                                    <p style="margin-top: 4px;"><code>src/config/firebase.js</code> dosyasındaki değerleri değiştirin.</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="setup-step">
                            <div class="step-number">6</div>
                            <div class="step-content">
                                <h3>Çalıştır! 🚀</h3>
                                <pre style="background: var(--bg-primary); padding: 12px; border-radius: 8px; 
                                    font-size: 13px; color: var(--success); font-family: var(--font-mono);">npm run dev</pre>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; color: var(--text-muted); font-size: 13px;">
                    <p>Firebase ücretsiz katman limitleri: <strong>1GB depolama</strong>, <strong>50K günlük okuma</strong>, 
                       <strong>50K auth/ay</strong></p>
                    <p style="margin-top: 8px;">Yardıma mı ihtiyacın var? 
                       <a href="https://firebase.google.com/docs" target="_blank" style="color: var(--accent-secondary);">
                       Firebase Docs</a></p>
                </div>
            </div>
        </div>
        
        <style>
            .setup-steps {
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            .setup-step {
                display: flex;
                gap: 16px;
                align-items: flex-start;
            }
            .step-number {
                width: 32px;
                height: 32px;
                min-width: 32px;
                background: var(--accent-gradient);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 14px;
                color: white;
                margin-top: 2px;
            }
            .step-content {
                flex: 1;
            }
            .step-content h3 {
                font-size: 15px;
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: 6px;
            }
            .step-content p {
                font-size: 13px;
                color: var(--text-secondary);
                line-height: 1.6;
            }
            .step-content code {
                background: var(--bg-primary);
                padding: 2px 6px;
                border-radius: 4px;
                font-family: var(--font-mono);
                font-size: 12px;
                color: var(--accent-secondary);
            }
        </style>
    `;
}
