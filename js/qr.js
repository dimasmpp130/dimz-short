import { CONFIG } from "./config.js";
import { $, loadScriptOnce, toast } from "./utils.js";

let currentQRUrl = "";
let generated = false;
let currentLogo = "/assets/icon/qr-create.png";
let logoMode = localStorage.getItem("dimz_qr_logo_size") || "small";
const DEFAULT_LOGO = "/assets/icon/qr-create.png";
const EXPORT_QR_SIZE = 600;
function qrSize(){ return Number(localStorage.getItem("dimz_qr_size") || 240); }

export function setQRUrl(url) { currentQRUrl = url; generated = false; }
function logoSize() { return logoMode === "medium" ? 44 : 32; }

function addLogo(container, logoSrc = DEFAULT_LOGO) {
  const logo = document.createElement("img");
  logo.className = "qr-logo";
  logo.dataset.size = logoMode;
  logo.src = logoSrc;
  logo.alt = "Logo DIMZ";
  logo.onerror = () => logo.remove();
  container.classList.add("qr-overlay");
  container.appendChild(logo);
}

export async function renderQR(container, url, logoSrc = DEFAULT_LOGO) {
  await loadScriptOnce(CONFIG.QR_CDN);
  container.innerHTML = "";
  container.classList.remove("qr-overlay");
  new window.QRCode(container, { text: url, width: qrSize(), height: qrSize(), correctLevel: window.QRCode.CorrectLevel.H });
  await new Promise(r => setTimeout(r, 120));
  currentLogo = logoSrc || DEFAULT_LOGO;
  addLogo(container, currentLogo);
  generated = true;
}

async function loadImage(src) {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function logoImage() {
  const el = $("#qrCanvas")?.querySelector(".qr-logo");
  if (!el?.src) return null;
  try { return await loadImage(el.src); } catch { return null; }
}

function drawLogo(ctx, img, x, y, size) {
  if (!img) return;
  const pad = Math.round(size * .16);
  const box = size + pad * 2;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(x - pad, y - pad, box, box, Math.round(box * .18));
  ctx.fill();
  ctx.drawImage(img, x, y, size, size);
}

function safeName() {
  const tail = currentQRUrl.split("/").filter(Boolean).pop() || "shortlink";
  return `dimz-${String(tail).replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40) || "shortlink"}`;
}

async function getQrSource() {
  const box = $("#qrCanvas");
  const qr = box?.querySelector("img:not(.qr-logo), canvas");
  if (!qr || !generated) { toast("Buat QR terlebih dahulu."); return null; }
  return qr.tagName.toLowerCase() === "canvas" ? qr : await loadImage(qr.src);
}

async function downloadPng() {
  const qr = await getQrSource(); if (!qr) return;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 720;
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0,0,720,720);
  ctx.drawImage(qr, 60, 60, EXPORT_QR_SIZE, EXPORT_QR_SIZE);
  const logo = await logoImage();
  if (logo) { const size = logoSize() * 2.5; drawLogo(ctx, logo, (720-size)/2, (720-size)/2, size); }
  const a=document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download=`${safeName()}.png`; a.click();
}

async function downloadSvg() {
  const qr = await getQrSource(); if (!qr) return;
  const qrData = qr instanceof HTMLCanvasElement ? qr.toDataURL("image/png") : qr.src;
  let logoData = "";
  const logoEl = $("#qrCanvas .qr-logo");
  if (logoEl?.src) { try { logoData = await fetch(logoEl.src).then(r=>r.blob()).then(b=>new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(b)})); } catch {} }
  const size = logoSize() * 2.5, center = 360, pad = 10;
  const logo = logoData ? `<rect x="${center-size/2-pad}" y="${center-size/2-pad}" width="${size+pad*2}" height="${size+pad*2}" rx="${pad}" fill="#fff"/><image href="${String(logoData).replaceAll("&","&amp;").replaceAll('"','&quot;')}" x="${center-size/2}" y="${center-size/2}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>` : "";
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720"><rect width="720" height="720" fill="#fff"/><image href="${String(qrData).replaceAll("&","&amp;").replaceAll('"','&quot;')}" x="60" y="60" width="600" height="600"/>${logo}</svg>`;
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"})); a.download=`${safeName()}.svg`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

export function initQR() {
  $("#generateQr")?.addEventListener("click", async()=>{ if(!currentQRUrl)return toast("Shortlink belum tersedia."); try{await renderQR($("#qrCanvas"),currentQRUrl,DEFAULT_LOGO)}catch(e){console.error(e);toast("QR gagal dibuat.")} });
  $("#downloadQrPng")?.addEventListener("click",()=>downloadPng().catch(()=>toast("PNG gagal dibuat.")));
  $("#downloadQrSvg")?.addEventListener("click",()=>downloadSvg().catch(()=>toast("SVG gagal dibuat.")));
}
