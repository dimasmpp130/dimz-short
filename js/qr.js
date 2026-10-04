import { CONFIG } from "./config.js";

import {
  $,
  loadScriptOnce,
  toast
} from "./utils.js";

let currentQRUrl = "";

export function setQRUrl(url) {
  currentQRUrl = url;
}

export function initQR() {

  $("#generateQr")?.addEventListener("click", async () => {

    if (!currentQRUrl) {
      toast("Shortlink belum tersedia.");
      return;
    }

    const container = $("#qrCanvas");

    if (!container) {
      return;
    }

    try {

      await loadScriptOnce(CONFIG.QR_CDN);

      container.innerHTML = "";

      new window.QRCode(container, {
        text: currentQRUrl,
        width: 210,
        height: 210,
        correctLevel:
          window.QRCode.CorrectLevel.M
      });

    } catch (error) {
      console.error(error);
      toast("QR gagal dibuat.");
    }
  });
}
