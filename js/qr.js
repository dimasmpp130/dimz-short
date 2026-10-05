import { CONFIG } from "./config.js";
import { $, loadScriptOnce, toast } from "./utils.js";

let currentQRUrl = "";
let generated = false;

export function setQRUrl(url) { currentQRUrl = url; generated = false; }

function addLogo(container, logoSrc = "/assets/icon/qr.png") {
  const logo = document.createElement("img");
  logo.className = "qr-logo";
  logo.src = logoSrc;
  logo.alt = "Logo DIMZ";
  logo.onerror = () => logo.remove();
  container.classList.add("qr-overlay");
  container.appendChild(logo);
}

export async function renderQR(container, url, logoSrc = "/assets/icon/qr.png") {
  await loadScriptOnce(CONFIG.QR_CDN);
  container.innerHTML = "";
  container.classList.remove("qr-overlay");
  new window.QRCode(container, {
    text: url,
    width: 240,
    height: 240,
    correctLevel: window.QRCode.CorrectLevel.H
  });
  await new Promise(r => setTimeout(r, 120));
  addLogo(container, logoSrc);
  generated = true;
}

async function imageToData(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function downloadPng() {
  const box = $("#qrCanvas");
  const qr = box?.querySelector("img:not(.qr-logo), canvas");
  if (!qr || !generated) return toast("Buat QR terlebih dahulu.");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 720;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,720,720);
  const qrSource = qr.tagName.toLowerCase() === "canvas" ? qr : await new Promise((resolve,reject) => {
    const img = new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=qr.src;
  });
  ctx.drawImage(qrSource, 60, 60, 600, 600);
  const logoEl = box.querySelector(".qr-logo");
  if (logoEl?.complete) {
    try { ctx.drawImage(logoEl, 310, 310, 100, 100); } catch {}
  }
  const a=document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download="dimz-qr.png"; a.click();
}

async function downloadSvg() {
  if (!generated || !currentQRUrl) return toast("Buat QR terlebih dahulu.");
  const qr = $("#qrCanvas")?.querySelector("img:not(.qr-logo), canvas");
  if (!qr) return;
  let qrData = qr.tagName.toLowerCase() === "canvas" ? qr.toDataURL("image/png") : qr.src;
  if (!qrData) return;
  let logoData = "/assets/icon/qr.png";
  try { logoData = await imageToData("/assets/icon/qr.png"); } catch {}
  const esc = (v) => String(v).replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720"><rect width="720" height="720" fill="#fff"/><image href="${esc(qrData)}" x="60" y="60" width="600" height="600"/><rect x="300" y="300" width="120" height="120" rx="18" fill="#fff"/><image href="${esc(logoData)}" x="310" y="310" width="100" height="100" preserveAspectRatio="xMidYMid meet"/></svg>`;
  const blob=new Blob([svg],{type:"image/svg+xml"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="dimz-qr.svg"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

export function initQR() {
  $("#generateQr")?.addEventListener("click", async () => {
    if (!currentQRUrl) return toast("Shortlink belum tersedia.");
    try { await renderQR($("#qrCanvas"), currentQRUrl, "/assets/icon/qr.png"); }
    catch (error) { console.error(error); toast("QR gagal dibuat."); }
  });
  $("#downloadQrPng")?.addEventListener("click", () => downloadPng().catch(() => toast("PNG gagal dibuat.")));
  $("#downloadQrSvg")?.addEventListener("click", () => downloadSvg().catch(() => toast("SVG gagal dibuat.")));
}
