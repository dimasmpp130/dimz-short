"use strict";

const API_URL = "/api/admins";
let allLinks = [];
let selectedAlias = null;
let qrUrl = "";

const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function num(v) { return new Intl.NumberFormat("id-ID").format(Number(v || 0)); }
function date(v) { if (!v) return "-"; const d = new Date(v); return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString(navigator.language || "id-ID"); }
function toast(message) { $("toast").textContent = message; $("toast").classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>$("toast").classList.remove("show"),2600); }

async function api(url=API_URL, options={}) {
  const r = await fetch(url,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data = await r.json().catch(()=>({}));
  if (!r.ok) { const e=new Error(data.error||`Request gagal (${r.status})`); e.status=r.status; throw e; }
  return data;
}

function showLogin() {
  sessionStorage.removeItem("dimz_admin_authenticated");
  $("loginPage").classList.remove("hidden");
  $("adminApp").classList.add("hidden");
}
function showAdmin() {
  $("loginPage").classList.add("hidden");
  $("adminApp").classList.remove("hidden");
}

function renderMap(id, obj) {
  const entries=Object.entries(obj||{}).sort((a,b)=>b[1]-a[1]).slice(0,8);
  $(id).innerHTML=entries.length ? entries.map(([k,v])=>`<div class="stat-row"><span>${esc(k)}</span><b>${num(v)}</b></div>`).join("") : `<span class="muted">Belum ada data</span>`;
}

function renderStats(stats) {
  $("totalLinks").textContent=num(stats.totalLinks);
  $("totalClicks").textContent=num(stats.totalClicks);
  $("uniqueVisitors").textContent=num(stats.uniqueVisitors);
  $("humanBot").textContent=`${num(stats.human)} / ${num(stats.bot)}`;
  renderMap("countryStats",stats.countries);
  renderMap("deviceStats",stats.devices);
  renderMap("browserStats",stats.browsers);
  renderMap("languageStats",stats.languages);
}

function filteredLinks() {
  const q=$("searchInput").value.trim().toLowerCase();
  const status=$("statusFilter").value;
  const sort=$("sortSelect").value;
  let list=allLinks.filter(l=>{
    const text=`${l.alias||""} ${l.destination||""}`.toLowerCase();
    if(q && !text.includes(q)) return false;
    const expired=l.expiresAt && Date.parse(l.expiresAt)<=Date.now();
    if(status==="expired") return expired;
    if(status==="paused") return !expired && l.paused;
    if(status==="active") return !expired && !l.paused;
    if(status==="protected") return Boolean(l.passwordProtected);
    return true;
  });
  list.sort((a,b)=>{
    if(sort==="oldest") return Date.parse(a.createdAt||0)-Date.parse(b.createdAt||0);
    if(sort==="clicks") return Number(b.clicks||0)-Number(a.clicks||0);
    if(sort==="alias") return String(a.alias).localeCompare(String(b.alias));
    return Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0);
  });
  return list;
}

function renderTable() {
  const list=filteredLinks();
  $("linksBody").innerHTML=list.length ? list.map(link=>{
    const expired=link.expiresAt && Date.parse(link.expiresAt)<=Date.now();
    const status=expired?"Kedaluwarsa":link.paused?"Dijeda":"Aktif";
    const statusClass=expired?"danger":link.paused?"":"success";
    return `<tr>
      <td><div class="alias">${esc(link.alias)}</div></td>
      <td><div class="destination" title="${esc(link.destination)}">${esc(link.destination)}</div></td>
      <td><span class="clicks">${num(link.clicks)}</span></td>
      <td><span class="pill ${statusClass}">${status}</span>${link.passwordProtected?` <span class="pill">Password</span>`:""}</td>
      <td><span class="pill">${esc(date(link.createdAt))}</span></td>
      <td><div class="actions">
        <button class="small-btn" data-action="stats" data-alias="${esc(link.alias)}">Analytics</button>
        <button class="small-btn" data-action="edit" data-alias="${esc(link.alias)}">Edit</button>
        <button class="small-btn" data-action="qr" data-alias="${esc(link.alias)}">QR</button>
        <button class="small-btn" data-action="state" data-alias="${esc(link.alias)}">${link.paused?"Resume":"Pause"}</button>
        <button class="small-btn" data-action="reset" data-alias="${esc(link.alias)}">Reset</button>
        <button class="small-btn delete" data-action="delete" data-alias="${esc(link.alias)}">Delete</button>
      </div></td>
    </tr>`;
  }).join(""):`<tr><td colspan="6"><div class="empty">Tidak ada shortlink.</div></td></tr>`;
}

async function loadDashboard() {
  $("refreshButton").disabled=true;
  try {
    const params=new URLSearchParams();
    const from=$("analyticsFrom")?.value; const to=$("analyticsTo")?.value;
    if(from) params.set("from", `${from}T00:00:00`);
    if(to) params.set("to", `${to}T23:59:59.999`);
    const data=await api(params.toString()?`${API_URL}?${params}`:API_URL);
    if(!data.authenticated){showLogin();return;}
    allLinks=Array.isArray(data.links)?data.links:[];
    renderStats(data.stats||{});
    renderTable();
  } catch(e) {
    if(e.status===401){showLogin();return;}
    toast(e.message||"Gagal memuat dashboard.");
  } finally { $("refreshButton").disabled=false; }
}

function openEdit(link) {
  selectedAlias=link.alias;
  $("editAlias").value=link.alias;
  $("editAliasDisplay").value=link.alias;
  $("editDestination").value=link.destination||"";
  $("editPassword").value="";
  $("removePassword").checked=false;
  $("editExpiresAt").value=link.expiresAt ? new Date(new Date(link.expiresAt).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16) : "";
  $("editModal").classList.remove("hidden");
}
function closeEdit(){selectedAlias=null;$("editModal").classList.add("hidden");}

function openStats(link) {
  const events=Array.isArray(link.recentClicks)?link.recentClicks:[];
  const count=(field)=>events.reduce((m,e)=>{const k=e?.[field]||"Tidak diketahui";m[k]=(m[k]||0)+1;return m;},{});
  const hours=events.reduce((m,e)=>{const d=e?.time?new Date(e.time):null;const k=d&&!Number.isNaN(d.getTime())?`${String(d.getHours()).padStart(2,"0")}:00`:"Tidak diketahui";m[k]=(m[k]||0)+1;return m;},{});
  $("clickSummary").textContent=`${link.alias} · ${num(link.clicks)} klik · ${num(new Set(events.map(e=>e.visitor).filter(Boolean)).size)} pengunjung unik`;
  renderMap("hourStats",hours);
  renderMap("osStats",count("os"));
  renderMap("referrerStats",count("referrer"));
  $("clickDetails").innerHTML=events.length?events.map(e=>`<div class="click-item"><div class="click-main"><span class="pill">${esc(e.type||"human")}</span><span class="pill">${esc(e.device||"-")}</span><span class="pill">${esc(e.browser||"-")}</span><span class="pill">${esc(e.country||"-")}</span></div><div class="click-time">${esc(date(e.time))}</div><div class="click-info">OS: ${esc(e.os||"-")} · Bahasa: ${esc(e.language||"-")}<br>Referrer: ${esc(e.referrer||"Langsung")}</div></div>`).join(""):`<div class="empty">Belum ada aktivitas.</div>`;
  $("clickModal").classList.remove("hidden");
}

let adminQrLogoSource = "/assets/icon/qr-create.png";
let adminQrSourceMode = "url";
let adminQrObjectUrl = "";

function setAdminQrSourceMode(mode) {
  adminQrSourceMode = mode === "gallery" ? "gallery" : "url";
  $("adminQrUrlTab")?.classList.toggle("active", adminQrSourceMode === "url");
  $("adminQrGalleryTab")?.classList.toggle("active", adminQrSourceMode === "gallery");
  $("adminQrUrlWrap")?.classList.toggle("hidden", adminQrSourceMode !== "url");
  $("adminQrGalleryWrap")?.classList.toggle("hidden", adminQrSourceMode !== "gallery");
}

function getAdminQrLogo() {
  if (adminQrSourceMode === "gallery") return adminQrObjectUrl || adminQrLogoSource;
  return String($("adminQrLogoUrl")?.value || "").trim() || adminQrLogoSource;
}

function clearAdminQrFile() {
  if (adminQrObjectUrl) {
    URL.revokeObjectURL(adminQrObjectUrl);
    adminQrObjectUrl = "";
  }
  const fileInput = $("adminQrLogoFile");
  if (fileInput) fileInput.value = "";
  const name = $("adminQrFileName");
  if (name) name.textContent = "Belum ada gambar dipilih.";
  const preview = $("adminQrPreview");
  if (preview) { preview.removeAttribute("src"); preview.classList.remove("show"); }
}

function openQr(link) {
  qrUrl=`${location.origin}/${encodeURIComponent(link.alias)}`;
  $("adminQrUrl").value=qrUrl;
  $("adminQrLogoUrl").value="";
  clearAdminQrFile();
  adminQrLogoSource="/assets/icon/qr-create.png";
  setAdminQrSourceMode("url");
  $("adminQrCanvas").innerHTML="";
  $("qrModal").classList.remove("hidden");
}


async function loadQrScript(){
  if(window.QRCode)return;
  await new Promise((resolve,reject)=>{
    const src=document.createElement("script");
    src.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    src.onload=resolve;
    src.onerror=reject;
    document.head.appendChild(src);
  });
}

function qrLogoSize(){
  return localStorage.getItem("dimz_qr_logo_size") === "medium" ? 44 : 32;
}

function loadAdminQrImage(src){
  return new Promise((resolve,reject)=>{
    if(!src) return reject(new Error("Logo QR tidak tersedia."));
    const image=new Image();
    if(!String(src).startsWith("blob:") && !String(src).startsWith(location.origin)){
      image.crossOrigin="anonymous";
    }
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error("Logo QR gagal dimuat."));
    image.src=src;
  });
}

function drawAdminQrLogo(ctx, logo, center, qrSize){
  const logoSize=Math.round(qrSize * (localStorage.getItem("dimz_qr_logo_size") === "medium" ? 0.20 : 0.15));
  const padding=Math.max(6, Math.round(logoSize * 0.16));
  const boxSize=logoSize + padding * 2;
  const x=center - boxSize / 2;
  const y=center - boxSize / 2;
  const radius=Math.max(8, Math.round(boxSize * 0.16));

  ctx.save();
  ctx.fillStyle="#fff";
  ctx.beginPath();
  ctx.roundRect(x,y,boxSize,boxSize,radius);
  ctx.fill();
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(logo,center-logoSize/2,center-logoSize/2,logoSize,logoSize);
  ctx.restore();
}

async function makeAdminQrCanvas(source, logoSrc, outputSize=720){
  const sourceCanvas=document.createElement("canvas");
  sourceCanvas.width=sourceCanvas.height=600;
  const sourceCtx=sourceCanvas.getContext("2d",{alpha:false});
  sourceCtx.fillStyle="#fff";
  sourceCtx.fillRect(0,0,600,600);
  sourceCtx.imageSmoothingEnabled=false;

  if(source.tagName.toLowerCase()==="canvas"){
    sourceCtx.drawImage(source,0,0,600,600);
  }else{
    const image=await loadAdminQrImage(source.src);
    sourceCtx.drawImage(image,0,0,600,600);
  }

  const canvas=document.createElement("canvas");
  canvas.width=canvas.height=outputSize;
  const ctx=canvas.getContext("2d",{alpha:false});
  ctx.fillStyle="#fff";
  ctx.fillRect(0,0,outputSize,outputSize);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(sourceCanvas,60,60,600,600);

  try{
    const logo=await loadAdminQrImage(logoSrc);
    drawAdminQrLogo(ctx,logo,outputSize/2,600);
  }catch(error){
    console.warn("Logo QR tidak dapat disematkan:",error);
  }

  return canvas;
}

let adminGeneratedQrCanvas=null;

async function generateAdminQr(){
  const box=$("adminQrCanvas");
  box.innerHTML="";
  adminGeneratedQrCanvas=null;

  try{
    await loadQrScript();
    const size=Number(localStorage.getItem("dimz_qr_size")||240);
    new window.QRCode(box,{
      text:qrUrl,
      width:size,
      height:size,
      correctLevel:window.QRCode.CorrectLevel.H
    });

    await new Promise(resolve=>setTimeout(resolve,120));
    const source=box.querySelector("canvas, img");
    if(!source) throw new Error("QR tidak berhasil dibuat.");

    const logoSrc=getAdminQrLogo();
    adminGeneratedQrCanvas=await makeAdminQrCanvas(source,logoSrc,720);

    const preview=document.createElement("canvas");
    preview.width=preview.height=600;
    const previewCtx=preview.getContext("2d");
    previewCtx.drawImage(adminGeneratedQrCanvas,60,60,600,600,0,0,600,600);
    preview.className="qr-render";
    preview.setAttribute("role","img");
    preview.setAttribute("aria-label","QR Code shortlink dengan logo");

    box.innerHTML="";
    box.classList.add("qr-overlay");
    box.appendChild(preview);
  }catch(error){
    console.error(error);
    toast("QR gagal dibuat.");
  }
}

async function getAdminQrCanvas(){
  if(adminGeneratedQrCanvas) return adminGeneratedQrCanvas;
  const source=$("adminQrCanvas")?.querySelector("canvas, img");
  if(!source) return null;
  return makeAdminQrCanvas(source,getAdminQrLogo(),720);
}

async function downloadAdminQr(format){
  const canvas=await getAdminQrCanvas();
  if(!canvas) return toast("Buat QR terlebih dahulu.");

  const name=`dimz-${(qrUrl.split("/").pop()||"shortlink").replace(/[^A-Za-z0-9_-]/g,"-").slice(0,40)}`;

  if(format==="png"){
    const a=document.createElement("a");
    a.href=canvas.toDataURL("image/png");
    a.download=`${name}.png`;
    a.click();
    return;
  }

  const data=canvas.toDataURL("image/png").replaceAll("&","&amp;").replaceAll('"','&quot;');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720"><rect width="720" height="720" fill="#fff"/><image href="${data}" x="0" y="0" width="720" height="720" preserveAspectRatio="none"/></svg>`;
  const blobUrl=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}));
  const a=document.createElement("a");
  a.href=blobUrl;
  a.download=`${name}.svg`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(blobUrl),1000);
}

async function changeState(alias, paused) {
  try { await api(API_URL,{method:"POST",body:JSON.stringify({action:"state",alias,paused})}); toast(paused?"Link dijeda.":"Link dilanjutkan."); await loadDashboard(); }
  catch(e){toast(e.message||"Gagal mengubah status.");}
}
async function resetStats(alias) {
  if(!confirm(`Reset semua statistik untuk "${alias}"? Tindakan ini tidak dapat dibatalkan.`))return;
  try{await api(API_URL,{method:"POST",body:JSON.stringify({action:"resetStats",alias})});toast("Statistik direset.");await loadDashboard();}catch(e){toast(e.message||"Gagal mereset statistik.");}
}
async function deleteLink(alias) {
  if(!confirm(`Hapus shortlink "${alias}"?`))return;
  try { await api(API_URL,{method:"POST",body:JSON.stringify({action:"delete",alias})}); toast("Shortlink dihapus."); await loadDashboard(); }
  catch(e){toast(e.message||"Gagal menghapus.");}
}

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); $("loginError").classList.add("hidden"); $("loginButton").disabled=true;
  try {
    await api(API_URL,{method:"POST",body:JSON.stringify({action:"login",password:$("adminPassword").value})});
    sessionStorage.setItem("dimz_admin_authenticated","1");
    $("adminPassword").value="";
    showAdmin();
    await loadDashboard();
  }
  catch(e){$("loginError").textContent=e.message||"Login gagal.";$("loginError").classList.remove("hidden");}
  finally{$("loginButton").disabled=false;}
});
$("linksBody").addEventListener("click",e=>{
  const b=e.target.closest("[data-action]"); if(!b)return;
  const link=allLinks.find(x=>x.alias===b.dataset.alias); if(!link)return;
  if(b.dataset.action==="stats")openStats(link);
  if(b.dataset.action==="edit")openEdit(link);
  if(b.dataset.action==="qr")openQr(link);
  if(b.dataset.action==="state")changeState(link.alias,!link.paused);
  if(b.dataset.action==="reset")resetStats(link.alias);
  if(b.dataset.action==="delete")deleteLink(link.alias);
});
$("editForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!selectedAlias)return;
  try {
    const expires=$("editExpiresAt").value?new Date($("editExpiresAt").value).toISOString():null;
    const body={action:"update",alias:selectedAlias,destination:$("editDestination").value.trim(),expiresAt:expires,password:$("editPassword").value.trim(),removePassword:$("removePassword").checked};
    await api(API_URL,{method:"POST",body:JSON.stringify(body)});
    closeEdit();toast("Shortlink diperbarui.");await loadDashboard();
  } catch(e){toast(e.message||"Gagal menyimpan.");}
});
$("refreshButton").addEventListener("click",loadDashboard);
$("exportButton").addEventListener("click",()=>{window.location.href=`${API_URL}?action=export`;});
$("logoutButton").addEventListener("click",async()=>{
  try { await api(API_URL,{method:"POST",body:JSON.stringify({action:"logout"})}); } catch {}
  showLogin();
});
$("searchInput").addEventListener("input",renderTable);
$("statusFilter").addEventListener("change",renderTable);
$("sortSelect").addEventListener("change",renderTable);
function loadSettings(){ $("settingQrSize").value=localStorage.getItem("dimz_qr_size")||"240"; $("settingQrLogoSize").value=localStorage.getItem("dimz_qr_logo_size")||"small"; $("settingExpiry").value=localStorage.getItem("dimz_default_expiry")||"0"; }
$("settingQrSize").addEventListener("change",e=>localStorage.setItem("dimz_qr_size",e.target.value));
$("settingQrLogoSize").addEventListener("change",e=>localStorage.setItem("dimz_qr_logo_size",e.target.value));
$("settingExpiry").addEventListener("change",e=>localStorage.setItem("dimz_default_expiry",e.target.value));
loadSettings();
$("closeEdit").addEventListener("click",closeEdit);$("cancelEdit").addEventListener("click",closeEdit);
$("closeClicks").addEventListener("click",()=>$("clickModal").classList.add("hidden"));
$("closeQr").addEventListener("click",()=>$("qrModal").classList.add("hidden"));
$("adminQrUrlTab").addEventListener("click",()=>setAdminQrSourceMode("url"));
$("adminQrGalleryTab").addEventListener("click",()=>setAdminQrSourceMode("gallery"));
$("adminQrLogoFile").addEventListener("change",e=>{
  const file=e.target.files?.[0];
  if (adminQrObjectUrl) URL.revokeObjectURL(adminQrObjectUrl);
  adminQrObjectUrl = "";
  const preview = $("adminQrPreview");
  if (!file) {
    $("adminQrFileName").textContent = "Belum ada gambar dipilih.";
    preview?.removeAttribute("src");
    preview?.classList.remove("show");
    return;
  }
  if (!file.type.startsWith("image/")) {
    e.target.value = "";
    $("adminQrFileName").textContent = "File bukan gambar.";
    preview?.removeAttribute("src");
    preview?.classList.remove("show");
    toast("Pilih file gambar yang valid.");
    return;
  }
  adminQrObjectUrl = URL.createObjectURL(file);
  $("adminQrFileName").textContent = file.name;
  if (preview) {
    preview.src = adminQrObjectUrl;
    preview.classList.add("show");
  }
});
$("adminGenerateQr").addEventListener("click",generateAdminQr);
$("adminDownloadQrPng").addEventListener("click",()=>downloadAdminQr("png"));
$("adminDownloadQrSvg").addEventListener("click",()=>downloadAdminQr("svg"));
$("editModal").addEventListener("click",e=>{if(e.target===$("editModal"))closeEdit();});
$("clickModal").addEventListener("click",e=>{if(e.target===$("clickModal"))$("clickModal").classList.add("hidden");});
$("qrModal").addEventListener("click",e=>{if(e.target===$("qrModal"))$("qrModal").classList.add("hidden");});

const hadAdminSession = sessionStorage.getItem("dimz_admin_authenticated") === "1";
if (hadAdminSession) showAdmin();

api().then(data=>{
  if (data.authenticated) {
    sessionStorage.setItem("dimz_admin_authenticated","1");
    showAdmin();
    allLinks = Array.isArray(data.links) ? data.links : [];
    renderStats(data.stats || {});
    renderTable();
  } else {
    showLogin();
  }
}).catch((e)=>{
  if (e?.status === 401) showLogin();
  else if (!hadAdminSession) showLogin();
});
