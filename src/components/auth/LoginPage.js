// ========================================
// Giriş Sayfası Bileşeni
// ========================================

import { login } from '../../services/auth.js';
import { setState } from '../../utils/state.js';

export function renderLoginPage() {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="auth-screen">
            <div class="auth-container">
                <div class="auth-box">
                    <div class="auth-logo">
                        <div class="auth-logo-icon">T</div>
                        <h1>TEOO</h1>
                        <p>Modern Chat Platform</p>
                    </div>
                    
                    <div class="auth-title">
                        <h2>Hoş Geldin!</h2>
                        <p>Devam etmek için giriş yap</p>
                    </div>
                    
                    <div class="auth-error" id="authError"></div>
                    
                    <form id="loginForm">
                        <div class="form-group">
                            <label>E-posta <span class="required">*</span></label>
                            <input type="email" class="form-input" id="loginEmail" 
                                placeholder="ornek@email.com" required autocomplete="email">
                        </div>
                        
                        <div class="form-group">
                            <label>Şifre <span class="required">*</span></label>
                            <input type="password" class="form-input" id="loginPassword" 
                                placeholder="Şifrenizi girin" required autocomplete="current-password">
                        </div>
                        
                        <button type="submit" class="btn btn-primary" id="loginBtn">
                            <span class="btn-text">Giriş Yap</span>
                            <div class="btn-spinner"></div>
                        </button>
                    </form>
                    
                    <div class="auth-footer">
                        Hesabın yok mu? <a id="goToRegister">Kayıt Ol</a>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event listener'lar
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('goToRegister').addEventListener('click', () => {
        setState('ui.authPage', 'register');
        // Dinamik import ile register sayfasını yükle
        import('./RegisterPage.js').then(m => m.renderRegisterPage());
    });
}

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    const errorDiv = document.getElementById('authError');

    // Validasyon
    if (!email || !password) {
        showError(errorDiv, 'Tüm alanları doldurun.');
        return;
    }

    // Loading
    btn.classList.add('btn-loading');
    btn.disabled = true;
    errorDiv.classList.remove('visible');

    const result = await login(email, password);

    if (!result.success) {
        showError(errorDiv, result.error);
        btn.classList.remove('btn-loading');
        btn.disabled = false;
    }
    // Başarılı ise watchAuthState otomatik olarak ana sayfaya yönlendirecek
}

function showError(element, message) {
    element.textContent = message;
    element.classList.add('visible');
    element.style.display = 'block';
}
