# DIMZ/SHORT

URL shortener gratis berbasis Vercel Serverless Functions + Redis.

## Konsep

**Sederhana di depan, kuat di belakang.**

- Paste URL → Buat Link → Salin.
- Tidak ada login wajib untuk pengguna.
- Tidak ada Premium, VIP, Pro, subscription, atau pembayaran.
- Batas dibuat untuk anti-spam/abuse, bukan untuk memaksa pembayaran.

## Fitur final

### Keamanan
- Validasi URL http/https.
- Blocked domain dan perlindungan tujuan internal/private.
- Suspicious URL detection dasar.
- Rate limit pembuatan dan redirect.
- Basic bot detection.
- CAPTCHA selalu muncul saat membuat shortlink.
- CAPTCHA selalu muncul saat membuka shortlink, setelah halaman Preparing/timer.
- Password link menggunakan scrypt untuk link baru.
- Security headers.
- Secret/config hanya melalui environment variable.

### Analytics
- Total klik.
- Unique visitor berbasis hash.
- Human vs bot.
- Negara.
- Device.
- OS.
- Browser.
- Bahasa.
- Referrer.
- Klik per jam/hari.
- Recent activity.
- Export CSV.

### Link management
- Search.
- Filter status.
- Sort.
- Pause / Resume.
- Expiration.
- Password.
- Health check saat diminta.
- QR berlogo.

Tidak ada checkbox di samping URL dan tidak ada bulk action `Pause`, `Resume`, atau `Delete Selected`.

### Advanced Redirect / Management
Fitur mobile redirect, desktop redirect, country redirect, language redirect, A/B redirect, dan panel Advanced Redirect/Management dihapus dari UI dan backend.

### Duplicate destination
Tujuan yang sama tidak langsung diberi notifikasi.

- Tujuan yang sama dapat dibuat maksimal 3 kali per workspace/IP dalam 24 jam.
- Setelah 24 jam batas reset otomatis.
- URL YouTube dengan parameter `si`, `utm_*`, `fbclid`, atau `gclid` yang berbeda tetap dikenali sebagai tujuan yang sama.

### Anonymous Workspace
Pengguna tetap anonymous.

Tidak ada recovery code, tidak ada kode key yang perlu dilihat atau disalin pengguna. Workspace dikelola melalui cookie HttpOnly di browser.

### QR
- Gratis untuk user.
- QR default memakai logo `/assets/icon/qr.png` di tengah.
- User dapat membuat PNG/SVG.
- Admin memiliki generator QR khusus admin dan dapat memilih logo custom.

### Link Health
Health check dilakukan ketika diminta agar tidak membebani server secara agresif.

### Redis / backend
- Click counter dipisahkan dari event analytics.
- Event analytics disimpan terpisah.
- Index alias menggunakan Redis Set.
- `SCAN` hanya menjadi fallback migrasi data lama, bukan mekanisme utama.
- Rate-limit storage.
- Validasi input.
- Error handling.
- Logging.
- Race-condition risk pada counter dikurangi dengan `INCR`.

## Environment Variables

```env
DIMZLINK_KV_REST_API_URL=
DIMZLINK_KV_REST_API_TOKEN=

DIMZLINK_TOKEN_SECRET=
DIMZLINK_IP_SECRET=

TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

DIMZLINK_ADMIN_PASSWORD=
DIMZLINK_ADMIN_PASSWORD_HASH=
DIMZLINK_ADMIN_SECRET=
```

`DIMZLINK_ADMIN_PASSWORD_HASH` bersifat opsional untuk instalasi yang ingin menyimpan hash password admin. Bila hash disediakan, hash tersebut diprioritaskan.

CAPTCHA diperlukan karena pada versi final CAPTCHA memang selalu aktif.

## Struktur

```text
dimz-short-main/
├── api/
│   ├── shortlink.js
│   └── admins.js
├── assets/
│   ├── icon/
│   │   └── qr.png
│   └── css/
├── js/
│   ├── manager.js
│   ├── redirect.js
│   ├── qr.js
│   ├── admins.js
│   ├── verify.js
│   └── ...
├── index.html
├── verify.html
├── admins.html
├── shortlink.js
├── package.json
└── vercel.json
```

## Catatan

Health check dari browser sengaja digunakan agar server tidak menjadi proxy untuk URL arbitrary.

Language support: English base with full translations for Indonesian, Spanish, French, German, Portuguese, Chinese, Japanese and more. Auto-detects browser language. Language switcher is available centered above the footer.


## Cloudflare Turnstile

1. Buat widget di https://dash.cloudflare.com/ pada menu Turnstile.
2. Tambahkan domain produksi dan domain preview yang benar-benar digunakan.
3. Di Vercel Project Settings → Environment Variables, tambahkan:
   - `TURNSTILE_SITE_KEY` — Site Key publik untuk widget frontend.
   - `TURNSTILE_SECRET_KEY` — Secret Key untuk verifikasi server; jangan pernah taruh di HTML/JS.
4. Redeploy setelah mengubah environment variables.
5. Pastikan domain widget di Cloudflare cocok dengan domain website. Untuk pengujian lokal, tambahkan `localhost` pada daftar hostname atau gunakan test keys resmi Cloudflare.
