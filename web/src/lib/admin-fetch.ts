export const ADMIN_TOKEN_STORAGE_KEY = "treasury-admin-token";

export function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
