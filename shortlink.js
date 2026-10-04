import { getAliasFromLocation } from "./js/utils.js";
import { initManager } from "./js/manager.js";
import { initRedirect } from "./js/redirect.js";
import { initShare } from "./js/share.js";
import { initQR } from "./js/qr.js";
import { initAds } from "./js/ads.js";

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
