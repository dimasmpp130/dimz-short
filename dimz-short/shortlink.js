import { getAliasFromLocation } from "./js/shortlink/utils.js";
import { initManager } from "./js/shortlink/manager.js";
import { initRedirect } from "./js/shortlink/redirect.js";
import { initShare } from "./js/shortlink/share.js";
import { initQR } from "./js/shortlink/qr.js";
import { initAds } from "./js/shortlink/ads.js";

document.addEventListener("DOMContentLoaded", () => {
  initShare();
  initQR();
  initAds();

  const alias = getAliasFromLocation();

  if (alias) {
    document.body.classList.remove("manager-mode");
    document.body.classList.add("redirect-mode");

    initRedirect(alias);
    return;
  }

  document.body.classList.remove("redirect-mode");
  document.body.classList.add("manager-mode");

  initManager();
});