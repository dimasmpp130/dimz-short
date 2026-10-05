const API_URL = "/api/shortlink";
const STORAGE_KEY = "dimzlink_pending_create_v1";
const RESULT_STORAGE_KEY = "dimzlink_last_created_v1";

const title = document.querySelector("#verifyTitle");
const message = document.querySelector("#verifyMessage");
const wrap = document.querySelector("#recaptchaWrap");
const status = document.querySelector("#verifyStatus");
const spinner = document.querySelector("#verifySpinner");
const createButton = document.querySelector("#createLinkBtn");

let recaptchaToken = "";
let submitted = false;

function setStatus(text, type = "") {
  if (!status) return;

  status.textContent = text;
  status.className = `verify-status ${type}`;
}

function setButtonLoading(loading) {
  if (!createButton) return;

  createButton.disabled = loading;

  if (loading) {
    createButton.dataset.originalText =
      createButton.innerHTML;

    createButton.innerHTML =
      `<i class="fa-solid fa-spinner fa-spin"></i> Membuat Link...`;
  } else {
    createButton.innerHTML =
      createButton.dataset.originalText ||
      `<i class="fa-solid fa-link"></i> Buat Link`;
  }
}

function loadRecaptcha() {
  return new Promise((resolve, reject) => {
    /*
     * Jika reCAPTCHA sudah tersedia, langsung lanjut.
     */
    if (
      window.grecaptcha &&
      typeof window.grecaptcha.render === "function"
    ) {
      resolve();
      return;
    }

    /*
     * Hindari memasukkan script reCAPTCHA berkali-kali.
     */
    const existingScript = document.querySelector(
      'script[src*="google.com/recaptcha/api.js"]'
    );

    if (existingScript) {
      const started = Date.now();

      const timer = setInterval(() => {
        if (
          window.grecaptcha &&
          typeof window.grecaptcha.render === "function"
        ) {
          clearInterval(timer);
          resolve();
          return;
        }

        if (Date.now() - started > 15000) {
          clearInterval(timer);
          reject(
            new Error(
              "reCAPTCHA terlalu lama dimuat."
            )
          );
        }
      }, 100);

      return;
    }

    window.onRecaptchaLoaded = () => {
      resolve();
    };

    const script = document.createElement("script");

    script.src =
      "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoaded&render=explicit";

    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (
        window.grecaptcha &&
        typeof window.grecaptcha.render === "function"
      ) {
        resolve();
      }
    };

    script.onerror = () => {
      reject(
        new Error(
          "Gagal memuat reCAPTCHA."
        )
      );
    };

    document.head.appendChild(script);
  });
}

async function getConfig() {
  const response = await fetch(
    `${API_URL}?action=config`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    }
  );

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Server mengembalikan respons yang tidak valid."
    );
  }

  if (!response.ok || !data.ok) {
    throw new Error(
      data?.error ||
        "Gagal memuat konfigurasi CAPTCHA."
    );
  }

  return data;
}

function readPendingCreate() {
  let raw = null;

  try {
    raw = sessionStorage.getItem(
      STORAGE_KEY
    );
  } catch (error) {
    console.error(
      "Gagal membaca sessionStorage:",
      error
    );
  }

  if (!raw) {
    throw new Error(
      "Data pembuatan link tidak ditemukan. Silakan kembali ke halaman utama dan coba lagi."
    );
  }

  try {
    const payload = JSON.parse(raw);

    if (
      !payload ||
      typeof payload !== "object"
    ) {
      throw new Error();
    }

    if (!payload.destination) {
      throw new Error();
    }

    return payload;
  } catch {
    throw new Error(
      "Data pembuatan link rusak. Silakan ulangi proses."
    );
  }
}

function saveCreatedResult(link) {
  const value = JSON.stringify(link);

  /*
   * Session storage = utama.
   */
  try {
    sessionStorage.setItem(
      RESULT_STORAGE_KEY,
      value
    );
  } catch (error) {
    console.warn(
      "SessionStorage tidak tersedia:",
      error
    );
  }

  /*
   * Local storage = fallback.
   */
  try {
    localStorage.setItem(
      RESULT_STORAGE_KEY,
      value
    );
  } catch (error) {
    console.warn(
      "LocalStorage tidak tersedia:",
      error
    );
  }
}

function removePendingCreate() {
  try {
    sessionStorage.removeItem(
      STORAGE_KEY
    );
  } catch {}

  try {
    localStorage.removeItem(
      STORAGE_KEY
    );
  } catch {}
}

function getCreatedDestination(link) {
  return (
    link?.destination ||
    link?.url ||
    link?.target ||
    ""
  );
}

async function createAfterVerification() {
  /*
   * Cegah double submit.
   */
  if (
    submitted ||
    !recaptchaToken
  ) {
    return;
  }

  submitted = true;

  setButtonLoading(true);

  if (spinner) {
    spinner.classList.add("show");
  }

  setStatus(
    "Memeriksa keamanan dan membuat shortlink...",
    "success"
  );

  try {
    const payload =
      readPendingCreate();

    /*
     * Kirim request create ke API.
     */
    const response = await fetch(
      API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json"
        },

        cache: "no-store",

        body: JSON.stringify({
          action: "create",

          ...payload,

          recaptchaToken
        })
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Server tidak mengembalikan JSON yang valid."
      );
    }

    /*
     * Pastikan API benar-benar sukses.
     */
    if (
      !response.ok ||
      !data?.ok ||
      !data?.link
    ) {
      throw new Error(
        data?.error ||
          "Gagal membuat shortlink."
      );
    }

    /*
     * Pastikan alias tersedia.
     */
    if (!data.link.alias) {
      throw new Error(
        "Shortlink berhasil dibuat tetapi alias tidak diterima dari server."
      );
    }

    /*
     * Simpan HASIL LENGKAP, bukan cuma alias.
     *
     * Ini penting karena manager membutuhkan
     * destination untuk menampilkan informasi
     * pada modal.
     */
    saveCreatedResult(
      data.link
    );

    /*
     * Data pending sudah selesai digunakan.
     */
    removePendingCreate();

    /*
     * Beri waktu sangat singkat agar storage
     * benar-benar tersimpan sebelum navigasi.
     */
    await new Promise(
      (resolve) =>
        setTimeout(resolve, 50)
    );

    /*
     * Kembali ke manager.
     *
     * result=1 adalah penanda bahwa halaman
     * harus membuka modal hasil.
     */
    const target =
      `/?created=${encodeURIComponent(
        data.link.alias
      )}&result=1`;

    window.location.replace(
      target
    );

  } catch (error) {
    console.error(
      "CREATE ERROR:",
      error
    );

    submitted = false;

    if (spinner) {
      spinner.classList.remove(
        "show"
      );
    }

    setButtonLoading(false);

    setStatus(
      error?.message ||
        "Gagal membuat shortlink.",
      "error"
    );
  }
}

async function start() {
  if (!createButton) {
    console.error(
      "createLinkBtn tidak ditemukan."
    );

    return;
  }

  /*
   * Tombol tetap dipasang handler.
   * Biasanya callback CAPTCHA akan langsung
   * menjalankan createAfterVerification().
   */
  createButton.addEventListener(
    "click",
    createAfterVerification
  );

  if (title) {
    title.textContent =
      "Pemeriksaan Keamanan";
  }

  if (message) {
    message.textContent =
      "CAPTCHA selalu digunakan saat membuat shortlink baru.";
  }

  /*
   * Tombol belum boleh digunakan
   * sebelum CAPTCHA sukses.
   */
  createButton.disabled = true;
  createButton.style.opacity = "0.6";
  createButton.style.cursor =
    "not-allowed";

  try {
    /*
     * Ambil konfigurasi dan load CAPTCHA
     * secara paralel.
     */
    const [
      config
    ] = await Promise.all([
      getConfig(),
      loadRecaptcha()
    ]);

    if (
      !config?.recaptchaSiteKey
    ) {
      throw new Error(
        "CAPTCHA belum dikonfigurasi oleh admin."
      );
    }

    /*
     * Pastikan container CAPTCHA ada.
     */
    if (!wrap) {
      throw new Error(
        "Container reCAPTCHA tidak ditemukan."
      );
    }

    /*
     * Render reCAPTCHA.
     */
    window.grecaptcha.render(
      wrap,
      {
        sitekey:
          config.recaptchaSiteKey,

        callback: (
          token
        ) => {
          recaptchaToken =
            token || "";

          if (!recaptchaToken) {
            setStatus(
              "Token CAPTCHA tidak valid. Silakan coba lagi.",
              "error"
            );

            return;
          }

          createButton.disabled =
            false;

          createButton.style.opacity =
            "1";

          createButton.style.cursor =
            "pointer";

          setStatus(
            "Verifikasi berhasil. Membuat shortlink...",
            "success"
          );

          /*
           * LANGSUNG CREATE setelah CAPTCHA sukses.
           */
          createAfterVerification();
        },

        "expired-callback":
          () => {
            recaptchaToken =
              "";

            submitted =
              false;

            createButton.disabled =
              true;

            createButton.style.opacity =
              "0.6";

            createButton.style.cursor =
              "not-allowed";

            setStatus(
              "CAPTCHA kedaluwarsa. Silakan ulangi.",
              "error"
            );
          },

        "error-callback":
          () => {
            recaptchaToken =
              "";

            submitted =
              false;

            createButton.disabled =
              true;

            createButton.style.opacity =
              "0.6";

            createButton.style.cursor =
              "not-allowed";

            setStatus(
              "CAPTCHA gagal dimuat. Periksa koneksi lalu coba lagi.",
              "error"
            );
          }
      }
    );

  } catch (error) {
    console.error(
      "VERIFY INIT ERROR:",
      error
    );

    setStatus(
      error?.message ||
        "Gagal memuat CAPTCHA.",
      "error"
    );

    createButton.disabled =
      true;
  }
}

start();
