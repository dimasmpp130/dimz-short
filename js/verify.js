const API_URL = "/api/shortlink";
const STORAGE_KEY = "dimzlink_pending_create_v1";
const title = document.querySelector("#verifyTitle");
const message = document.querySelector("#verifyMessage");
const wrap = document.querySelector("#recaptchaWrap");
const status = document.querySelector("#verifyStatus");
const spinner = document.querySelector("#verifySpinner");
const createButton = document.querySelector("#createLinkBtn");
let recaptchaToken = "";
let submitted = false;

function setStatus(text, type = "") {
  status.textContent = text;
  status.className = `verify-status ${type}`;
}

function showCaptchaRetry() {
  let retry = document.querySelector("#captchaRetry");
  if (!retry) {
    retry = document.createElement("button");
    retry.id = "captchaRetry";
    retry.type = "button";
    retry.textContent = "Muat Ulang CAPTCHA";
    retry.style.cssText =
      "display:block;margin:8px auto 0;border:0;background:transparent;color:#4f46e5;font-weight:700;cursor:pointer;padding:6px 10px";
    status.insertAdjacentElement("afterend", retry);
    retry.addEventListener("click", async () => {
      retry.remove();
      recaptchaToken = "";
      createButton.disabled = true;
      wrap.innerHTML = "";
      await renderCaptcha();
    });
  }
}

async function renderCaptcha() {
  try {
    const config = await getConfig();
    if (!config.recaptchaSiteKey) {
      throw new Error("CAPTCHA belum dikonfigurasi oleh admin.");
    }

    const recaptcha = await loadRecaptcha();
    wrap.innerHTML = "";

    recaptcha.render(wrap, {
      sitekey: config.recaptchaSiteKey,
      theme: "light",
      callback: token => {
        recaptchaToken = token;
        createButton.disabled = false;
        createButton.style.opacity = "1";
        createButton.style.cursor = "pointer";
        setStatus("Verifikasi berhasil. Tekan Buat Link.", "success");
      },
      "expired-callback": () => {
        recaptchaToken = "";
        createButton.disabled = true;
        setStatus("CAPTCHA kedaluwarsa. Silakan ulangi.", "error");
      },
      "error-callback": () => {
        recaptchaToken = "";
        createButton.disabled = true;
        setStatus(
          "CAPTCHA gagal dimuat. Coba muat ulang CAPTCHA.",
          "error"
        );
        showCaptchaRetry();
      }
    });
  } catch (error) {
    createButton.disabled = true;
    setStatus(
      error.message || "Gagal memuat CAPTCHA. Coba lagi.",
      "error"
    );
    showCaptchaRetry();
  }
}

function loadRecaptcha() {
  if (window.grecaptcha?.render) {
    return Promise.resolve(window.grecaptcha);
  }

  if (window.__dimzRecaptchaPromise) {
    return window.__dimzRecaptchaPromise;
  }

  window.__dimzRecaptchaPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(
        "CAPTCHA tidak merespons. Periksa koneksi, pemblokir iklan, atau DNS lalu coba lagi."
      ));
    }, 15000);

    const finish = () => {
      clearTimeout(timeout);

      if (window.grecaptcha?.render) {
        resolve(window.grecaptcha);
      } else {
        reject(new Error("CAPTCHA selesai dimuat tetapi tidak siap."));
      }
    };

    const existing = document.querySelector(
      'script[src^="https://www.google.com/recaptcha/api.js"]'
    );

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener(
        "error",
        () => {
          clearTimeout(timeout);
          reject(new Error("CAPTCHA diblokir atau gagal dimuat."));
        },
        { once: true }
      );

      // Script may have finished before this listener was attached.
      if (window.grecaptcha?.render) finish();
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://www.google.com/recaptcha/api.js?render=explicit";
    script.async = true;
    script.defer = true;

    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(new Error(
          "CAPTCHA diblokir atau gagal dimuat. Coba nonaktifkan ad-blocker untuk situs ini lalu ulangi."
        ));
      },
      { once: true }
    );

    document.head.appendChild(script);
  }).finally(() => {
    window.__dimzRecaptchaPromise = null;
  });

  return window.__dimzRecaptchaPromise;
}

async function getConfig() {
  const response = await fetch(`${API_URL}?action=config`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "Gagal memuat CAPTCHA.");
  return data;
}

async function createAfterVerification() {
  if (submitted || !recaptchaToken) return;
  submitted = true;
  createButton.disabled = true;
  spinner.classList.add("show");
  setStatus("Memeriksa keamanan dan membuat shortlink...", "success");

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("Data pembuatan link tidak ditemukan. Silakan ulangi dari halaman utama.");
    const payload = JSON.parse(raw);
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...payload, recaptchaToken })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Gagal membuat shortlink.");
    sessionStorage.removeItem(STORAGE_KEY);
    location.replace(`/shortlink?created=${encodeURIComponent(data.link.alias)}`);
  } catch (error) {
    submitted = false;
    spinner.classList.remove("show");
    setStatus(error.message || "Gagal membuat shortlink.", "error");
    createButton.disabled = !recaptchaToken;
  }
}

async function start() {
  createButton.addEventListener("click", createAfterVerification);
  title.textContent = "Pemeriksaan Keamanan";
  message.textContent = "CAPTCHA selalu digunakan saat membuat shortlink baru.";
  await renderCaptcha();
}
start();
