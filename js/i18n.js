(() => {
  const lang = (navigator.language || "id").toLowerCase().startsWith("id") ? "id" : "en";
  document.documentElement.lang = lang;
  if (lang === "id") return;
  const map = new Map([
    ["Buat Shortlink","Create Shortlink"],["Buat Link","Create Link"],["Batal Edit","Cancel Edit"],
    ["Link Saya","My Links"],["Salin","Copy"],["Dijeda","Paused"],["Aktif","Active"],["Kedaluwarsa","Expired"],
    ["Berpassword","Password protected"],["Kesehatan: belum dicek","Health: not checked"],["Buat QR","Generate QR"],
    ["Bagikan","Share"],["Pemeriksaan Keamanan","Security Check"],["Lanjutkan","Continue"],
    ["Dashboard","Dashboard"],["Refresh","Refresh"],["Keluar","Logout"],["Masuk Admin","Admin Login"],
    ["Password Admin","Admin Password"],["TOTAL SHORTLINK","TOTAL SHORTLINK"],["TOTAL KLIK","TOTAL CLICKS"],
    ["PENGUNJUNG UNIK","UNIQUE VISITORS"],["MANUSIA / BOT","HUMAN / BOT"],["Semua status","All statuses"],
    ["Terbaru","Newest"],["Terlama","Oldest"],["Klik terbanyak","Most clicks"],["Alias A–Z","Alias A–Z"],
    ["Analytics Shortlink","Shortlink Analytics"],["Edit Shortlink","Edit Shortlink"],["Simpan","Save"],["Batal","Cancel"],
    ["Hapus password","Remove password"],["QR Admin","Admin QR"],["Admin dapat memilih logo lain.","Admin can choose another logo."],
    ["URL Tujuan","Destination URL"],["Alias Custom","Custom Alias"],["Kedaluwarsa","Expiration"],["Password","Password"]
  ]);
  const walk = (node) => {
    if (node.nodeType === 3) {
      const value=node.nodeValue.trim();
      if (map.has(value)) node.nodeValue=node.nodeValue.replace(value,map.get(value));
      return;
    }
    if (node.nodeType === 1) for (const child of node.childNodes) walk(child);
  };
  walk(document.body);
})();
