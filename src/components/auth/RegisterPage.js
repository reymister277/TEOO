// ========================================
// Kayıt Sayfası Bileşeni
// ========================================

import { register } from '../../services/auth.js';
import { setState } from '../../utils/state.js';
import { AVATAR_EMOJIS } from '../../utils/helpers.js';

let selectedAvatar = '😀';

export function renderRegisterPage() {
    const app = document.getElementById('app');

    const avatarsHtml = AVATAR_EMOJIS.map((emoji, i) =>
        `<div class="avatar-option ${i === 0 ? 'selected' : ''}" data-emoji="${emoji}">${emoji}</div>`
    ).join('');

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
                        <h2>Hesap Oluştur</h2>
                        <p>Topluluğa katılmak için kayıt ol</p>
                    </div>
                    
                    <div class="auth-error" id="authError"></div>
                    
                    <form id="registerForm">
                        <div class="form-group">
                            <label>Kullanıcı Adı <span class="required">*</span></label>
                            <input type="text" class="form-input" id="regName" 
                                placeholder="Kullanıcı adınız" required maxlength="30" autocomplete="username">
                        </div>
                        
                        <div class="form-group">
                            <label>E-posta <span class="required">*</span></label>
                            <input type="email" class="form-input" id="regEmail" 
                                placeholder="ornek@email.com" required autocomplete="email">
                        </div>
                        
                        <div class="form-group">
                            <label>Şifre <span class="required">*</span></label>
                            <input type="password" class="form-input" id="regPassword" 
                                placeholder="En az 6 karakter" required minlength="6" autocomplete="new-password">
                            <div class="password-strength" id="passwordStrength">
                                <div class="strength-bar" id="str1"></div>
                                <div class="strength-bar" id="str2"></div>
                                <div class="strength-bar" id="str3"></div>
                                <div class="strength-bar" id="str4"></div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Şifre Tekrar <span class="required">*</span></label>
                            <input type="password" class="form-input" id="regPasswordConfirm" 
                                placeholder="Şifrenizi tekrar girin" required autocomplete="new-password">
                        </div>
                        
                        <div class="form-group">
                            <label>Avatar Seç</label>
                            <div class="avatar-picker" id="avatarPicker">
                                ${avatarsHtml}
                            </div>
                        </div>
                        
                        <button type="submit" class="btn btn-primary" id="registerBtn">
                            <span class="btn-text">Kayıt Ol</span>
                            <div class="btn-spinner"></div>
                        </button>
                    </form>
                    
                    <div class="auth-footer">
                        Zaten hesabın var mı? <a id="goToLogin">Giriş Yap</a>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event listener'lar
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('goToLogin').addEventListener('click', () => {
        setState('ui.authPage', 'login');
        import('./LoginPage.js').then(m => m.renderLoginPage());
    });

    // Avatar seçimi
    document.getElementById('avatarPicker').addEventListener('click', (e) => {
        const option = e.target.closest('.avatar-option');
        if (option) {
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            option.classList.add('selected');
            selectedAvatar = option.dataset.emoji;
        }
    });

    // Şifre gücü
    document.getElementById('regPassword').addEventListener('input', (e) => {
        updatePasswordStrength(e.target.value);
    });
}

async function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;
    const btn = document.getElementById('registerBtn');
    const errorDiv = document.getElementById('authError');

    // Validasyon
    if (!name || !email || !password || !passwordConfirm) {
        showError(errorDiv, 'Tüm alanları doldurun.');
        return;
    }

    if (password !== passwordConfirm) {
        showError(errorDiv, 'Şifreler eşleşmiyor.');
        return;
    }

    if (password.length < 6) {
        showError(errorDiv, 'Şifre en az 6 karakter olmalıdır.');
        return;
    }

    // Loading
    btn.classList.add('btn-loading');
    btn.disabled = true;
    errorDiv.classList.remove('visible');

    const result = await register(email, password, name, selectedAvatar);

    if (!result.success) {
        showError(errorDiv, result.error);
        btn.classList.remove('btn-loading');
        btn.disabled = false;
    }
    // Başarılı ise watchAuthState otomatik olarak ana sayfaya yönlendirecek
}

function updatePasswordStrength(password) {
    const bars = [
        document.getElementById('str1'),
        document.getElementById('str2'),
        document.getElementById('str3'),
        document.getElementById('str4')
    ];

    // Tüm barları sıfırla
    bars.forEach(bar => bar.className = 'strength-bar');

    if (password.length === 0) return;

    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) strength++;

    const levels = ['weak', 'weak', 'medium', 'strong', 'strong'];
    for (let i = 0; i < strength; i++) {
        bars[i].classList.add(levels[strength]);
    }
}

function showError(element, message) {
    element.textContent = message;
    element.classList.add('visible');
    element.style.display = 'block';
}
