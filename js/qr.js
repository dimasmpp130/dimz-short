import { CONFIG } from "./config.js";
import { $, loadScriptOnce, toast } from "./utils.js";

let currentQRUrl = "";
let generated = false;

export function setQRUrl(url) { currentQRUrl = url; generated = false; }

export async function renderQR(container, url) {
  await loadScriptOnce(CONFIG.QR_CDN);
  container.innerHTML = "";
  new window.QRCode(container, {
    text: url,
    width: 240,
    height: 240,
    correctLevel: window.QRCode.CorrectLevel.H
  });
  generated = true;
}

async function downloadPng() {
  const box = $("#qrCanvas");
  const qr = box?.querySelector("img, canvas");
  if (!qr || !generated) return toast("Buat QR terlebih dahulu.");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 720;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,720,720);
  const qrSource = qr.tagName.toLowerCase() === "canvas" ? qr : await new Promise((resolve,reject) => {
    const img = new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=qr.src;
  });
  ctx.drawImage(qrSource, 60, 60, 600, 600);
  const a=document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download="dimz-qr.png"; a.click();
}

export function initQR() {
  $("#generateQr")?.addEventListener("click", async () => {
    if (!currentQRUrl) return toast("Shortlink belum tersedia.");
    try { await renderQR($("#qrCanvas"), currentQRUrl); }
    catch (error) { console.error(error); toast("QR gagal dibuat."); }
  });
  $("#downloadQrPng")?.addEventListener("click", () => downloadPng().catch(() => toast("PNG gagal dibuat.")));
}
