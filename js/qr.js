import { CONFIG } from "./config.js";
import { $, loadScriptOnce, toast } from "./utils.js";

let currentQRUrl = "";
let generated = false;
let currentLogo = "/assets/icon/qr-create.png";
let currentQRCanvas = null;
let logoMode = localStorage.getItem("dimz_qr_logo_size") || "small";

const DEFAULT_LOGO = "/assets/icon/qr-create.png";
const EXPORT_QR_SIZE = 600;

function qrSize() {
  const value = Number(localStorage.getItem("dimz_qr_size") || 240);
  return Math.max(160, Math.min(600, Number.isFinite(value) ? value : 240));
}

export function setQRUrl(url) {
  currentQRUrl = url;
  generated = false;
  currentQRCanvas = null;
}

function logoRatio() {
  return logoMode === "medium" ? 0.20 : 0.15;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawLogo(ctx, img, center, qrWidth) {
  if (!img) return;

  // Small/medium are deliberately limited to 15% / 20% of the QR.
  // This leaves enough finder/data modules visible around the logo.
  const logoSize = Math.round(qrWidth * logoRatio());
  const padding = Math.max(5, Math.round(logoSize * 0.16));
  const boxSize = logoSize + padding * 2;
  const x = Math.round(center - boxSize / 2);
  const y = Math.round(center - boxSize / 2);

  ctx.save();

  ctx.fillStyle = "#fff";
  roundedRect(ctx, x, y, boxSize, boxSize, Math.max(7, Math.round(boxSize * 0.16)));
  ctx.fill();

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const logoX = Math.round(center - logoSize / 2);
  const logoY = Math.round(center - logoSize / 2);
  ctx.drawImage(img, logoX, logoY, logoSize, logoSize);

  ctx.restore();
}

async function sourceToImage(source) {
  if (!source) throw new Error("QR source tidak tersedia.");

  if (source instanceof HTMLCanvasElement) {
    return source;
  }

  return loadImage(source.src);
}

async function buildCompositeQr(source, logoSrc, size) {
  const sourceImage = await sourceToImage(source);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Browser tidak mendukung canvas.");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceImage, 0, 0, size, size);

  try {
    const logo = await loadImage(logoSrc || DEFAULT_LOGO);
    drawLogo(ctx, logo, size / 2, size);
  } catch {
    // QR remains valid if the optional logo cannot be loaded.
  }

  return canvas;
}

export async function renderQR(container, url, logoSrc = DEFAULT_LOGO) {
  if (!container || !url) throw new Error("QR URL tidak tersedia.");

  await loadScriptOnce(CONFIG.QR_CDN);

  // Generate the QR in an isolated temporary container first.
  const temp = document.createElement("div");
  temp.style.position = "fixed";
  temp.style.left = "-10000px";
  temp.style.top = "0";
  temp.style.width = `${qrSize()}px`;
  temp.style.height = `${qrSize()}px`;
  temp.style.opacity = "0";
  temp.style.pointerEvents = "none";
  document.body.appendChild(temp);

  try {
    new window.QRCode(temp, {
      text: url,
      width: qrSize(),
      height: qrSize(),
      correctLevel: window.QRCode.CorrectLevel.H
    });

    await new Promise(resolve => setTimeout(resolve, 120));

    const qrSource = temp.querySelector("canvas, img");
    if (!qrSource) throw new Error("QR library tidak menghasilkan gambar.");

    currentLogo = logoSrc || DEFAULT_LOGO;
    currentQRCanvas = await buildCompositeQr(qrSource, currentLogo, qrSize());

    container.innerHTML = "";
    container.classList.remove("qr-overlay");

    currentQRCanvas.className = "qr-render";
    currentQRCanvas.setAttribute("role", "img");
    currentQRCanvas.setAttribute("aria-label", "QR Code shortlink");

    container.appendChild(currentQRCanvas);
    generated = true;
  } finally {
    temp.remove();
  }
}

function safeName() {
  const tail =
    currentQRUrl.split("/").filter(Boolean).pop() || "shortlink";

  return `dimz-${String(tail)
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .slice(0, 40) || "shortlink"}`;
}

function getQrSource() {
  if (!currentQRCanvas || !generated) {
    toast("Buat QR terlebih dahulu.");
    return null;
  }

  return currentQRCanvas;
}

async function downloadPng() {
  const qr = getQrSource();
  if (!qr) return;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 720;

  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 720, 720);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(qr, 60, 60, EXPORT_QR_SIZE, EXPORT_QR_SIZE);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `${safeName()}.png`;
  a.click();
}

async function downloadSvg() {
  const qr = getQrSource();
  if (!qr) return;

  // The displayed canvas already contains the controlled logo.
  // Embedding it once prevents the old double-logo / oversized-logo issue.
  const qrData = qr.toDataURL("image/png");

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg"
     width="720" height="720" viewBox="0 0 720 720">
  <rect width="720" height="720" fill="#fff"/>
  <image href="${qrData.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"
         x="60" y="60" width="600" height="600"
         preserveAspectRatio="none"/>
</svg>`.trim();

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName()}.svg`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initQR() {
  $("#generateQr")?.addEventListener("click", async () => {
    if (!currentQRUrl) {
      toast("Shortlink belum tersedia.");
      return;
    }

    try {
      await renderQR($("#qrCanvas"), currentQRUrl, DEFAULT_LOGO);
    } catch (error) {
      console.error(error);
      toast("QR gagal dibuat. Coba lagi.");
    }
  });

  $("#downloadQrPng")?.addEventListener(
    "click",
    () => downloadPng().catch(() => toast("PNG gagal dibuat."))
  );

  $("#downloadQrSvg")?.addEventListener(
    "click",
    () => downloadSvg().catch(() => toast("SVG gagal dibuat."))
  );
}
