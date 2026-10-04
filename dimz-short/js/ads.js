/*
 * DIMZLINK ADS
 *
 * Iklan dipasang langsung di shortlink.html.
 * File ini sengaja TIDAK melakukan dynamic injection
 * agar script iklan provider bisa berjalan normal.
 */

let initialized = false;

export function initAds() {
  if (initialized) return;

  initialized = true;

  /*
   * Jangan inject script iklan di sini.
   *
   * Script iklan sudah berada langsung di:
   *
   * #managerAd1
   * #managerAd2
   * #redirectAd1
   * #redirectAd2
   *
   * Dynamic injection dapat membuat beberapa ad network
   * tidak bekerja dengan benar.
   */

  return true;
}