# TEOO - Modern Sohbet Platformu

> 🚀 Discord alternatifi — Gerçek zamanlı mesajlaşma, sesli sohbet, modüler yapı.

## Özellikler

- ✅ **Gerçek Hesap Sistemi** — Firebase Auth ile kayıt/giriş
- ✅ **Gerçek Zamanlı Mesajlaşma** — Firestore ile anlık mesajlar
- ✅ **Sesli Sohbet** — WebRTC ile gerçek ses iletimi
- ✅ **Kanal Yönetimi** — Metin + sesli kanallar oluşturma
- ✅ **Profil & Durum** — Avatar, bio, çevrimiçi durumu
- ✅ **Mesaj Düzenleme/Silme** — Tam kontrol
- ✅ **Yazılıyor Göstergesi** — Gerçek zamanlı
- ✅ **Modern UI** — Koyu tema, animasyonlar, responsive

## Hızlı Başlangıç

### 1. Bağımlılıkları Yükle
```bash
npm install
```

### 2. Firebase Kurulumu
1. [Firebase Console](https://console.firebase.google.com/) → Yeni proje oluştur
2. **Authentication** → Email/Password aktifleştir
3. **Firestore Database** → Test modunda oluştur
4. ⚙️ Project settings → Web app ekle → Config'i kopyala

### 3. Config'i Gir
`.env.example` dosyasını `.env.local` olarak kopyala ve değerleri gir:

```bash
cp .env.example .env.local
```

### 4. Çalıştır
```bash
npm run dev
```

## Deploy (Vercel)

```bash
# Vercel CLI ile
npm run build
vercel --prod

# Veya GitHub'a push et → Vercel otomatik deploy eder
```

> **Not:** Vercel'de ortam değişkenlerini (VITE_FIREBASE_*) Vercel Dashboard > Settings > Environment Variables'a da eklemeniz gerekir.

## Teknik Yapı

| Teknoloji | Kullanım |
|-----------|----------|
| Vite | Build & Dev Server |
| Vanilla JS | UI Bileşenleri |
| Firebase Auth | Hesap Yönetimi |
| Firestore | Veritabanı |
| WebRTC | Sesli Sohbet |
| CSS Variables | Tema Sistemi |

## Lisans

MIT — İstediğin gibi kullan, değiştir, dağıt!

---
**Built with ❤️ by TEOO Team**
