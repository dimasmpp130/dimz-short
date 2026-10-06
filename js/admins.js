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

function setAdminQrSourceMode(mode) {
  adminQrSourceMode = mode === "gallery" ? "gallery" : "url";
  $("adminQrUrlTab")?.classList.toggle("active", adminQrSourceMode === "url");
  $("adminQrGalleryTab")?.classList.toggle("active", adminQrSourceMode === "gallery");
  $("adminQrUrlWrap")?.classList.toggle("hidden", adminQrSourceMode !== "url");
  $("adminQrGalleryWrap")?.classList.toggle("hidden", adminQrSourceMode !== "gallery");
}

function getAdminQrLogo() {
  if (adminQrSourceMode === "gallery") {
    const file = $("adminQrLogoFile")?.files?.[0];
    return file ? URL.createObjectURL(file) : adminQrLogoSource;
  }
  return String($("adminQrLogoUrl")?.value || "").trim() || adminQrLogoSource;
}

function openQr(link) {
  qrUrl=`${location.origin}/${encodeURIComponent(link.alias)}`;
  $("adminQrUrl").value=qrUrl;
  $("adminQrLogoUrl").value="";
  $("adminQrLogoFile").value="";
  $("adminQrFileName").textContent="Belum ada gambar dipilih.";
  adminQrLogoSource="/assets/icon/qr-create.png";
  setAdminQrSourceMode("url");
  $("adminQrCanvas").innerHTML="";
  $("qrModal").classList.remove("hidden");
}

async function loadQrScript(){
  if(window.QRCode)return;
  await new Promise((resolve,reject)=>{const src=document.createElement("script");src.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";src.onload=resolve;src.onerror=reject;document.head.appendChild(src);});
}
function qrLogoSize(){return localStorage.getItem("dimz_qr_logo_size") === "medium" ? 44 : 32;}
async function generateAdminQr() {
  const box=$("adminQrCanvas"); box.innerHTML="";
  try {
    await loadQrScript();
    const size=Number(localStorage.getItem("dimz_qr_size")||240);
    new window.QRCode(box,{text:qrUrl,width:size,height:size,correctLevel:window.QRCode.CorrectLevel.H});
    setTimeout(()=>{
      const img=box.querySelector("img,canvas"); if(!img)return;
      box.classList.add("qr-overlay");
      const logoSrc=getAdminQrLogo(); if(!logoSrc)return;
      const logo=document.createElement("img"); logo.className="qr-logo"; logo.style.width=qrLogoSize()+"px"; logo.style.height=qrLogoSize()+"px"; logo.src=logoSrc; logo.alt="Logo QR"; logo.onerror=()=>logo.remove(); box.appendChild(logo);
      if(adminQrSourceMode==="gallery"&&logoSrc.startsWith("blob:")){logo.addEventListener("load",()=>URL.revokeObjectURL(logoSrc),{once:true});logo.addEventListener("error",()=>URL.revokeObjectURL(logoSrc),{once:true});}
    },120);
  } catch(error){console.error(error);toast("QR gagal dibuat.");}
}
async function getAdminQrCanvas(){
  const source=$("adminQrCanvas")?.querySelector("canvas, img:not(.qr-logo)"); if(!source)return null;
  const qr=document.createElement("canvas"); qr.width=qr.height=600; const qctx=qr.getContext("2d");
  if(source.tagName.toLowerCase()==="canvas") qctx.drawImage(source,0,0,600,600);
  else { const image=new Image(); image.crossOrigin="anonymous"; await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=source.src;}); qctx.drawImage(image,0,0,600,600); }
  const logo=$("adminQrCanvas .qr-logo"); const canvas=document.createElement("canvas"); const size=720; canvas.width=canvas.height=size; const ctx=canvas.getContext("2d"); ctx.fillStyle="#fff";ctx.fillRect(0,0,size,size);
  ctx.drawImage(qr,60,60,600,600);
  if(logo?.complete&&logo.naturalWidth){const ls=qrLogoSize()*2.5;const pad=Math.round(ls*.16);ctx.fillStyle="#fff";ctx.beginPath();ctx.roundRect((size-ls)/2-pad,(size-ls)/2-pad,ls+pad*2,ls+pad*2,Math.round(ls*.18));ctx.fill();ctx.drawImage(logo,(size-ls)/2,(size-ls)/2,ls,ls);}
  return canvas;
}
async function downloadAdminQr(format){
  const canvas=await getAdminQrCanvas(); if(!canvas)return toast("Buat QR terlebih dahulu.");
  const name=`dimz-${(qrUrl.split("/").pop()||"shortlink").replace(/[^A-Za-z0-9_-]/g,"-").slice(0,40)}`;
  if(format==="png"){const a=document.createElement("a");a.href=canvas.toDataURL("image/png");a.download=`${name}.png`;a.click();return;}
  const data=canvas.toDataURL("image/png").replaceAll("&","&amp;").replaceAll('"','&quot;');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720"><rect width="720" height="720" fill="#fff"/><image href="${data}" width="720" height="720"/></svg>`;
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));a.download=`${name}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
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
$("applyAnalyticsFilter").addEventListener("click",loadDashboard);
$("clearAnalyticsFilter").addEventListener("click",()=>{ $("analyticsFrom").value=""; $("analyticsTo").value=""; loadDashboard(); });
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
  $("adminQrFileName").textContent=file ? file.name : "Belum ada gambar dipilih.";
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
    // Request ini sudah membawa dashboard lengkap; hindari request kedua.
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
