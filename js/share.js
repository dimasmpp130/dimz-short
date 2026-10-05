import {
  $,
  copyText,
  toast
} from "./utils.js";

let currentShareUrl = "";

export function setShareUrl(url) {
  currentShareUrl = url;
}

export function initShare() {

  $("#copyResult")?.addEventListener("click", async () => {

    if (!currentShareUrl) {
      return;
    }

    try {
      await copyText(currentShareUrl);
      toast("Shortlink berhasil disalin.");
    } catch {
      toast("Gagal menyalin link.");
    }
  });

  $("#shareNative")?.addEventListener("click", async () => {

    if (!currentShareUrl) {
      return;
    }

    if (navigator.share) {

      try {
        await navigator.share({
          title: "DIMZLINK",
          text: "Open this link",
          url: currentShareUrl
        });
      } catch {

      }

      return;
    }

    await copyText(currentShareUrl);
    toast("Link disalin karena Web Share tidak tersedia.");
  });

  $("#shareWhatsapp")?.addEventListener("click", () => {

    if (!currentShareUrl) {
      return;
    }

    const url =
      `https://wa.me/?text=${encodeURIComponent(currentShareUrl)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  });

  $("#shareTelegram")?.addEventListener("click", () => {

    if (!currentShareUrl) {
      return;
    }

    const url =
      `https://t.me/share/url?url=${encodeURIComponent(currentShareUrl)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  });

  $("#shareFacebook")?.addEventListener("click", () => {

    if (!currentShareUrl) {
      return;
    }

    const url =
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentShareUrl)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  });
}
