DIMZLINK Shortlink

DIMZLINK adalah layanan URL shortener berbasis Vercel Serverless Functions + Redis.

✨ Fitur

- 🔗 Custom alias atau alias otomatis
- 🔐 Password protection
- ⏰ Expiration link
- 📱 Redirect mobile & desktop
- 🌎 Redirect berdasarkan negara
- 🌐 Redirect berdasarkan bahasa
- 📊 Click tracking & statistik
- 🛡️ reCAPTCHA
- 👤 Owner key untuk mengelola link
- 🗑️ Create, update, delete, dan list shortlink
- 🚫 Proteksi domain shortener sendiri

---

📁 Struktur

dimz-short/
├── api/
│   └── shortlink.js
├── public/
├── package.json
├── vercel.json
└── README.md

Endpoint:

/api/shortlink

---

⚙️ Environment Variables

Tambahkan di Vercel → Settings → Environment Variables:

DIMZLINK_KV_REST_API_URL=
DIMZLINK_KV_REST_API_TOKEN=

DIMZLINK_TOKEN_SECRET=
DIMZLINK_IP_SECRET=

DIMZLINK_CAPTCHA_ENABLED=
DIMZLINK_RECAPTCHA_SECRET_KEY=
DIMZLINK_RECAPTCHA_SITE_KEY=

Redis

DIMZLINK_KV_REST_API_URL=https://xxxxx.upstash.io
DIMZLINK_KV_REST_API_TOKEN=xxxxx

Redis wajib dikonfigurasi agar API dapat berjalan.

Security

Gunakan secret random untuk:

DIMZLINK_TOKEN_SECRET=your-random-secret
DIMZLINK_IP_SECRET=your-random-ip-secret

Jangan expose secret tersebut ke frontend.

reCAPTCHA

Jika ingin mengaktifkan:

DIMZLINK_CAPTCHA_ENABLED=true
DIMZLINK_RECAPTCHA_SECRET_KEY=xxxxx
DIMZLINK_RECAPTCHA_SITE_KEY=xxxxx

Jika tidak digunakan:

DIMZLINK_CAPTCHA_ENABLED=false

---

🔗 Create Shortlink

POST /api/shortlink

Contoh:

{
  "action": "create",
  "alias": "google",
  "destination": "https://google.com"
}

Jika "alias" tidak diberikan, sistem akan membuat alias random.

Response:

{
  "ok": true,
  "ownerKey": "xxxxxxxx",
  "link": {
    "alias": "google",
    "destination": "https://google.com",
    "clicks": 0,
    "passwordProtected": false
  }
}

Simpan "ownerKey" untuk melakukan update atau delete.

---

🔐 Password

Shortlink dapat menggunakan password:

{
  "action": "create",
  "alias": "private",
  "destination": "https://example.com",
  "password": "rahasia123"
}

Password disimpan dalam bentuk hash dan tidak dikembalikan ke client.

Untuk verifikasi:

{
  "action": "verify",
  "alias": "private",
  "password": "rahasia123"
}

Jika benar, API memberikan "accessToken" yang berlaku selama 10 menit.

---

⏰ Expiration

Tambahkan:

{
  "expiresAt": "2026-12-31T23:59:59.000Z"
}

Setelah expired, API mengembalikan:

410 Gone

---

📱 Redirect Rules

Mobile / Desktop

{
  "mobileUrl": "https://example.com/mobile",
  "desktopUrl": "https://example.com/desktop"
}

Country

{
  "countryRules": {
    "ID": "https://example.com/id",
    "US": "https://example.com/us"
  }
}

Language

{
  "languageRules": {
    "id": "https://example.com/id",
    "en": "https://example.com/en"
  }
}

Prioritas redirect:

Country
   ↓
Language
   ↓
Mobile / Desktop
   ↓
Destination

---

📊 Click Tracking

Tracking menggunakan:

POST /api/shortlink

{
  "action": "track",
  "alias": "google"
}

Response:

{
  "ok": true,
  "clicks": 10,
  "destination": "https://google.com"
}

Data seperti device, browser, country, language, referrer, dan hashed IP dapat dicatat.

Maksimal 50 click log terakhir disimpan.

---

🛡️ Self-Domain Protection

Domain shortener sendiri tidak boleh digunakan sebagai destination:

dimz-short.vercel.app

Termasuk:

https://dimz-short.vercel.app
https://dimz-short.vercel.app/test
https://sub.dimz-short.vercel.app

Proteksi berlaku pada:

CREATE
UPDATE

Jika dicoba, API mengembalikan:

{
  "ok": false,
  "error": "URL tersebut tidak dapat digunakan sebagai tujuan shortlink."
}

---

📌 Endpoint

Method| Endpoint| Fungsi
GET| "?alias=xxx"| Detail shortlink
GET| "?action=config"| Config reCAPTCHA
GET| "?action=list&ownerKey=xxx"| List link
POST| "action=create"| Membuat shortlink
POST| "action=update"| Update shortlink
POST| "action=delete"| Hapus shortlink
POST| "action=verify"| Verifikasi password
POST| "action=track"| Tracking klik

---

🚀 Deploy

Setelah mengubah "api/shortlink.js", deploy ulang ke Vercel.

Dengan Git
