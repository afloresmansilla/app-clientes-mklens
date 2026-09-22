import { getToken } from "../api";

export function isLoggedIn() {
  return !!getToken();
}
