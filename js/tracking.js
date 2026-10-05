import {
  trackClick as apiTrackClick
} from "./api.js";

export async function recordClick(alias, accessToken = "") {
  return apiTrackClick(alias, accessToken);
}
