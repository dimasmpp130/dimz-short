# DIMZ Shortlink

**DIMZ Shortlink** adalah URL Shortener sederhana berbasis **Vercel Serverless Functions + Redis** untuk membuat, mengelola, dan memantau shortlink.

## ✨ Features

* 🔗 Custom & automatic short URL
* 🔐 Password protected links
* ⏰ Link expiration
* 📊 Click tracking
* 📱 Mobile & desktop redirect
* 🌎 Country & language redirect
* 🤖 Optional reCAPTCHA
* 🛡️ Owner-based link management
* 🚫 Blocked destination domain protection
* ⚡ Redis-based storage

## 🛠️ Tech Stack

* HTML, CSS & JavaScript
* Node.js
* Vercel Serverless Functions
* Redis REST API

## 📁 Structure

```text
dimz-short/
├── api/
│   └── shortlink.js
├── shortlink.html
├── redirect.js
├── package.json
└── README.md
```

## ⚙️ Setup

Clone repository:

```bash
git clone https://github.com/USERNAME/dimz-short.git
cd dimz-short
```

Install dependencies if required:

```bash
npm install
```

Then deploy the project to **Vercel** and configure these Environment Variables:

```env
DIMZLINK_KV_REST_API_URL=
DIMZLINK_KV_REST_API_TOKEN=
DIMZLINK_TOKEN_SECRET=
DIMZLINK_IP_SECRET=
DIMZLINK_CAPTCHA_ENABLED=false
DIMZLINK_RECAPTCHA_SITE_KEY=
DIMZLINK_RECAPTCHA_SECRET_KEY=
```

> Redis variables are required. reCAPTCHA variables are only needed when CAPTCHA is enabled.

## 🚫 Domain Protection

The API prevents users from creating or updating a shortlink that points back to the shortener itself.

Currently blocked:

```text
dimz-short.vercel.app
```

For example:

```text
https://info.dimz-wtf.web.id
https://info.dimz-wtf.web.id/test
https://info.dimz-wtf.web.id/abcd123
```

will be rejected by the API.

## 📡 API Actions

| Action   | Method | Description                    |
| -------- | ------ | ------------------------------ |
| `create` | POST   | Create a shortlink             |
| `update` | POST   | Update a shortlink             |
| `delete` | POST   | Delete a shortlink             |
| `verify` | POST   | Verify link password           |
| `track`  | POST   | Track clicks & get destination |
| `list`   | GET    | Get owner's links              |
| `config` | GET    | Get verification configuration |

## 🚀 Deployment

The project is designed to run on **Vercel**.

After configuring the Environment Variables, deploy the repository and the API will be available at:

```text
https://your-domain.com/api/shortlink
```

---

Made with ❤️ by **DIMZ**
